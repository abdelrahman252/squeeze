use std::path::Path;
use std::io::{Read, Write};
use std::fs::File;
use tauri::Manager;
use tauri::ipc::Channel;
use image::{DynamicImage, GenericImageView, ImageBuffer, Rgba};
use tract_onnx::prelude::*;
use tract_onnx::prelude::tract_ndarray::Array4;

use crate::error::AppError;
use crate::jobs::progress::ProgressEvent;
use crate::commands::compress_video::CompressResult;

// ─── Constants ────────────────────────────────────────────────────────────────

const U2NET_URL: &str = "https://huggingface.co/facefusion/models-3.5.0/resolve/main/u2net_general.onnx";
const U2NETP_URL: &str = "https://huggingface.co/facefusion/models-3.5.0/resolve/main/u2netp.onnx";

// ─── Helpers ──────────────────────────────────────────────────────────────────

fn parse_hex_color(hex: &str) -> Option<Rgba<u8>> {
    let clean_hex = hex.trim_start_matches('#');
    if clean_hex.len() != 6 {
        return None;
    }
    let r = u8::from_str_radix(&clean_hex[0..2], 16).ok()?;
    let g = u8::from_str_radix(&clean_hex[2..4], 16).ok()?;
    let b = u8::from_str_radix(&clean_hex[4..6], 16).ok()?;
    Some(Rgba([r, g, b, 255]))
}

fn download_model_with_progress(
    url: &str,
    dest_path: &Path,
    job_id: &str,
    on_progress: &Channel<ProgressEvent>,
) -> Result<(), AppError> {
    let response = ureq::get(url)
        .call()
        .map_err(|e| AppError::Other(format!("Failed to connect to model host: {e}")))?;

    let total_size = response
        .header("Content-Length")
        .and_then(|len| len.parse::<u64>().ok())
        .unwrap_or(1); // avoid division by zero

    let mut reader = response.into_reader();
    let mut temp_dest = File::create(dest_path.with_extension("tmp"))
        .map_err(|e| AppError::Other(format!("Failed to create temporary model file: {e}")))?;

    let mut buffer = [0; 65536]; // 64KB chunk size
    let mut downloaded = 0;
    let mut last_progress_time = std::time::Instant::now();

    loop {
        let bytes_read = reader.read(&mut buffer)
            .map_err(|e| AppError::Other(format!("Error reading model data: {e}")))?;

        if bytes_read == 0 {
            break;
        }

        temp_dest.write_all(&buffer[..bytes_read])
            .map_err(|e| AppError::Other(format!("Error writing model data: {e}")))?;

        downloaded += bytes_read as u64;

        // Throttle progress events to 100ms intervals to prevent IPC bottlenecking
        if last_progress_time.elapsed().as_millis() > 100 || downloaded == total_size {
            let fraction = downloaded as f32 / total_size as f32;
            let _ = on_progress.send(ProgressEvent {
                job_id: job_id.to_string(),
                fraction,
                fps: None,
                speed: Some(format!("{:.1} MB / {:.1} MB", downloaded as f32 / 1_000_000.0, total_size as f32 / 1_000_000.0)),
                eta_sec: None,
                current_bytes: Some(downloaded),
            });
            last_progress_time = std::time::Instant::now();
        }
    }

    std::fs::rename(dest_path.with_extension("tmp"), dest_path)
        .map_err(|e| AppError::Other(format!("Failed to finalize model file download: {e}")))?;

    Ok(())
}

fn run_segmentation(
    model_path: &Path,
    img: &DynamicImage,
) -> Result<ImageBuffer<image::Luma<u8>, Vec<u8>>, AppError> {
    let model_input_size = 320;
    let resized = img.resize_exact(model_input_size, model_input_size, image::imageops::FilterType::Triangle);
    let rgb = resized.to_rgb8();

    // U2Net normalization: (val / 255.0 - mean) / std
    // Mean: [0.485, 0.456, 0.406], Std: [0.229, 0.224, 0.225]
    let mut input_tensor = Array4::<f32>::zeros((1, 3, model_input_size as usize, model_input_size as usize));
    for y in 0..model_input_size {
        for x in 0..model_input_size {
            let pixel = rgb.get_pixel(x, y);
            let r = (pixel[0] as f32 / 255.0 - 0.485) / 0.229;
            let g = (pixel[1] as f32 / 255.0 - 0.456) / 0.224;
            let b = (pixel[2] as f32 / 255.0 - 0.406) / 0.225;

            input_tensor[[0, 0, y as usize, x as usize]] = r;
            input_tensor[[0, 1, y as usize, x as usize]] = g;
            input_tensor[[0, 2, y as usize, x as usize]] = b;
        }
    }

    // Load tract model graph and execute
    let model = tract_onnx::onnx()
        .model_for_path(model_path)
        .map_err(|e| AppError::Other(format!("Failed to load ONNX model graph: {e}")))?
        .into_optimized()
        .map_err(|e| AppError::Other(format!("Failed to optimize model graph: {e}")))?
        .into_runnable()
        .map_err(|e| AppError::Other(format!("Failed to compile runnable model: {e}")))?;

    let input = input_tensor.into_tensor();
    let result = model.run(tvec![input.into()])
        .map_err(|e| AppError::Other(format!("Model execution failure: {e}")))?;

    // Extract prediction d0 (shape: [1, 1, 320, 320])
    let output_tensor = result[0].to_plain_array_view::<f32>()
        .map_err(|e| AppError::Other(format!("Failed to map output tensor view: {e}")))?;

    let mut mask = ImageBuffer::new(model_input_size, model_input_size);
    for y in 0..model_input_size {
        for x in 0..model_input_size {
            let val = output_tensor[[0, 0, y as usize, x as usize]];
            let pixel_val = (val.clamp(0.0, 1.0) * 255.0) as u8;
            mask.put_pixel(x, y, image::Luma([pixel_val]));
        }
    }

    Ok(mask)
}

