use std::path::{Path, PathBuf};
use std::io::{Read, Write};
use std::fs::File;
use tauri::Manager;
use tauri::ipc::Channel;
use image::{DynamicImage, ImageBuffer, Rgba};
use tract_onnx::prelude::*;
use tract_onnx::prelude::tract_ndarray::Array4;
use tokio::process::Command as TokioCommand;

use crate::error::AppError;
use crate::jobs::progress::ProgressEvent;
use crate::commands::compress_video::{CompressResult, ActiveJobPids};
use crate::encoders::ffmpeg_sidecar_path;

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;

// ─── Constants ────────────────────────────────────────────────────────────────

const REAL_ESRGAN_URL: &str = "https://huggingface.co/aigchacker/BSRGANx2/resolve/main/RealESR_Gx4.onnx";

// ─── Downloader ───────────────────────────────────────────────────────────────

fn download_model_with_progress(
    url: &str,
    dest_path: &Path,
    job_id: &str,
    on_progress: &Channel<ProgressEvent>,
) -> Result<(), AppError> {
    let response = ureq::get(url)
        .call()
        .map_err(|e| AppError::Other(format!("Failed to connect to model host: {e}")))?;

    let total_bytes = response
        .header("content-length")
        .and_then(|l| l.parse::<u64>().ok())
        .unwrap_or(4_866_453); // approx RealESR_Gx4.onnx size

    let mut temp_dest = File::create(dest_path.with_extension("tmp"))
        .map_err(|e| AppError::Other(format!("Failed to create temporary model file: {e}")))?;

    let mut reader = response.into_reader();
    let mut buffer = [0; 16384];
    let mut downloaded = 0;

    loop {
        let bytes_read = reader
            .read(&mut buffer)
            .map_err(|e| AppError::Other(format!("Failed to read stream: {e}")))?;

        if bytes_read == 0 {
            break;
        }

        temp_dest
            .write_all(&buffer[..bytes_read])
            .map_err(|e| AppError::Other(format!("Failed to write to temporary model file: {e}")))?;

        downloaded += bytes_read as u64;

        // Send progress updates (scaling 0.0 -> 0.1 for download phase)
        let fraction = (downloaded as f32 / total_bytes as f32).clamp(0.0, 1.0) * 0.1;
        let _ = on_progress.send(ProgressEvent {
            job_id: job_id.to_string(),
            fraction,
            fps: None,
            speed: Some(format!("Downloading AI Model... {:.1} MB", downloaded as f32 / 1_000_000.0)),
            eta_sec: None,
            current_bytes: None,
        });
    }

    std::fs::rename(dest_path.with_extension("tmp"), dest_path)
        .map_err(|e| AppError::Other(format!("Failed to finalize model file download: {e}")))?;

    Ok(())
}

// ─── AI Upscaler core ─────────────────────────────────────────────────────────

