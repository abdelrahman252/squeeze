import { Channel } from "@tauri-apps/api/core";
import { useJobsStore } from "@/store/jobs";
import { useSettingsStore } from "@/store/settings";
import { compressAudio, compressImage, compressPdf, compressVideo, removeBackground, enhanceMedia, removeWatermark } from "@/lib/tauri";
import type { VideoProgressEvent } from "@/lib/tauri";
import { buildOutputPath } from "@/lib/outputPath";
import { useUiStore } from "@/store/ui";

/**
 * Extract a human-readable string from whatever Tauri throws on command failure.
 *
 * Tauri rejects with a serialised AppError object: { kind: "Other", message: "…" }
 * rather than a JS Error instance, so we probe for `.message` first.
 */
function extractErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (
    err !== null &&
    typeof err === "object" &&
    "message" in err &&
    typeof (err as Record<string, unknown>).message === "string"
  ) {
    return (err as Record<string, unknown>).message as string;
  }
  return String(err);
}

/**
 * Start compression for every "ready" video or audio job in the queue.
 *
 * All eligible jobs are fired concurrently.  Each gets its own Channel so
 * progress events are routed atomically to the correct row — no extra UI code
 * needed for audio because it reuses the identical state machine.
 *
 * Audio note: the Rust command may change the output file extension
 * (e.g. WAV → mp3).  CompressResult.outputPath always reflects the actual
 * file written on disk, so the store is always consistent.
 */
