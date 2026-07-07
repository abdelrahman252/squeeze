use std::path::Path;
use tokio::task;
use tokio::process::Command as TokioCommand;
use image::{DynamicImage, GenericImageView};

use crate::error::AppError;
use crate::jobs::progress::ProgressEvent;
use crate::commands::compress_video::CompressResult;

// ── Quality tables ─────────────────────────────────────────────────────────────

struct ImagePreset {
    jpeg_quality:  u8,    // mozjpeg 0-100
    png_opt_level: u8,    // oxipng preset 0-6
    webp_quality:  f32,   // webp 0-100
    lossless:      bool,
}

fn image_preset(preset: &str) -> ImagePreset {
    match preset {
        "less"     => ImagePreset { jpeg_quality: 85, png_opt_level: 2, webp_quality: 85.0, lossless: false },
        "extreme"  => ImagePreset { jpeg_quality: 55, png_opt_level: 6, webp_quality: 55.0, lossless: false },
        "lossless" => ImagePreset { jpeg_quality: 95, png_opt_level: 0, webp_quality: 100.0, lossless: true },
        "convert"  => ImagePreset { jpeg_quality: 98, png_opt_level: 1, webp_quality: 95.0, lossless: false },
        _          => ImagePreset { jpeg_quality: 75, png_opt_level: 4, webp_quality: 75.0,  lossless: false },
    }
}

// ── Output extension ──────────────────────────────────────────────────────────

/// Returns the output extension for a supported format, or None if unsupported.
/// Unsupported formats are returned to the caller unchanged (output_larger: true).
fn image_output_ext(input_ext: &str) -> Option<&'static str> {
    match input_ext {
        "jpg" | "jpeg" => Some("jpg"),
        "png"           => Some("png"),
        "webp"          => Some("webp"),
        "bmp" | "tiff"  => Some("jpg"), // transcode to JPEG (no native BMP/TIFF encoder needed)
        _               => None,         // avif, heic, heif, gif: pass-through
    }
}

// ── Per-format encoders (synchronous, CPU-bound) ──────────────────────────────

fn encode_jpeg(img: &DynamicImage, quality: u8) -> Result<Vec<u8>, AppError> {
    let rgb = img.to_rgb8();
    let (w, h) = (rgb.width(), rgb.height());

    let mut comp = mozjpeg::Compress::new(mozjpeg::ColorSpace::JCS_RGB);
    comp.set_size(w as usize, h as usize);
    comp.set_quality(quality as f32);

    let mut started = comp
        .start_compress(Vec::new())
        .map_err(|e| AppError::Other(format!("JPEG init: {e}")))?;
    started
        .write_scanlines(rgb.as_raw())
        .map_err(|e| AppError::Other(format!("JPEG scanlines: {e}")))?;
    started
        .finish()
        .map_err(|e| AppError::Other(format!("JPEG finish: {e}")))
}

fn encode_png(img: &DynamicImage, opt_level: u8) -> Result<Vec<u8>, AppError> {
    let mut buf = std::io::Cursor::new(Vec::new());
    img.write_to(&mut buf, image::ImageFormat::Png)
        .map_err(|e| AppError::Other(format!("PNG encode: {e}")))?;
    let png_bytes = buf.into_inner();
    let opts = oxipng::Options::from_preset(opt_level);
    oxipng::optimize_from_memory(&png_bytes, &opts)
        .map_err(|e| AppError::Other(format!("PNG optimize: {e}")))
}

fn encode_webp(img: &DynamicImage, quality: f32, lossless: bool) -> Result<Vec<u8>, AppError> {
    let rgba = img.to_rgba8();
    let encoder = webp::Encoder::from_rgba(rgba.as_raw(), rgba.width(), rgba.height());
    let output = if lossless {
        encoder.encode_lossless()
    } else {
        encoder.encode(quality)
    };
    Ok(output.to_vec())
}

