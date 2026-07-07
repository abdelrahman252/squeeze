use std::collections::HashMap;
use std::sync::Mutex;
use tokio::io::{AsyncBufReadExt, AsyncReadExt, BufReader};
use tokio::process::Command as TokioCommand;

use crate::encoders::ffmpeg_args::build_video_args;
use crate::encoders::hw_detect::HwEncodersState;
use crate::encoders::ffmpeg_sidecar_path;
use crate::error::AppError;
use crate::jobs::progress::ProgressEvent;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;
#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;

// ─── Managed state ────────────────────────────────────────────────────────────

/// Maps job_id → OS PID of the running FFmpeg process.
/// Held in Tauri managed state so cancel_job can find the process.
pub struct ActiveJobPids(pub Mutex<HashMap<String, u32>>);

impl Default for ActiveJobPids {
    fn default() -> Self {
        Self(Mutex::new(HashMap::new()))
    }
}

// ─── Return type ──────────────────────────────────────────────────────────────

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CompressResult {
    /// Final output path (equals input_path when output_larger is true)
    pub output_path: String,
    pub output_bytes: u64,
    /// True when the compressed file was not smaller than the original;
    /// the original is kept and output_path == input_path.
    pub output_larger: bool,
}

// ─── compress_video ───────────────────────────────────────────────────────────