fn upscale_image_data(
    model_path: &Path,
    img: &DynamicImage,
    scale: u32,
) -> Result<DynamicImage, AppError> {
    let w = img.width();
    let h = img.height();

    // 1. Prepare RGB Float tensor: shape [1, 3, H, W]
    let rgb = img.to_rgb8();
    let mut input_tensor = Array4::<f32>::zeros((1, 3, h as usize, w as usize));
    for y in 0..h {
        for x in 0..w {
            let pixel = rgb.get_pixel(x, y);
            input_tensor[[0, 0, y as usize, x as usize]] = pixel[0] as f32 / 255.0;
            input_tensor[[0, 1, y as usize, x as usize]] = pixel[1] as f32 / 255.0;
            input_tensor[[0, 2, y as usize, x as usize]] = pixel[2] as f32 / 255.0;
        }
    }

    // 2. Load tract model graph and override input fact to support dynamic shape
    let mut model = tract_onnx::onnx()
        .model_for_path(model_path)
        .map_err(|e| AppError::Other(format!("Failed to load ONNX model graph: {e}")))?;

    model.set_input_fact(0, InferenceFact::dt_shape(f32::datum_type(), &[1, 3, h as usize, w as usize]))
        .map_err(|e| AppError::Other(format!("Failed to configure model input shape: {e}")))?;

    let runnable = model
        .into_optimized()
        .map_err(|e| AppError::Other(format!("Failed to optimize model graph: {e}")))?
        .into_runnable()
        .map_err(|e| AppError::Other(format!("Failed to compile runnable model: {e}")))?;

    // 3. Execute inference
    let input = input_tensor.into_tensor();
    let result = runnable
        .run(tvec![input.into()])
        .map_err(|e| AppError::Other(format!("Model execution failure: {e}")))?;

    // 4. Map output [1, 3, H*4, W*4] back to ImageBuffer
    let output_tensor = result[0]
        .to_plain_array_view::<f32>()
        .map_err(|e| AppError::Other(format!("Failed to map output tensor view: {e}")))?;

    let out_w = w * 4;
    let out_h = h * 4;
    let mut out_buffer = ImageBuffer::new(out_w, out_h);

    for y in 0..out_h {
        for x in 0..out_w {
            let r = (output_tensor[[0, 0, y as usize, x as usize]].clamp(0.0, 1.0) * 255.0) as u8;
            let g = (output_tensor[[0, 1, y as usize, x as usize]].clamp(0.0, 1.0) * 255.0) as u8;
            let b = (output_tensor[[0, 2, y as usize, x as usize]].clamp(0.0, 1.0) * 255.0) as u8;
            out_buffer.put_pixel(x, y, Rgba([r, g, b, 255]));
        }
    }

    let upscaled_img = DynamicImage::ImageRgba8(out_buffer);

    // 5. Downscale if user requested 2x instead of 4x
    if scale == 2 {
        Ok(upscaled_img.resize(w * 2, h * 2, image::imageops::FilterType::Lanczos3))
    } else {
        Ok(upscaled_img)
    }
}

// ─── Tauri Command ────────────────────────────────────────────────────────────