export async function startSqueeze(): Promise<void> {
  const { jobs, jobIds } = useJobsStore.getState();
  const { 
    preset, 
    outputMode, 
    filenamePattern, 
    customOutputDir,
    globalVideoFormat,
    globalImageFormat,
    globalAudioFormat,
    compressOnConvert,
    removeBgFormat,
    removeBgBgType,
    removeBgBgColor,
    removeBgModel,
    enhanceScale,
    enhanceFormat,
    enhanceCompress,
    removeWatermarkX,
    removeWatermarkY,
    removeWatermarkW,
    removeWatermarkH,
    removeWatermarkBand,
  } = useSettingsStore.getState();

  const activeTab = useUiStore.getState().activeTab;
  const isConvertMode = activeTab === "convert";
  const isRemoveBgMode = activeTab === "remove-bg";
  const isEnhanceMode = activeTab === "enhance";
  const isRemoveWatermarkMode = activeTab === "remove-watermark";

  // Collect ready video + audio + image + pdf jobs
  const readyIds = jobIds.filter((id) => {
    const job = jobs[id];
    if (!job || job.status !== "ready") return false;
    if (isRemoveBgMode) {
      return job.kind === "image";
    }
    if (isEnhanceMode || isRemoveWatermarkMode) {
      // AI upscaling and watermark removal work on images and videos
      return job.kind === "image" || job.kind === "video";
    }
    return (
      job.kind === "video" ||
      job.kind === "audio" ||
      job.kind === "image" ||
      job.kind === "pdf"
    );
  });

  if (readyIds.length === 0) return;

  // Transition all to "encoding" before spawning so the UI reacts immediately
  for (const id of readyIds) {
    useJobsStore.getState().transitionStatus(id, "encoding");
  }

  const parallelLimit = useSettingsStore.getState().parallelJobs || 4;
  const executing = new Set<Promise<void>>();

  for (const jobId of readyIds) {
    const p = (async () => {
      const job = useJobsStore.getState().jobs[jobId];
      if (!job) return;

      if (job.isDemoJob) {
        const duration = 2500;
        const steps = 25;
        const interval = duration / steps;
        for (let i = 1; i <= steps; i++) {
          await new Promise((resolve) => setTimeout(resolve, interval));
          useJobsStore.getState().updateJobProgress(jobId, {
            progress: Math.round((i / steps) * 100),
            speed: "Simulated 1.4x",
            etaSec: Math.round(((steps - i) * interval) / 1000),
            outputBytes: Math.round(job.inputBytes * 0.35 * (i / steps)),
          });
        }
        const fakeOutputPath = job.kind === "image"
          ? "demo://sample_photo_compressed.jpg"
          : "demo://promo_video_compressed.mp4";

        useJobsStore.getState().setJobOutput(
          jobId,
          fakeOutputPath,
          Math.round(job.inputBytes * 0.35),
          activeTab,
        );
        return;
      }

      const globalFormat = isConvertMode
        ? (job.kind === "video" ? globalVideoFormat
          : job.kind === "audio" ? globalAudioFormat
          : job.kind === "image" ? globalImageFormat
          : undefined)
        : undefined;

      const targetFormat = isRemoveBgMode
        ? (removeBgFormat || null)
        : isEnhanceMode
        ? (enhanceFormat === "original" ? null : enhanceFormat || null)
        : isRemoveWatermarkMode
        ? null
        : (job.overrides?.targetFormat || globalFormat || null);

      const outputPath = buildOutputPath(
        job.inputPath,
        outputMode,
        filenamePattern,
        customOutputDir,
        targetFormat || undefined,
      );

      // Each job gets its own channel — events carry jobId so routing is exact
      const channel = new Channel<VideoProgressEvent>();
      channel.onmessage = (ev) => {
        useJobsStore.getState().updateJobProgress(jobId, {
          progress: Math.round(ev.fraction * 100),
          speed: ev.speed,
          etaSec: ev.etaSec,
          outputBytes: ev.currentBytes,
        });
      };

      const targetPreset = isConvertMode
        ? (job.kind === "pdf" ? "lossless" : (compressOnConvert ? preset : "convert"))
        : preset;

      try {
        let result;

        if (isEnhanceMode) {
          result = await enhanceMedia(
            jobId,
            job.inputPath,
            outputPath,
            channel,
            enhanceScale || 4,
            enhanceFormat || "original",
            enhanceCompress ?? true,
            preset,
          );
        } else if (isRemoveBgMode) {
          result = await removeBackground(
            jobId,
            job.inputPath,
            outputPath,
            channel,
            removeBgFormat || "png",
            removeBgBgType || "transparent",
            removeBgBgColor || "#ffffff",
            removeBgModel || "general",
          );
        } else if (isRemoveWatermarkMode) {
          result = await removeWatermark(
            jobId,
            job.inputPath,
            outputPath,
            channel,
            removeWatermarkX ?? 75,
            removeWatermarkY ?? 5,
            removeWatermarkW ?? 20,
            removeWatermarkH ?? 10,
            removeWatermarkBand ?? 4,
          );
        } else if (job.kind === "image") {
          const { resizeWidth, resizeHeight, watermarkPath, watermarkPos, watermarkOpacity } = useSettingsStore.getState();
          result = await compressImage(
            jobId,
            job.inputPath,
            outputPath,
            targetPreset,
            job.probe?.durationSec ?? null,
            channel,
            targetFormat,
            resizeWidth ?? null,
            resizeHeight ?? null,
            watermarkPath ?? null,
            watermarkPos ?? null,
            watermarkOpacity ?? null,
          );
        } else if (job.kind === "audio") {
          const { audioCleanup } = useSettingsStore.getState();
          result = await compressAudio(
            jobId,
            job.inputPath,
            outputPath,
            targetPreset,
            job.probe?.durationSec ?? null,
            channel,
            targetFormat,
            audioCleanup,
          );
        } else if (job.kind === "video") {
          const { resizeWidth, resizeHeight, audioCleanup, autoReframe, watermarkPath, watermarkPos, watermarkOpacity } = useSettingsStore.getState();
          const targetFileSize = job.overrides?.targetFileSize ?? null;
          result = await compressVideo(
            jobId,
            job.inputPath,
            outputPath,
            targetPreset,
            job.probe?.durationSec ?? null,
            channel,
            targetFileSize,
            targetFormat,
            resizeWidth ?? null,
            resizeHeight ?? null,
            audioCleanup,
            autoReframe,
            watermarkPath ?? null,
            watermarkPos ?? null,
            watermarkOpacity ?? null,
          );
        } else {
          result = await compressPdf(
            jobId,
            job.inputPath,
            outputPath,
            targetPreset,
            job.probe?.durationSec ?? null,
            channel,
          );
        }

        // result.outputLarger: compressed ≥ original — original was kept
        useJobsStore.getState().setJobOutput(
          jobId,
          result.outputPath,
          result.outputBytes,
          activeTab,
        );
      } catch (err) {
        useJobsStore.getState().setJobError(jobId, extractErrorMessage(err));
      }
    })().finally(() => executing.delete(p));

    executing.add(p);
    if (executing.size >= parallelLimit) {
      await Promise.race(executing);
    }
  }

  await Promise.all(executing);
}