#[tauri::command]
#[allow(clippy::too_many_arguments)] // Tauri commands with managed state always exceed the 7-arg limit
pub async fn compress_video(
    job_id: String,
    input_path: String,
    output_path: String,
    preset: String,
    target_file_size: Option<u32>,
    duration_sec: Option<f64>,
    on_progress: tauri::ipc::Channel<ProgressEvent>,
    hw: tauri::State<'_, HwEncodersState>,
    active_jobs: tauri::State<'_, ActiveJobPids>,
    target_format: Option<String>,
    resize_width: Option<u32>,
    resize_height: Option<u32>,
    audio_cleanup: Option<bool>,
    auto_reframe: Option<bool>,
    watermark_path: Option<String>,
    watermark_pos: Option<String>,
    watermark_opacity: Option<f32>,
) -> Result<CompressResult, AppError> {
    let _ = target_format; // used by the output_path resolved extension on the frontend
    let ffmpeg = ffmpeg_sidecar_path();
    if !ffmpeg.exists() {
        return Err(AppError::Other(format!(
            "FFmpeg binary not found at {} — run scripts/fetch-ffmpeg.mjs",
            ffmpeg.display()
        )));
    }

    // Reject output == input to avoid clobbering the source file
    if input_path == output_path {
        return Err(AppError::Other(
            "Output path is the same as the input — change the filename pattern".into(),
        ));
    }

    // Ensure the output directory exists (handles 'subfolder' and 'custom' modes)
    if let Some(parent) = std::path::Path::new(&output_path).parent() {
        std::fs::create_dir_all(parent)?;
    }

    // Write to a temp file whose extension matches the final output so FFmpeg
    // can auto-detect the container format.  Inserting ".part" *before* the
    // extension (e.g. "out.part.mp4") avoids the "Invalid argument / unknown
    // format" error that occurs when the temp file ends in ".mp4.part".
    let temp_path = {
        let p = std::path::Path::new(&output_path);
        let parent = p.parent().unwrap_or(std::path::Path::new("."));
        let stem = p.file_stem().and_then(|s| s.to_str()).unwrap_or("output");
        let ext  = p.extension().and_then(|e| e.to_str())
                    .map(|e| format!(".{e}"))
                    .unwrap_or_default();
        parent.join(format!("{stem}.part{ext}"))
              .to_string_lossy()
              .into_owned()
    };

    let input_bytes = std::fs::metadata(&input_path)?.len();

    // Build arg list using probed HW encoder info
    let hw_info = hw.0.clone();
    let mut args = build_video_args(&preset, &hw_info, &input_path, &temp_path, true, target_file_size, duration_sec);

    // Pop the trailing output configuration flags to inject filters before them
    let output_arg = args.pop().unwrap(); // temp_path
    let nostats_arg = args.pop().unwrap(); // -nostats
    let pipe_arg = args.pop().unwrap(); // pipe:1
    let prog_arg = args.pop().unwrap(); // -progress

    // If watermark_path is provided, insert it as the second input stream (-i watermark_path)
    if let Some(ref wm_path) = watermark_path {
        if std::path::Path::new(wm_path).exists() {
            args.insert(3, "-i".to_string());
            args.insert(4, wm_path.clone());
        }
    }

    // Build filter complex string
    let mut filter_complex = String::new();

    let video_src = if auto_reframe.unwrap_or(false) {
        filter_complex.push_str("[0:v]crop=ih*9/16:ih[cropped];");
        "[cropped]"
    } else {
        "[0:v]"
    };

    let video_scaled = if let (Some(w), Some(h)) = (resize_width, resize_height) {
        filter_complex.push_str(&format!("{video_src}scale={w}:{h}[scaled];"));
        "[scaled]"
    } else if let Some(w) = resize_width {
        filter_complex.push_str(&format!("{video_src}scale={w}:-2[scaled];"));
        "[scaled]"
    } else if let Some(h) = resize_height {
        filter_complex.push_str(&format!("{video_src}scale=-2:{h}[scaled];"));
        "[scaled]"
    } else {
        video_src
    };

    let final_v_label = if watermark_path.is_some() && std::path::Path::new(watermark_path.as_ref().unwrap()).exists() {
        let opacity = watermark_opacity.unwrap_or(1.0);
        let pos = watermark_pos.clone().unwrap_or_else(|| "bottomRight".to_string());

        let xy = match pos.as_str() {
            "topLeft" => "10:10",
            "topRight" => "main_w-overlay_w-10:10",
            "bottomLeft" => "10:main_h-overlay_h-10",
            "center" => "(main_w-overlay_w)/2:(main_h-overlay_h)/2",
            _ => "main_w-overlay_w-10:main_h-overlay_h-10", // bottomRight
        };

        filter_complex.push_str(&format!("[1:v]format=rgba,colorchannelmixer=aa={opacity}[wm];"));
        filter_complex.push_str(&format!("{video_scaled}[wm]overlay={xy}[outv]"));
        "[outv]"
    } else {
        video_scaled
    };

    if !filter_complex.is_empty() {
        args.extend(["-filter_complex".into(), filter_complex]);
        args.extend(["-map".into(), final_v_label.into()]);
        args.extend(["-map".into(), "0:a?".into()]);
    }

    if audio_cleanup.unwrap_or(false) {
        args.extend(["-af".into(), "afftdn".into()]);
    }

    // Re-append the trailing output config flags
    args.push(prog_arg);
    args.push(pipe_arg);
    args.push(nostats_arg);
    args.push(output_arg);

    let mut cmd = TokioCommand::new(&ffmpeg);
    cmd.args(&args)
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped()); // piped so we can include in error messages

    // Windows: prevent a black CMD box from flashing on screen
    #[cfg(target_os = "windows")]
    cmd.creation_flags(CREATE_NO_WINDOW);

    let mut child = cmd
        .spawn()
        .map_err(|e| AppError::Other(format!("Failed to spawn FFmpeg: {e}")))?;

    // Register PID for possible cancellation via cancel_job
    let pid = child.id().unwrap_or(0);
    if let Ok(mut jobs) = active_jobs.0.lock() {
        jobs.insert(job_id.clone(), pid);
    }

    // Drain stderr in a background task so the pipe buffer never fills and
    // deadlocks the process.  We read the last 512 bytes for error messages.
    let stderr = child.stderr.take().expect("stderr is piped");
    let stderr_task = tokio::spawn(async move {
        let mut buf = Vec::new();
        let mut reader = BufReader::new(stderr);
        let _ = reader.read_to_end(&mut buf).await;
        // Keep only the last 512 bytes to avoid huge allocations on verbose output
        if buf.len() > 512 {
            let start = buf.len() - 512;
            buf = buf[start..].to_vec();
        }
        String::from_utf8_lossy(&buf).trim().to_string()
    });

    // ── Stream progress from stdout ───────────────────────────────────────────
    let stdout = child.stdout.take().expect("stdout is piped");
    let reader = BufReader::new(stdout);
    let mut lines = reader.lines();

    let mut out_time_us: f64 = 0.0; // microseconds from out_time_us key
    let mut out_time_ms_raw: f64 = 0.0; // milliseconds from out_time_ms key (backup)
    let mut fps: Option<f32> = None;
    let mut speed: Option<String> = None;
    let mut current_bytes: Option<u64> = None;

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
                // "N/A" or "0" → treat as unknown
                if s != "N/A" && s != "0" && !s.is_empty() {
                    speed = Some(format!("{}x", s));
                }
            }
            "total_size" => {
                current_bytes = val.parse().ok().filter(|&b: &u64| b > 0);
            }
            "progress" => {
                // End of one -progress block → compute fraction and emit event
                let elapsed_us = if out_time_us > 0.0 {
                    out_time_us
                } else {
                    out_time_ms_raw * 1_000.0
                };

                let fraction = duration_sec
                    .filter(|&d| d > 0.0)
                    .map(|d| (elapsed_us / (d * 1_000_000.0)).clamp(0.0, 1.0) as f32)
                    .unwrap_or(0.0);

                let eta_sec = speed
                    .as_deref()
                    .and_then(|s| s.trim_end_matches('x').parse::<f64>().ok())
                    .filter(|&sv| sv > 0.0)
                    .and_then(|sv| {
                        duration_sec.map(|d| {
                            (((1.0 - fraction as f64) * d) / sv).max(0.0) as u32
                        })
                    });

                let _ = on_progress.send(ProgressEvent {
                    job_id: job_id.clone(),
                    fraction,
                    fps,
                    speed: speed.clone(),
                    eta_sec,
                    current_bytes,
                });
            }
            _ => {}
        }
    }

    // ── Wait for process exit ─────────────────────────────────────────────────
    let status = child
        .wait()
        .await
        .map_err(|e| AppError::Other(format!("FFmpeg process error: {e}")))?;

    // Collect stderr output (task already finished since child has exited)
    let stderr_output = stderr_task.await.unwrap_or_default();

    // De-register PID
    if let Ok(mut jobs) = active_jobs.0.lock() {
        jobs.remove(&job_id);
    }

    if !status.success() {
        let _ = std::fs::remove_file(&temp_path);
        let msg = if stderr_output.is_empty() {
            "Compression failed or was cancelled".into()
        } else {
            // Surface the last line of FFmpeg's stderr as the error message
            let last = stderr_output.lines().last().unwrap_or(&stderr_output);
            format!("FFmpeg: {last}")
        };
        return Err(AppError::Other(msg));
    }

    // ── Output-larger-than-input guard ────────────────────────────────────────
    let output_bytes = std::fs::metadata(&temp_path)
        .map(|m| m.len())
        .unwrap_or(0);

    let input_ext = std::path::Path::new(&input_path)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();
    let is_converted = target_format.is_some() && target_format.as_ref().unwrap().to_lowercase() != input_ext.to_lowercase();
    if output_bytes >= input_bytes && !is_converted {
        // Compressed file is not smaller — discard it and keep the original
        let _ = std::fs::remove_file(&temp_path);
        return Ok(CompressResult {
            output_path: input_path,
            output_bytes: input_bytes,
            output_larger: true,
        });
    }

    // ── Commit: rename .part → final output ───────────────────────────────────
    if std::path::Path::new(&output_path).exists() {
        std::fs::remove_file(&output_path)?;
    }
    let mut retries = 5;
    loop {
        match std::fs::rename(&temp_path, &output_path) {
            Ok(_) => break,
            Err(e) if e.raw_os_error() == Some(32) && retries > 0 => {
                tokio::time::sleep(std::time::Duration::from_millis(100)).await;
                retries -= 1;
            }
            Err(e) => return Err(AppError::Other(format!("Failed to move output file: {e}"))),
        }
    }

    Ok(CompressResult {
        output_path,
        output_bytes,
        output_larger: false,
    })
}

// ─── cancel_job ───────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn cancel_job(
    job_id: String,
    active_jobs: tauri::State<'_, ActiveJobPids>,
) -> Result<(), AppError> {
    let pid = active_jobs.0.lock().ok().and_then(|jobs| jobs.get(&job_id).copied());
    if let Some(pid) = pid {
        kill_process(pid);
    }
    Ok(())
}

#[cfg(target_os = "windows")]
fn kill_process(pid: u32) {
    let _ = std::process::Command::new("taskkill")
        .args(["/PID", &pid.to_string(), "/F"])
        .creation_flags(CREATE_NO_WINDOW)
        .output();
}

#[cfg(not(target_os = "windows"))]
fn kill_process(pid: u32) {
    let _ = std::process::Command::new("kill")
        .args(["-INT", &pid.to_string()])
        .output();
}
