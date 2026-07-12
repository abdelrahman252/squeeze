import { X, RotateCcw, Settings2 } from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { CompressionPreset, JobOverrides } from "@/types";
import { cn } from "@/lib/utils";
import { formatBytesExact, middleTruncate, parentDirName, formatEta, probeLabel } from "@/lib/format";
import { kindBadgeColor, kindLabel } from "@/lib/kinds";
import { useJob, useJobsStore } from "@/store/jobs";
import { usePreset, useSettingsStore } from "@/store/settings";
import { useActiveTab } from "@/store/ui";
import { estimateOutputBytes } from "@/lib/estimate";
import { cancelJob } from "@/lib/tauri";
import { DoneCard } from "./DoneCard";
import { Thumbnail } from "./Thumbnail";
import { useTranslation } from "@/lib/i18n";

// ── Job row ───────────────────────────────────────────────────────────────────

export function JobRow({ jobId }: { jobId: string }) {
  const { t } = useTranslation();
  const job    = useJob(jobId);
  const preset = usePreset();
  const [expanded, setExpanded] = useState(false);

  const globalVideoFormat = useSettingsStore(s => s.globalVideoFormat);
  const globalImageFormat = useSettingsStore(s => s.globalImageFormat);
  const globalAudioFormat = useSettingsStore(s => s.globalAudioFormat);
  const activeTab = useActiveTab();

  if (!job) return null;

  const globalFormat = job.kind === "video" ? globalVideoFormat
    : job.kind === "audio" ? globalAudioFormat
    : job.kind === "image" ? globalImageFormat
    : undefined;
  const targetFormat = job.overrides?.targetFormat || globalFormat || null;
  const inputExt = job.inputPath.split(".").pop()?.toUpperCase() || "";

  // Done → collapse to compact DoneCard (layout animation handled by parent)
  if (job.status === "done") return <DoneCard job={job} />;

  const isFailed   = job.status === "failed";
  const isEncoding = job.status === "encoding";
  const isProbing  = job.status === "probing" || job.status === "thumbnailing";
  const meta       = probeLabel(job.probe, job.kind);
  const dirName    = parentDirName(job.inputPath);
  const displayName = middleTruncate(job.name, 50);

  const effectivePreset = job.overrides?.preset || preset;
  const estimateBytes = estimateOutputBytes(
    { kind: job.kind, sizeBytes: job.inputBytes, probe: job.probe },
    effectivePreset,
  );
  
  let estimateLabel = "—";
  if (job.kind === "video" && job.overrides?.targetFileSize) {
    estimateLabel = `~${job.overrides.targetFileSize} MB`;
  } else if (estimateBytes !== undefined) {
    estimateLabel = `~${formatBytesExact(estimateBytes)}`;
  } else if (job.kind === "pdf") {
    estimateLabel = "";
  }
  const codecBadge =
    job.kind === "video" && job.probe?.videoCodec
      ? job.probe.videoCodec.toUpperCase()
      : null;

  // ── Failed state ────────────────────────────────────────────────────────────
  if (isFailed) {
    return (
      <div 
        className="flex items-center gap-3 px-3 py-2 rounded-lg bg-bg-panel border border-border-sub opacity-70 group"
        onMouseEnter={() => useJobsStore.getState().setHoveredJob(jobId)}
        onMouseLeave={() => useJobsStore.getState().setHoveredJob(null)}
      >
        <Thumbnail job={job} />
        <div className="flex flex-col flex-1 min-w-0 gap-0.5">
          <span className="text-sm font-medium text-text-sub truncate" title={job.name}>
            {displayName}
          </span>
          <div className="flex items-center gap-2 text-xs">
            <span className="font-mono text-text-sub">{formatBytesExact(job.inputBytes)}</span>
            <span className="text-text-sub">·</span>
            <span className="text-red-500 font-medium">{t("statusFailed")}</span>
          </div>
          {job.errorMessage && (
            <span className="text-[10px] text-text-sub truncate max-w-xs" title={job.errorMessage}>
              {job.errorMessage}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <button
            onClick={() => useJobsStore.getState().retryJob(jobId)}
            className="p-1 rounded hover:bg-bg-panel-hover text-text-sub hover:text-main cursor-pointer"
            aria-label="Retry"
            title="Retry"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => useJobsStore.getState().removeJob(jobId)}
            className="p-1 rounded hover:bg-bg-panel-hover text-text-sub hover:text-main cursor-pointer"
            aria-label={t("removeFile")}
            title={t("removeFile")}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    );
  }

  // ── Normal / encoding state ─────────────────────────────────────────────────
  return (
    <div 
      className="flex flex-col rounded-lg bg-bg-panel border border-border-sub hover:bg-bg-panel-hover transition-colors group overflow-hidden"
      onMouseEnter={() => useJobsStore.getState().setHoveredJob(jobId)}
      onMouseLeave={() => useJobsStore.getState().setHoveredJob(null)}
    >
      <div className="relative flex items-start gap-3 px-3 py-2">
        <Thumbnail job={job} />

      <div className="flex flex-col flex-1 min-w-0 gap-0.5">
        <span className="text-sm font-medium text-main truncate" title={job.name}>
          {displayName}
        </span>

        <div className="flex items-center gap-1.5 flex-wrap text-xs text-text-sub">
          {activeTab === "convert" && (
            <span className="inline-flex items-center gap-1 bg-emerald-950/40 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold uppercase tracking-wider leading-none mr-0.5 shrink-0">
              {inputExt}
              <span className="text-emerald-500 font-bold font-sans">→</span>
              {targetFormat ? targetFormat.toUpperCase() : inputExt}
            </span>
          )}
          {dirName && (
            <>
              <span className="text-[10px] text-text-sub">{dirName}</span>
              <span className="text-text-sub">·</span>
            </>
          )}
          <span className="font-mono">{formatBytesExact(job.inputBytes)}</span>
          {meta && (
            <>
              <span className="text-text-sub">·</span>
              <span className="font-mono">{meta}</span>
            </>
          )}
          {codecBadge && (
            <span className="font-mono text-[10px] border border-border-main text-text-sub px-1 py-0.5 rounded uppercase tracking-wide leading-none">
              {codecBadge}
            </span>
          )}
        </div>

        {/* Progress bar — encoding only */}
        {isEncoding && (
          <div className="mt-1 flex flex-col gap-0.5">
            <div className="h-1 w-full rounded-full bg-bg-card overflow-hidden">
              {(job.kind === "image" || job.kind === "pdf") ? (
                <div className="h-full w-full rounded-full bg-gradient-to-r from-emerald-500 via-cyan-500 to-emerald-500 bg-[length:200%_100%] animate-[pulse_1.5s_ease-in-out_infinite]" />
              ) : (
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500 transition-[width] duration-300"
                  style={{ width: `${job.progress ?? 0}%` }}
                />
              )}
            </div>
            {!(job.kind === "image" || job.kind === "pdf") && (
              <div className="flex items-center gap-2 text-[10px] text-text-sub font-mono tabular-nums">
                <span>{job.progress ?? 0}%</span>
                {job.speed && <span>{job.speed}</span>}
                {job.etaSec !== undefined && job.etaSec > 0 && (
                  <span>ETA {formatEta(job.etaSec)}</span>
                )}
              </div>
            )}
            {(job.kind === "image" || job.kind === "pdf" || (job.kind === "video" && activeTab === "enhance")) && (
              <div className="flex items-center gap-2 text-[10px] text-text-sub font-mono">
                <span className="animate-pulse">
                  {activeTab === "remove-bg"
                    ? t("statusProcessingBg")
                    : activeTab === "enhance"
                    ? t("statusEnhancing")
                    : t("statusCompressing")}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Estimated output size or Probing label */}
      {estimateLabel && (
        <span className={cn(
          "font-mono text-xs font-medium whitespace-nowrap tabular-nums shrink-0 self-start mt-0.5",
          isProbing ? "text-text-sub animate-pulse italic" : "text-emerald-400"
        )}>
          {isProbing ? t("statusAnalyzing") : estimateLabel}
        </span>
      )}

      {/* Kind badge */}
      <span
        className={cn(
          "text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide shrink-0 w-[4.5rem] inline-flex items-center justify-center self-start mt-0.5",
          kindBadgeColor(job.kind),
        )}
      >
        {kindLabel(job.kind)}
      </span>

      {/* Remove / cancel button */}
      <div className="flex items-center gap-1 shrink-0 opacity-60 group-hover:opacity-100 transition-opacity self-start mt-0.5">
        <button
          onClick={() => setExpanded(!expanded)}
          className="p-1 rounded hover:bg-bg-panel-hover text-text-sub hover:text-main cursor-pointer"
          aria-label="Settings"
        >
          <Settings2 className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={async () => {
            if (isEncoding) await cancelJob(jobId).catch(() => {});
            useJobsStore.getState().removeJob(jobId);
          }}
          className="p-1 rounded hover:bg-bg-panel-hover text-text-sub hover:text-main cursor-pointer"
          aria-label={isEncoding ? "Cancel compression" : t("removeFile")}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="px-3 pb-2 flex flex-col"
          >
            <div className="pt-2 border-t border-border-main">
              <JobRowSettings jobId={jobId} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function JobRowSettings({ jobId }: { jobId: string }) {
  const { t } = useTranslation();
  const job = useJob(jobId);
  if (!job) return null;

  const overrides = job.overrides || {};
  const update = (patch: Partial<JobOverrides>) => useJobsStore.getState().updateJobOverrides(jobId, patch);

  if (job.kind === "video") {
    return (
      <div className="flex items-center gap-4 text-xs text-main flex-wrap">
        <label className="flex items-center gap-2 cursor-pointer">
          {t("targetSize")}
          <select 
            value={overrides.targetFileSize || ""} 
            onChange={e => update({ targetFileSize: e.target.value ? parseInt(e.target.value) : undefined })}
            className="bg-bg-app border border-border-main rounded-md px-2 py-1.5 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all cursor-pointer hover:border-zinc-500 text-main"
          >
            <option value="" className="bg-bg-app">{t("none")}</option>
            <option value="8" className="bg-bg-app">8MB (Discord)</option>
            <option value="25" className="bg-bg-app">25MB (Discord)</option>
            <option value="50" className="bg-bg-app">50MB (Discord)</option>
            <option value="512" className="bg-bg-app">512MB (Twitter)</option>
          </select>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          {t("codec")}
          <select 
            value={overrides.codec || ""} 
            onChange={e => update({ codec: e.target.value || undefined })}
            className="bg-bg-app border border-border-main rounded-md px-2 py-1.5 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all cursor-pointer hover:border-zinc-500 text-main"
          >
            <option value="" className="bg-bg-app">{t("default")}</option>
            <option value="h264" className="bg-bg-app">H.264</option>
            <option value="h265" className="bg-bg-app">H.265 / HEVC</option>
            <option value="av1" className="bg-bg-app">AV1</option>
          </select>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          {t("format")}
          <select 
            value={overrides.targetFormat || ""} 
            onChange={e => update({ targetFormat: e.target.value || undefined })}
            className="bg-bg-app border border-border-main rounded-md px-2 py-1.5 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all cursor-pointer hover:border-zinc-500 text-main"
          >
            <option value="" className="bg-bg-app">{t("original")}</option>
            <option value="mp4" className="bg-bg-app">MP4</option>
            <option value="webm" className="bg-bg-app">WebM</option>
          </select>
        </label>
      </div>
    );
  }

  if (job.kind === "image") {
    return (
      <div className="flex items-center gap-4 text-xs text-main flex-wrap">
        <label className="flex items-center gap-2 cursor-pointer">
          {t("format")}
          <select 
            value={overrides.targetFormat || ""} 
            onChange={e => update({ targetFormat: e.target.value || undefined })}
            className="bg-bg-app border border-border-main rounded-md px-2 py-1.5 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all cursor-pointer hover:border-zinc-500 text-main"
          >
            <option value="" className="bg-bg-app">{t("original")}</option>
            <option value="jpeg" className="bg-bg-app">JPEG</option>
            <option value="png" className="bg-bg-app">PNG</option>
            <option value="webp" className="bg-bg-app">WebP</option>
          </select>
        </label>
        <label className="flex items-center gap-2 cursor-pointer group">
          <div className="relative flex items-center">
            <input 
              type="checkbox" 
              checked={overrides.resize !== false} 
              onChange={e => update({ resize: e.target.checked })} 
              className="peer appearance-none w-4 h-4 rounded-[4px] border border-border-main bg-bg-app checked:bg-emerald-500 checked:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 transition-all cursor-pointer"
            />
            <svg className="absolute w-3 h-3 text-white left-0.5 top-0.5 pointer-events-none opacity-0 peer-checked:opacity-100 transition-opacity" viewBox="0 0 14 14" fill="none">
              <path d="M3 8L6 11L11 3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <span className="group-hover:text-main transition-colors">{t("allowResize")}</span>
        </label>
      </div>
    );
  }

  if (job.kind === "audio") {
    return (
      <div className="flex items-center gap-4 text-xs text-main flex-wrap">
        <label className="flex items-center gap-2 cursor-pointer">
          {t("presetOverride")}
          <select 
            value={overrides.preset || ""} 
            onChange={e => update({ preset: (e.target.value as CompressionPreset) || undefined })}
            className="bg-bg-app border border-border-main rounded-md px-2 py-1.5 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all cursor-pointer hover:border-zinc-500 text-main"
          >
            <option value="" className="bg-bg-app">{t("useGlobalPreset")}</option>
            <option value="less" className="bg-bg-app">{t("presetLess")}</option>
            <option value="recommended" className="bg-bg-app">{t("presetRecommended")}</option>
            <option value="extreme" className="bg-bg-app">{t("presetExtreme")}</option>
          </select>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          {t("format")}
          <select 
            value={overrides.targetFormat || ""} 
            onChange={e => update({ targetFormat: e.target.value || undefined })}
            className="bg-bg-app border border-border-main rounded-md px-2 py-1.5 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all cursor-pointer hover:border-zinc-500 text-main"
          >
            <option value="" className="bg-bg-app">{t("original")}</option>
            <option value="mp3" className="bg-bg-app">MP3</option>
            <option value="m4a" className="bg-bg-app">M4A</option>
            <option value="wav" className="bg-bg-app">WAV</option>
            <option value="ogg" className="bg-bg-app">OGG</option>
          </select>
        </label>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4 text-xs text-main flex-wrap">
      <label className="flex items-center gap-2 cursor-pointer">
        {t("presetOverride")}
        <select 
          value={overrides.preset || ""} 
          onChange={e => update({ preset: (e.target.value as CompressionPreset) || undefined })}
          className="bg-bg-app border border-border-main rounded-md px-2 py-1.5 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all cursor-pointer hover:border-zinc-500 text-main"
        >
          <option value="" className="bg-bg-app">{t("useGlobalPreset")}</option>
          <option value="less" className="bg-bg-app">{t("presetLess")}</option>
          <option value="recommended" className="bg-bg-app">{t("presetRecommended")}</option>
          <option value="extreme" className="bg-bg-app">{t("presetExtreme")}</option>
        </select>
      </label>
    </div>
  );
}
