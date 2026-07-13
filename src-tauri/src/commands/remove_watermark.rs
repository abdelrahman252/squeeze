use std::path::Path;
use tokio::io::{AsyncBufReadExt, AsyncReadExt, BufReader};
use tokio::process::Command as TokioCommand;
use tauri::ipc::Channel;

use crate::error::AppError;
use crate::jobs::progress::ProgressEvent;
use crate::commands::compress_video::{CompressResult, ActiveJobPids};
use crate::encoders::ffmpeg_sidecar_path;

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;

#[tauri::command]
pub async fn remove_watermark(
    job_id: String,
    input_path: String,
    output_path: String,
    on_progress: Channel<ProgressEvent>,
    x: u32,
    y: u32,
    w: u32,
    h: u32,
    _band: u32,
    active_jobs: tauri::State<'_, ActiveJobPids>,
) -> Result<CompressResult, AppError> {
    let ffmpeg = ffmpeg_sidecar_path();
    if !ffmpeg.exists() {
        return Err(AppError::Other(format!(
            "FFmpeg binary not found at {} — run scripts/fetch-ffmpeg.mjs",
            ffmpeg.display()
        )));
    }

    if input_path == output_path {
        return Err(AppError::Other(
            "Output path is the same as the input — change the filename pattern".into(),
        ));
    }

    if let Some(parent) = Path::new(&output_path).parent() {
        std::fs::create_dir_all(parent)?;
    }

    let temp_path = {
        let p = Path::new(&output_path);
        let parent = p.parent().unwrap_or(Path::new("."));
        let stem = p.file_stem().and_then(|s| s.to_str()).unwrap_or("output");
        let ext  = p.extension().and_then(|e| e.to_str())
                    .map(|e| format!(".{e}"))
                    .unwrap_or_default();
        parent.join(format!("{stem}.part{ext}"))
              .to_string_lossy()
              .into_owned()
    };

    let start_time = std::time::Instant::now();

    // 1. Get media dimensions (width & height)
    let (width, height) = if let Ok(img) = image::open(&input_path) {
        use image::GenericImageView;
        img.dimensions()
    } else {
        let probe = crate::probe::probe_media(input_path.clone()).await?;
        let w = probe.width.unwrap_or(1920);
        let h = probe.height.unwrap_or(1080);
        (w, h)
    };

    // 2. Map percentages to pixel values
    let mut delogo_x = (width * x) / 100;
    let mut delogo_y = (height * y) / 100;
    let mut delogo_w = (width * w) / 100;
    let mut delogo_h = (height * h) / 100;

    // Enforce 1-pixel margin from the left and top edges
    if delogo_x < 1 {
        delogo_x = 1;
    }
    if delogo_y < 1 {
        delogo_y = 1;
    }

    // FFmpeg delogo requires width and height to be at least 2 pixels
    if delogo_w < 2 { delogo_w = 2; }
    if delogo_h < 2 { delogo_h = 2; }

    // Enforce 1-pixel margin from the right edge
    if delogo_x + delogo_w > width.saturating_sub(1) {
        if width > delogo_w + 2 {
            delogo_x = width - 1 - delogo_w;
        } else {
            delogo_x = 1;
            delogo_w = width.saturating_sub(2);
        }
    }

    // Enforce 1-pixel margin from the bottom edge
    if delogo_y + delogo_h > height.saturating_sub(1) {
        if height > delogo_h + 2 {
            delogo_y = height - 1 - delogo_h;
        } else {
            delogo_y = 1;
            delogo_h = height.saturating_sub(2);
        }
    }

    // Final safety clamps
    if delogo_w < 2 { delogo_w = 2; }
    if delogo_h < 2 { delogo_h = 2; }
    if delogo_x < 1 { delogo_x = 1; }
    if delogo_y < 1 { delogo_y = 1; }

    // 3. Determine if media is video
    let in_path = Path::new(&input_path);
    let in_ext = in_path.extension().and_then(|e| e.to_str()).unwrap_or("").to_lowercase();
    let is_video = matches!(in_ext.as_str(), "mp4" | "mkv" | "mov" | "webm" | "avi" | "gif");

    // 4. Construct FFmpeg command arguments
    let mut args = vec![
        "-y".to_string(),
        "-i".to_string(),
        input_path.clone(),
    ];

    if is_video {
        args.extend([
            "-vf".to_string(),
            format!("delogo=x={}:y={}:w={}:h={}", delogo_x, delogo_y, delogo_w, delogo_h),
            "-map".to_string(),
            "0:v".to_string(),
            "-map".to_string(),
            "0:a?".to_string(),
            "-c:v".to_string(),
            "libx264".to_string(),
            "-pix_fmt".to_string(),
            "yuv420p".to_string(),
            "-c:a".to_string(),
            "copy".to_string(),
        ]);
    } else {
        args.extend([
            "-vf".to_string(),
            format!("delogo=x={}:y={}:w={}:h={}", delogo_x, delogo_y, delogo_w, delogo_h),
            "-update".to_string(),
            "1".to_string(),
        ]);
    }

    args.extend([
        "-progress".to_string(),
        "pipe:1".to_string(),
        "-nostats".to_string(),
        temp_path.clone(),
    ]);

    let mut cmd = TokioCommand::new(&ffmpeg);
    cmd.args(&args)
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped());

    #[cfg(target_os = "windows")]
    cmd.creation_flags(CREATE_NO_WINDOW);

    let mut child = cmd.spawn()
        .map_err(|e| AppError::Other(format!("Failed to spawn FFmpeg: {e}")))?;

    // Register PID
    let pid = child.id().unwrap_or(0);
    if let Ok(mut jobs) = active_jobs.0.lock() {
        jobs.insert(job_id.clone(), pid);
    }

    // Spawn task to drain stderr
    let stderr = child.stderr.take().expect("stderr is piped");
    let stderr_task = tokio::spawn(async move {
        let mut buf = Vec::new();
        let mut reader = BufReader::new(stderr);
        let _ = reader.read_to_end(&mut buf).await;
        if buf.len() > 512 {
            let start = buf.len() - 512;
            buf = buf[start..].to_vec();
        }
        String::from_utf8_lossy(&buf).trim().to_string()
    });

    if !is_video {
        // Image progress is simple: wait and report 100% when done
        let _ = on_progress.send(ProgressEvent {
            job_id: job_id.clone(),
            fraction: 0.1,
            fps: None,
            speed: Some("Removing watermark...".to_string()),
            eta_sec: None,
            current_bytes: None,
        });

        let status = child.wait().await
            .map_err(|e| AppError::Other(format!("FFmpeg image processing failed: {e}")))?;

        if !status.success() {
            let err_msg = stderr_task.await.unwrap_or_default();
            return Err(AppError::Other(format!("FFmpeg image processing failed: {err_msg}")));
        }

        let _ = on_progress.send(ProgressEvent {
            job_id: job_id.clone(),
            fraction: 1.0,
            fps: None,
            speed: Some("Finished".to_string()),
            eta_sec: None,
            current_bytes: None,
        });
    } else {
        // Video progress: stream progress from stdout line by line
        let stdout = child.stdout.take().expect("stdout is piped");
        let reader = BufReader::new(stdout);
        let mut lines = reader.lines();

        let mut out_time_us: f64 = 0.0;
        let mut out_time_ms_raw: f64 = 0.0;
        let mut fps: Option<f32> = None;
        let mut speed: Option<String> = None;
        let mut current_bytes: Option<u64> = None;

        let probe = crate::probe::probe_media(input_path.clone()).await?;
        let duration_sec = probe.duration_sec.unwrap_or(1.0);

        while let Ok(Some(line)) = lines.next_line().await {
            let Some(eq) = line.find('=') else { continue };
            let key = &line[..eq];
            let val = line[eq + 1..].trim();

            match key {
                "out_time_us" => {
                    out_time_us = val.parse().unwrap_or(out_time_us);
                }
                "out_time_ms" => {
                    out_time_ms_raw = val.parse().unwrap_or(out_time_ms_raw);
                }
                "fps" => {
                    fps = val.parse().ok().filter(|&f: &f32| f > 0.0);
                }
                "speed" => {
                    let s = val.trim_end_matches('x');
                    if s != "N/A" && s != "0" && !s.is_empty() {
                        speed = Some(format!("{}x", s));
                    }
                }
                "total_size" => {
                    current_bytes = val.parse().ok().filter(|&b: &u64| b > 0);
                }
                "progress" => {
                    if duration_sec > 0.0 {
                        let current_time_sec = if out_time_us > 0.0 {
                            out_time_us / 1_000_000.0
                        } else {
                            out_time_ms_raw / 1000.0
                        };
                        let fraction = (current_time_sec / duration_sec).clamp(0.0, 1.0) as f32;
                        let _ = on_progress.send(ProgressEvent {
                            job_id: job_id.clone(),
                            fraction,
                            fps,
                            speed: speed.clone(),
                            eta_sec: if fraction > 0.0 && fraction < 1.0 {
                                let elapsed = start_time.elapsed().as_secs_f64();
                                Some((elapsed / fraction as f64 - elapsed) as u32)
                            } else {
                                None
                            },
                            current_bytes,
                        });
                    }
                }
                _ => {}
            }
        }

        let status = child.wait().await
            .map_err(|e| AppError::Other(format!("FFmpeg video processing failed: {e}")))?;

        if !status.success() {
            let err_msg = stderr_task.await.unwrap_or_default();
            return Err(AppError::Other(format!("FFmpeg video processing failed: {err_msg}")));
        }
    }

    // Rename temp file to output path
    std::fs::rename(&temp_path, &output_path)
        .map_err(|e| AppError::Other(format!("Failed to finalize output file: {e}")))?;

    // Clean up pid registry
    if let Ok(mut jobs) = active_jobs.0.lock() {
        jobs.remove(&job_id);
    }

    let output_bytes = std::fs::metadata(&output_path)?.len();

    Ok(CompressResult {
        output_path,
        output_bytes,
        output_larger: false,
    })
}