#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub async fn enhance_media(
    app: tauri::AppHandle,
    job_id: String,
    input_path: String,
    output_path: String,
    on_progress: Channel<ProgressEvent>,
    scale: u32,
    format: String,
    compress: bool,
    preset: String,
    active_jobs: tauri::State<'_, ActiveJobPids>,
    hw: tauri::State<'_, crate::encoders::hw_detect::HwEncodersState>,
) -> Result<CompressResult, AppError> {
    // 1. Establish model paths and download weights if missing
    let app_dir = app.path().app_data_dir()
        .map_err(|_| AppError::Other("Could not resolve AppData directory".to_string()))?;
    let models_dir = app_dir.join("models");
    std::fs::create_dir_all(&models_dir).map_err(|e| AppError::Other(e.to_string()))?;

    let model_path = models_dir.join("RealESR_Gx4.onnx");
    if !model_path.exists() {
        download_model_with_progress(REAL_ESRGAN_URL, &model_path, &job_id, &on_progress)?;
    }

    let in_path = Path::new(&input_path);
    if !in_path.exists() {
        return Err(AppError::PathDoesNotExist(input_path));
    }

    // Determine target extension
    let target_ext = if format == "original" {
        in_path.extension().and_then(|e| e.to_str()).unwrap_or("png").to_lowercase()
    } else {
        format.to_lowercase()
    };

    let is_video = match target_ext.as_str() {
        "mp4" | "mkv" | "mov" | "webm" | "avi" | "gif" => true,
        _ => {
            // also check file extension of input path
            let in_ext = in_path.extension().and_then(|e| e.to_str()).unwrap_or("").to_lowercase();
            matches!(in_ext.as_str(), "mp4" | "mkv" | "mov" | "webm" | "avi" | "gif")
        }
    };

    let final_dest = Path::new(&output_path);
    let output_parent = final_dest.parent().unwrap_or(final_dest);
    std::fs::create_dir_all(output_parent).map_err(|e| AppError::Other(e.to_string()))?;

    if !is_video {
        // ─── Image upscaling pipeline ─────────────────────────────────────────
        let img = image::open(in_path)
            .map_err(|e| AppError::Other(format!("Failed to load input image: {e}")))?;

        let _ = on_progress.send(ProgressEvent {
            job_id: job_id.to_string(),
            fraction: 0.15,
            fps: None,
            speed: Some("Enhancing image details...".to_string()),
            eta_sec: None,
            current_bytes: None,
        });

        let enhanced = upscale_image_data(&model_path, &img, scale)?;

        let _ = on_progress.send(ProgressEvent {
            job_id: job_id.to_string(),
            fraction: 0.85,
            fps: None,
            speed: Some("Finalizing file encoding...".to_string()),
            eta_sec: None,
            current_bytes: None,
        });

        // Save enhanced image
        let temp_enhanced_path = final_dest.with_extension(format!("{}.tmp_enhanced", target_ext));
        enhanced.save(&temp_enhanced_path)
            .map_err(|e| AppError::Other(format!("Failed to save enhanced image: {e}")))?;

        let final_path_str = if compress {
            // Compress the temporary enhanced file using existing encoders
            let comp_result = crate::commands::compress_image::compress_image(
                job_id.clone(),
                temp_enhanced_path.to_string_lossy().to_string(),
                output_path.clone(),
                preset,
                None,
                on_progress.clone(),
                Some(target_ext),
                None,
                None,
                None,
                None,
                None,
            ).await?;

            let _ = std::fs::remove_file(&temp_enhanced_path);
            comp_result.output_path
        } else {
            std::fs::rename(&temp_enhanced_path, final_dest)
                .map_err(|e| AppError::Other(format!("Failed to finalize enhanced file: {e}")))?;
            output_path.clone()
        };

        let output_bytes = std::fs::metadata(&final_path_str)
            .map(|m| m.len())
            .unwrap_or(0);

        Ok(CompressResult {
            output_path: final_path_str,
            output_bytes,
            output_larger: false,
        })
    } else {
        // ─── Video upscaling pipeline (Frame extract -> Upscale -> Reassemble) ───
        let ffmpeg = ffmpeg_sidecar_path();
        if !ffmpeg.exists() {
            return Err(AppError::Other("FFmpeg sidecar not found".to_string()));
        }

        // Establish temp directory for frames
        let temp_dir = std::env::temp_dir().join(format!("squeeze_enhance_{}", job_id));
        std::fs::create_dir_all(&temp_dir).map_err(|e| AppError::Other(e.to_string()))?;

        // 1. Get FPS & metadata
        let probe = crate::probe::probe_media(input_path.clone()).await?;
        let fps = probe.fps.unwrap_or(30.0);

        // 2. Extract frames using FFmpeg
        let _ = on_progress.send(ProgressEvent {
            job_id: job_id.to_string(),
            fraction: 0.12,
            fps: None,
            speed: Some("Extracting video frames...".to_string()),
            eta_sec: None,
            current_bytes: None,
        });

        let mut cmd = TokioCommand::new(&ffmpeg);
        cmd.args([
            "-y",
            "-i",
            &input_path,
            "-q:v",
            "2",
            &temp_dir.join("frame_%06d.png").to_string_lossy(),
        ]);
        #[cfg(target_os = "windows")]
        cmd.creation_flags(CREATE_NO_WINDOW);

        let status = cmd.status().await
            .map_err(|e| AppError::Other(format!("Failed to spawn FFmpeg frame extractor: {e}")))?;

        if !status.success() {
            return Err(AppError::Other("FFmpeg frame extraction failed".to_string()));
        }

        // List extracted frame paths
        let mut frames: Vec<PathBuf> = std::fs::read_dir(&temp_dir)
            .map_err(|e| AppError::Other(e.to_string()))?
            .filter_map(|e| e.ok().map(|entry| entry.path()))
            .filter(|p| p.extension().and_then(|ext| ext.to_str()) == Some("png"))
            .collect();
        frames.sort();

        let total_frames = frames.len();
        if total_frames == 0 {
            return Err(AppError::Other("No frames extracted from video".to_string()));
        }

        // 3. Upscale each frame sequentially
        let out_frames_dir = temp_dir.join("out");
        std::fs::create_dir_all(&out_frames_dir).map_err(|e| AppError::Other(e.to_string()))?;

        for (i, frame_path) in frames.iter().enumerate() {
            let img = image::open(frame_path)
                .map_err(|e| AppError::Other(format!("Failed to open frame: {e}")))?;

            let enhanced = upscale_image_data(&model_path, &img, scale)?;
            let dest_frame = out_frames_dir.join(frame_path.file_name().unwrap());
            enhanced.save(&dest_frame)
                .map_err(|e| AppError::Other(format!("Failed to save upscaled frame: {e}")))?;

            // Stream frame index progress (scaling 0.15 -> 0.85 for inference phase)
            let fraction = 0.15 + ((i + 1) as f32 / total_frames as f32) * 0.70;
            let _ = on_progress.send(ProgressEvent {
                job_id: job_id.to_string(),
                fraction,
                fps: None,
                speed: Some(format!("AI Upscaling frame {}/{}", i + 1, total_frames)),
                eta_sec: None,
                current_bytes: None,
            });
        }

        // 4. Reassemble frames using FFmpeg
        let _ = on_progress.send(ProgressEvent {
            job_id: job_id.to_string(),
            fraction: 0.88,
            fps: None,
            speed: Some("Reassembling enhanced video frames...".to_string()),
            eta_sec: None,
            current_bytes: None,
        });

        let temp_assembled_video = temp_dir.join(format!("assembled.{}", target_ext));

        let mut cmd = TokioCommand::new(&ffmpeg);
        if target_ext == "gif" {
            cmd.args([
                "-y",
                "-r",
                &fps.to_string(),
                "-i",
                &out_frames_dir.join("frame_%06d.png").to_string_lossy(),
                "-vf",
                "split[s0][s1];[s0]palettegen=max_colors=128[p];[s1][p]paletteuse",
                &temp_assembled_video.to_string_lossy(),
            ]);
        } else {
            cmd.args([
                "-y",
                "-r",
                &fps.to_string(),
                "-i",
                &out_frames_dir.join("frame_%06d.png").to_string_lossy(),
                "-i",
                &input_path,
                "-map",
                "0:v",
                "-map",
                "1:a?",
                "-c:v",
                "libx264",
                "-pix_fmt",
                "yuv420p",
                "-c:a",
                "copy",
                &temp_assembled_video.to_string_lossy(),
            ]);
        }
        #[cfg(target_os = "windows")]
        cmd.creation_flags(CREATE_NO_WINDOW);

        let status = cmd.status().await
            .map_err(|e| AppError::Other(format!("Failed to spawn FFmpeg frame assembler: {e}")))?;

        if !status.success() {
            let _ = std::fs::remove_dir_all(&temp_dir);
            return Err(AppError::Other("FFmpeg video frame reassembly failed".to_string()));
        }

        // 5. Optionally Compress the assembled upscaled video
        let final_path_str = if compress && target_ext != "gif" {
            let _ = on_progress.send(ProgressEvent {
                job_id: job_id.to_string(),
                fraction: 0.92,
                fps: None,
                speed: Some("Squeezing enhanced video...".to_string()),
                eta_sec: None,
                current_bytes: None,
            });

            let comp_result = crate::commands::compress_video::compress_video(
                job_id.clone(),
                temp_assembled_video.to_string_lossy().to_string(),
                output_path.clone(),
                preset,
                None,
                probe.duration_sec,
                on_progress.clone(),
                hw,
                active_jobs,
                Some(target_ext),
                None,
                None,
                None,
                None,
                None,
                None,
                None,
            ).await?;

            let _ = std::fs::remove_dir_all(&temp_dir);
            comp_result.output_path
        } else {
            std::fs::rename(&temp_assembled_video, final_dest)
                .map_err(|e| AppError::Other(format!("Failed to finalize enhanced video file: {e}")))?;
            let _ = std::fs::remove_dir_all(&temp_dir);
            output_path.clone()
        };

        let output_bytes = std::fs::metadata(&final_path_str)
            .map(|m| m.len())
            .unwrap_or(0);

        Ok(CompressResult {
            output_path: final_path_str,
            output_bytes,
            output_larger: false,
        })
    }
}
