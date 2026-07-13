import { useRef, useState, useEffect } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { useSelectedJob, useJobsStore } from "@/store/jobs";
import { useSettingsStore } from "@/store/settings";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { Square, Circle, Play, Pause } from "lucide-react";

export function InteractivePreview() {
  const { t } = useTranslation();
  const job = useSelectedJob();
  const overlayRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  
  const [isDragging, setIsDragging] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);

  // Read current watermark removal coordinates (checking selected job's overrides, falling back to global settings)
  const removeWatermarkX = job?.overrides?.removeWatermarkX ?? useSettingsStore.getState().removeWatermarkX ?? 75;
  const removeWatermarkY = job?.overrides?.removeWatermarkY ?? useSettingsStore.getState().removeWatermarkY ?? 5;
  const removeWatermarkW = job?.overrides?.removeWatermarkW ?? useSettingsStore.getState().removeWatermarkW ?? 20;
  const removeWatermarkH = job?.overrides?.removeWatermarkH ?? useSettingsStore.getState().removeWatermarkH ?? 10;
  const shape = job?.overrides?.removeWatermarkShape ?? useSettingsStore.getState().removeWatermarkShape ?? "box";

  // Toggle video playing state
  const handlePlayPause = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      void videoRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  useEffect(() => {
    setIsPlaying(true);
  }, [job?.id]);

  if (!job) {
    return (
      <div className="flex flex-col items-center justify-center h-[260px] mx-3 mb-4 rounded-xl border border-dashed border-zinc-800 bg-zinc-950/40 text-xs text-text-sub text-center p-4">
        <span>No file selected. Add files and select one in the queue to preview watermark removal.</span>
      </div>
    );
  }

  const isSupportedKind = job.kind === "image" || job.kind === "video";
  if (!isSupportedKind) {
    return (
      <div className="flex flex-col items-center justify-center h-[260px] mx-3 mb-4 rounded-xl border border-zinc-800 bg-zinc-950/40 text-xs text-text-sub text-center p-4">
        <span>Preview is not supported for {job.kind.toUpperCase()} files. Watermark removal only supports images and videos.</span>
      </div>
    );
  }

  const url = job.isDemoJob
    ? (job.kind === "image"
        ? "https://picsum.photos/id/1012/800/600"
        : "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4")
    : convertFileSrc(job.inputPath);

  // Mouse / Touch handlers for dragging the bounding box
  const getRelativeCoords = (clientX: number, clientY: number) => {
    if (!overlayRef.current) return { x: 0, y: 0 };
    const rect = overlayRef.current.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * 100;
    const y = ((clientY - rect.top) / rect.height) * 100;
    return {
      x: Math.max(0, Math.min(100, x)),
      y: Math.max(0, Math.min(100, y)),
    };
  };

  const handleStart = (clientX: number, clientY: number) => {
    const coords = getRelativeCoords(clientX, clientY);
    setDragStart(coords);
    setIsDragging(true);

    useJobsStore.getState().updateJobOverrides(job.id, {
      removeWatermarkX: Math.round(coords.x),
      removeWatermarkY: Math.round(coords.y),
      removeWatermarkW: 2,
      removeWatermarkH: 2,
      removeWatermarkPreset: "custom",
    });
  };

  const handleMove = (clientX: number, clientY: number) => {
    if (!isDragging || !dragStart) return;
    const coords = getRelativeCoords(clientX, clientY);
    
    const x = Math.min(dragStart.x, coords.x);
    const y = Math.min(dragStart.y, coords.y);
    const w = Math.max(2, Math.abs(dragStart.x - coords.x));
    const h = Math.max(2, Math.abs(dragStart.y - coords.y));

    useJobsStore.getState().updateJobOverrides(job.id, {
      removeWatermarkX: Math.round(x),
      removeWatermarkY: Math.round(y),
      removeWatermarkW: Math.round(w),
      removeWatermarkH: Math.round(h),
      removeWatermarkPreset: "custom",
    });
  };

  const handleEnd = () => {
    setIsDragging(false);
    setDragStart(null);
  };

  return (
    <div className="flex flex-col mx-3 mb-4 rounded-xl border border-zinc-800 bg-zinc-950 overflow-hidden relative group/preview">
      {/* Top Toolbar / Header */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-zinc-800 bg-zinc-900/60 shrink-0 select-none">
        <span className="text-[11px] font-semibold text-zinc-400 truncate max-w-[300px]">
          {t("removeWatermarkLabel")}: <span className="font-mono text-zinc-300">{job.name}</span>
        </span>
        
        {/* Shape Toggle Selector */}
        <div className="flex items-center gap-1 p-0.5 bg-zinc-950 border border-zinc-800 rounded-md shrink-0">
          <button
            title="Rectangle Blur"
            onClick={() => useJobsStore.getState().updateJobOverrides(job.id, { removeWatermarkShape: "box" })}
            className={cn(
              "p-1 rounded transition-colors cursor-pointer",
              shape === "box" ? "bg-emerald-600 text-white shadow shadow-emerald-600/30" : "text-zinc-400 hover:text-zinc-200"
            )}
          >
            <Square className="w-3.5 h-3.5" />
          </button>
          <button
            title="Circular Blur"
            onClick={() => useJobsStore.getState().updateJobOverrides(job.id, { removeWatermarkShape: "circle" })}
            className={cn(
              "p-1 rounded transition-colors cursor-pointer",
              shape === "circle" ? "bg-emerald-600 text-white shadow shadow-emerald-600/30" : "text-zinc-400 hover:text-zinc-200"
            )}
          >
            <Circle className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Preview viewport */}
      <div className="relative flex items-center justify-center h-[260px] w-full bg-zinc-950 p-2 overflow-hidden">
        <div className="relative max-h-full max-w-full select-none flex items-center justify-center">
          {job.kind === "video" ? (
            <video
              ref={videoRef}
              src={url}
              autoPlay
              loop
              muted
              playsInline
              className="max-h-[244px] max-w-full object-contain rounded-md block bg-black"
            />
          ) : (
            <img
              src={url}
              className="max-h-[244px] max-w-full object-contain rounded-md block bg-black pointer-events-none"
              alt="Preview"
            />
          )}

          {/* Interactive Bounding Box Overlay */}
          <div
            ref={overlayRef}
            className="absolute inset-0 cursor-crosshair rounded-md overflow-hidden pointer-events-auto"
            onMouseDown={(e) => {
              if (e.button !== 0) return; // Left click only
              handleStart(e.clientX, e.clientY);
            }}
            onMouseMove={(e) => handleMove(e.clientX, e.clientY)}
            onMouseUp={handleEnd}
            onMouseLeave={handleEnd}
            onTouchStart={(e) => {
              const touch = e.touches[0];
              if (touch) handleStart(touch.clientX, touch.clientY);
            }}
            onTouchMove={(e) => {
              const touch = e.touches[0];
              if (touch) handleMove(touch.clientX, touch.clientY);
            }}
            onTouchEnd={handleEnd}
          >
            {/* Visual Box/Circle representation */}
            <div
              style={{
                left: `${removeWatermarkX}%`,
                top: `${removeWatermarkY}%`,
                width: `${removeWatermarkW}%`,
                height: `${removeWatermarkH}%`,
                borderRadius: shape === "circle" ? "50%" : "4px",
              }}
              className="absolute border-2 border-emerald-500 bg-emerald-500/25 shadow-[0_0_10px_rgba(16,185,129,0.5)] transition-[border-radius] duration-200 pointer-events-none"
            />
          </div>
        </div>

        {/* Video Play/Pause Control Button */}
        {job.kind === "video" && (
          <button
            onClick={handlePlayPause}
            className="absolute bottom-3 left-3 p-1.5 rounded-full bg-black/60 hover:bg-black/80 border border-zinc-800 text-zinc-300 hover:text-white transition-all backdrop-blur-md opacity-0 group-hover/preview:opacity-100 cursor-pointer shadow-lg shadow-black/30"
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          </button>
        )}
      </div>
    </div>
  );
}