// ── compress_image ────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn compress_image(
    job_id: String,
    input_path: String,
    output_path: String,
    preset: String,
    // duration_sec is unused for images; accepted so the JS dispatcher can call
    // compressImage with the same signature as compressVideo/compressAudio.
    duration_sec: Option<f64>,
    on_progress: tauri::ipc::Channel<ProgressEvent>,
    target_format: Option<String>,
    resize_width: Option<u32>,
    resize_height: Option<u32>,
    watermark_path: Option<String>,
    watermark_pos: Option<String>,
    watermark_opacity: Option<f32>,
) -> Result<CompressResult, AppError> {
    let _ = duration_sec; // intentionally unused

    let input_ext = Path::new(&input_path)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();

    let effective_ext = target_format.clone().unwrap_or(input_ext.clone());

    if effective_ext == "gif" {
        let ffmpeg = crate::encoders::ffmpeg_sidecar_path();
        if !ffmpeg.exists() {
            return Err(AppError::Other("FFmpeg binary not found".into()));
        }

        if let Some(parent) = Path::new(&output_path).parent() {
            std::fs::create_dir_all(parent)?;
        }

        let temp_path = {
            let p = Path::new(&output_path);
            let parent = p.parent().unwrap_or(Path::new("."));
            let stem   = p.file_stem().and_then(|s| s.to_str()).unwrap_or("output");
            parent.join(format!("{stem}.part.gif"))
                  .to_string_lossy()
                  .into_owned()
        };

        // We run FFmpeg to generate optimized GIF with paletteuse
        // We drop FPS to 15, and color palette to 128 colors to compress it
        let mut cmd = TokioCommand::new(&ffmpeg);
        cmd.args([
            "-y",
            "-i",
            &input_path,
            "-vf",
            "fps=15,split[s0][s1];[s0]palettegen=max_colors=128[p];[s1][p]paletteuse",
            &temp_path,
        ]);
        #[cfg(target_os = "windows")]
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW

        let status = cmd.status().await
            .map_err(|e| AppError::Other(format!("Failed to spawn FFmpeg GIF optimizer: {e}")))?;

        if !status.success() {
            return Err(AppError::Other("FFmpeg GIF optimization failed".into()));
        }

        let input_size = std::fs::metadata(&input_path)?.len();
        let output_size = std::fs::metadata(&temp_path)?.len();

        // Output larger guard
        let is_converted = target_format.is_some() && target_format.as_ref().unwrap().to_lowercase() != input_ext.to_lowercase();
        if output_size >= input_size && !is_converted {
            let _ = std::fs::remove_file(&temp_path);
            return Ok(CompressResult {
                output_path: input_path,
                output_bytes: input_size,
                output_larger: true,
            });
        }

        if Path::new(&output_path).exists() {
            std::fs::remove_file(&output_path)?;
        }
        std::fs::rename(&temp_path, &output_path)?;

        let _ = on_progress.send(ProgressEvent {
            job_id: job_id.clone(),
            fraction: 1.0,
            fps: None,
            speed: None,
            eta_sec: None,
            current_bytes: Some(output_size),
        });

        return Ok(CompressResult {
            output_path,
            output_bytes: output_size,
            output_larger: false,
        });
    }

    // Unsupported format: return original unchanged
    let Some(out_ext) = image_output_ext(&effective_ext) else {
        let input_bytes = std::fs::metadata(&input_path)?.len();
        return Ok(CompressResult {
            output_path: input_path,
            output_bytes: input_bytes,
            output_larger: true,
        });
    };

    // Override output extension if the format changes (e.g. BMP → jpg)
    let output_path = {
        let p = Path::new(&output_path);
        let cur_ext = p.extension().and_then(|e| e.to_str()).unwrap_or("").to_lowercase();
        if cur_ext != out_ext {
            let parent = p.parent().unwrap_or(Path::new("."));
            let stem   = p.file_stem().and_then(|s| s.to_str()).unwrap_or("output");
            parent.join(format!("{stem}.{out_ext}"))
                  .to_string_lossy()
                  .into_owned()
        } else {
            output_path
        }
    };

    // Ensure output directory exists (handles 'subfolder' and 'custom' modes)
    if let Some(parent) = Path::new(&output_path).parent() {
        std::fs::create_dir_all(parent)?;
    }

    let input_bytes_raw = std::fs::read(&input_path)?;
    let input_size = input_bytes_raw.len() as u64;

    // Clone what the blocking closure needs (avoids capturing String references)
    let preset_c    = preset.clone();
    let effective_ext_c = effective_ext.clone();

    // Run CPU-bound encoding on a blocking thread so the async runtime stays free
    let compressed = task::spawn_blocking(move || -> Result<Vec<u8>, AppError> {
        let p = image_preset(&preset_c);
        let mut img = image::load_from_memory(&input_bytes_raw)
            .map_err(|e| AppError::Other(format!("Image decode: {e}")))?;

        // 1. Resizing
        if resize_width.is_some() || resize_height.is_some() {
            let (orig_w, orig_h) = img.dimensions();
            let (new_w, new_h) = match (resize_width, resize_height) {
                (Some(w), Some(h)) => (w, h),
                (Some(w), None) => (w, (orig_h as f64 * (w as f64 / orig_w as f64)) as u32),
                (None, Some(h)) => ((orig_w as f64 * (h as f64 / orig_h as f64)) as u32, h),
                (None, None) => (orig_w, orig_h),
            };
            img = img.resize(new_w, new_h, image::imageops::FilterType::Lanczos3);
        }

        // 2. Watermarking
        if let Some(ref wm_path) = watermark_path {
            if std::path::Path::new(wm_path).exists() {
                if let Ok(wm_img) = image::open(wm_path) {
                    let (main_w, main_h) = img.dimensions();
                    let (wm_w, wm_h) = wm_img.dimensions();

                    let pos = watermark_pos.clone().unwrap_or_else(|| "bottomRight".to_string());
                    let (start_x, start_y) = match pos.as_str() {
                        "topLeft" => (10, 10),
                        "topRight" => (main_w.saturating_sub(wm_w).saturating_sub(10), 10),
                        "bottomLeft" => (10, main_h.saturating_sub(wm_h).saturating_sub(10)),
                        "center" => (main_w.saturating_sub(wm_w) / 2, main_h.saturating_sub(wm_h) / 2),
                        _ => (main_w.saturating_sub(wm_w).saturating_sub(10), main_h.saturating_sub(wm_h).saturating_sub(10)), // bottomRight
                    };

                    let mut base = img.to_rgba8();
                    let wm = wm_img.to_rgba8();
                    let opacity = watermark_opacity.unwrap_or(1.0);

                    for y in 0..wm_h {
                        for x in 0..wm_w {
                            let px = x + start_x;
                            let py = y + start_y;
                            if px < main_w && py < main_h {
                                let mut wm_pixel = *wm.get_pixel(x, y);
                                wm_pixel[3] = (wm_pixel[3] as f32 * opacity) as u8;

                                let mut base_pixel = *base.get_pixel(px, py);
                                let a_wm = wm_pixel[3] as f32 / 255.0;
                                let a_base = base_pixel[3] as f32 / 255.0;
                                let a_out = a_wm + a_base * (1.0 - a_wm);
                                if a_out > 0.0 {
                                    for c in 0..3 {
                                        base_pixel[c] = (((wm_pixel[c] as f32 * a_wm) + (base_pixel[c] as f32 * a_base * (1.0 - a_wm))) / a_out) as u8;
                                    }
                                    base_pixel[3] = (a_out * 255.0) as u8;
                                    base.put_pixel(px, py, base_pixel);
                                }
                            }
                        }
                    }
                    img = DynamicImage::ImageRgba8(base);
                }
            }
        }

        match effective_ext_c.as_str() {
            "jpg" | "jpeg" | "bmp" | "tiff" => encode_jpeg(&img, p.jpeg_quality),
            "png"                             => encode_png(&img, p.png_opt_level),
            "webp"                            => encode_webp(&img, p.webp_quality, p.lossless),
            _                                 => unreachable!("filtered by image_output_ext above"),
        }
    })
    .await
    .map_err(|e| AppError::Other(format!("Task panic: {e}")))?;

    let compressed = compressed?;
    let output_size = compressed.len() as u64;

    // Output-larger-than-input guard: keep the original when compression fails to shrink
    // Bypassed if the user explicitly requested a format conversion (target_format is Some and differs from input_ext)
    let is_converted = target_format.is_some() && target_format.as_ref().unwrap().to_lowercase() != input_ext.to_lowercase();
    if output_size >= input_size && !is_converted {
        return Ok(CompressResult {
            output_path: input_path,
            output_bytes: input_size,
            output_larger: true,
        });
    }

    // Write via .part temp file then atomic rename (same pattern as audio/video)
    let temp_path = {
        let p = Path::new(&output_path);
        let parent = p.parent().unwrap_or(Path::new("."));
        let stem   = p.file_stem().and_then(|s| s.to_str()).unwrap_or("output");
        let ext    = p.extension().and_then(|e| e.to_str())
                      .map(|e| format!(".{e}")).unwrap_or_default();
        parent.join(format!("{stem}.part{ext}"))
              .to_string_lossy()
              .into_owned()
    };

    std::fs::write(&temp_path, &compressed)?;

    if Path::new(&output_path).exists() {
        std::fs::remove_file(&output_path)?;
    }
    let mut retries = 5;
    loop {
        match std::fs::rename(&temp_path, &output_path) {
            Ok(_) => break,
            Err(e) if e.raw_os_error() == Some(32) && retries > 0 => {
                // Since this is in an async fn but not blocking the tokio thread entirely at this point,
                // wait... wait, this is just async fn, we can use tokio::time::sleep
                tokio::time::sleep(std::time::Duration::from_millis(100)).await;
                retries -= 1;
            }
            Err(e) => return Err(AppError::Other(format!("Failed to move output file: {e}"))),
        }
    }

    // Emit 100% progress so the channel handler fires and any UI bound to it updates
    let _ = on_progress.send(ProgressEvent {
        job_id: job_id.clone(),
        fraction: 1.0,
        fps: None,
        speed: None,
        eta_sec: None,
        current_bytes: Some(output_size),
    });

    Ok(CompressResult {
        output_path,
        output_bytes: output_size,
        output_larger: false,
    })
}