fn apply_mask(
    original_img: &DynamicImage,
    mask: &ImageBuffer<image::Luma<u8>, Vec<u8>>,
    bg_type: &str,
    bg_color: &str,
) -> Result<ImageBuffer<Rgba<u8>, Vec<u8>>, AppError> {
    let (width, height) = original_img.dimensions();

    let resized_mask = image::imageops::resize(
        mask,
        width,
        height,
        image::imageops::FilterType::Lanczos3,
    );

    let fill_color = if bg_type == "color" {
        parse_hex_color(bg_color).unwrap_or(Rgba([255, 255, 255, 255]))
    } else {
        Rgba([0, 0, 0, 0])
    };

    let mut output_img = ImageBuffer::new(width, height);
    let original_rgba = original_img.to_rgba8();

    for y in 0..height {
        for x in 0..width {
            let orig_pixel = original_rgba.get_pixel(x, y);
            let mask_val = resized_mask.get_pixel(x, y)[0] as f32 / 255.0;

            if bg_type == "color" {
                let r = (orig_pixel[0] as f32 * mask_val + fill_color[0] as f32 * (1.0 - mask_val)) as u8;
                let g = (orig_pixel[1] as f32 * mask_val + fill_color[1] as f32 * (1.0 - mask_val)) as u8;
                let b = (orig_pixel[2] as f32 * mask_val + fill_color[2] as f32 * (1.0 - mask_val)) as u8;
                let a = (orig_pixel[3] as f32 * mask_val + fill_color[3] as f32 * (1.0 - mask_val)) as u8;
                output_img.put_pixel(x, y, Rgba([r, g, b, a]));
            } else {
                let alpha = (orig_pixel[3] as f32 * mask_val) as u8;
                output_img.put_pixel(x, y, Rgba([orig_pixel[0], orig_pixel[1], orig_pixel[2], alpha]));
            }
        }
    }

    Ok(output_img)
}

// ─── Command ──────────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn remove_background(
    app: tauri::AppHandle,
    job_id: String,
    input_path: String,
    output_path: String,
    on_progress: Channel<ProgressEvent>,
    format: String,
    bg_type: String,
    bg_color: String,
    model: String,
) -> Result<CompressResult, AppError> {
    // 1. Resolve local models directory path
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| AppError::Other(e.to_string()))?;
    let models_dir = app_data_dir.join("models");
    std::fs::create_dir_all(&models_dir)?;

    // 2. Select model and check existence
    let (model_filename, model_url) = if model == "fine-detail" {
        ("u2netp.onnx", U2NETP_URL)
    } else {
        ("u2net_general.onnx", U2NET_URL)
    };
    let model_path = models_dir.join(model_filename);

    if !model_path.exists() {
        download_model_with_progress(model_url, &model_path, &job_id, &on_progress)?;
    }

    // Report starting processing status (100% progress during model execution)
    let _ = on_progress.send(ProgressEvent {
        job_id: job_id.clone(),
        fraction: 1.0,
        fps: None,
        speed: None,
        eta_sec: None,
        current_bytes: None,
    });

    // Ensure parent directory of output exists
    if let Some(parent) = Path::new(&output_path).parent() {
        std::fs::create_dir_all(parent)?;
    }

    // 3. Load original image
    let original_img = image::open(&input_path)
        .map_err(|e| AppError::Other(format!("Failed to open input image: {e}")))?;

    // 4. Run model inference to extract alpha mask
    let mask = run_segmentation(&model_path, &original_img)?;

    // 5. Apply the mask and compose background
    let output_img = apply_mask(&original_img, &mask, &bg_type, &bg_color)?;

    // 6. Encode and save the final image
    match format.as_str() {
        "jpeg" | "jpg" => {
            let rgb_img = DynamicImage::ImageRgba8(output_img).to_rgb8();
            rgb_img.save_with_format(&output_path, image::ImageFormat::Jpeg)
                .map_err(|e| AppError::Other(format!("Failed to save output JPEG: {e}")))?;
        }
        "webp" => {
            output_img.save_with_format(&output_path, image::ImageFormat::WebP)
                .map_err(|e| AppError::Other(format!("Failed to save output WebP: {e}")))?;
        }
        _ => {
            output_img.save_with_format(&output_path, image::ImageFormat::Png)
                .map_err(|e| AppError::Other(format!("Failed to save output PNG: {e}")))?;
        }
    }

    let output_bytes = std::fs::metadata(&output_path)?.len();

    Ok(CompressResult {
        output_path,
        output_bytes,
        output_larger: false,
    })
}
