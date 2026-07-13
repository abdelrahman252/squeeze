import { useRef, useState, useEffect } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { useSelectedJob, useJobsStore } from "@/store/jobs";
import { useSettingsStore } from "@/store/settings";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { 
  Square, 
  Circle, 
  Play, 
  Pause, 
  ZoomIn, 
  ZoomOut, 
  Move, 
  MousePointer, 
  RefreshCw 
} from "lucide-react";

export function InteractivePreview() {
  const { t } = useTranslation();
  const job = useSelectedJob();
  const overlayRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  
  // Interactive Viewport States
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [tool, setTool] = useState<"draw" | "pan">("draw");
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);

  // Drag offsets
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [panStart, setPanStart] = useState<{ x: number; y: number } | null>(null);

  // Read coordinates
  const removeWatermarkX = job?.overrides?.removeWatermarkX ?? useSettingsStore.getState().removeWatermarkX ?? 75;
  const removeWatermarkY = job?.overrides?.removeWatermarkY ?? useSettingsStore.getState().removeWatermarkY ?? 5;
  const removeWatermarkW = job?.overrides?.removeWatermarkW ?? useSettingsStore.getState().removeWatermarkW ?? 20;
  const removeWatermarkH = job?.overrides?.removeWatermarkH ?? useSettingsStore.getState().removeWatermarkH ?? 10;
  const shape = job?.overrides?.removeWatermarkShape ?? useSettingsStore.getState().removeWatermarkShape ?? "box";

  // Spacebar pan listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        const active = document.activeElement?.tagName;
        if (active !== "INPUT" && active !== "TEXTAREA") {
          e.preventDefault();
          setIsSpacePressed(true);
        }
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        setIsSpacePressed(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  // Reset zoom on job change
  useEffect(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setIsPlaying(true);
  }, [job?.id]);

  const effectiveTool = isSpacePressed ? "pan" : tool;

  if (!job) {
    return (
      <div className="flex flex-col items-center justify-center h-[340px] rounded-xl border border-dashed border-zinc-800 bg-zinc-950/40 text-xs text-text-sub text-center p-4">
        <span>No file selected. Add files and select one in the queue to preview watermark removal.</span>
      </div>
    );
  }

  const isSupportedKind = job.kind === "image" || job.kind === "video";
  if (!isSupportedKind) {
    return (
      <div className="flex flex-col items-center justify-center h-[340px] rounded-xl border border-zinc-800 bg-zinc-950/40 text-xs text-text-sub text-center p-4">
        <span>Preview is not supported for {job.kind.toUpperCase()} files. Watermark removal only supports images and videos.</span>
      </div>
    );
  }

  const url = job.isDemoJob
    ? (job.kind === "image"
        ? "https://picsum.photos/id/1012/800/600"
        : "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4")
    : convertFileSrc(job.inputPath);

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

  // Zoom actions
  const handleZoomIn = () => {
    setZoom(prev => Math.min(8, prev + 0.5));
  };
  const handleZoomOut = () => {
    setZoom(prev => {
      const nz = Math.max(1, prev - 0.5);
      if (nz === 1) setPan({ x: 0, y: 0 });
      return nz;
    });
  };
  const handleResetZoom = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  // Coordinate converters
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

  // Mouse drag handlers
  const handleStart = (clientX: number, clientY: number) => {
    if (effectiveTool === "pan") {
      setDragStart({ x: clientX, y: clientY });
      setPanStart({ x: pan.x, y: pan.y });
      setIsDragging(true);
    } else {
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
    }
  };

  const handleMove = (clientX: number, clientY: number) => {
    if (!isDragging || !dragStart) return;

    if (effectiveTool === "pan") {
      const dx = clientX - dragStart.x;
      const dy = clientY - dragStart.y;
      if (panStart) {
        setPan({
          x: panStart.x + dx,
          y: panStart.y + dy,
        });
      }
    } else {
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
    }
  };

  const handleEnd = () => {
    setIsDragging(false);
    setDragStart(null);
    setPanStart(null);
  };

  return (
    <div className="flex flex-col flex-1 min-h-[340px] rounded-xl border border-zinc-800 bg-zinc-950 overflow-hidden relative group/preview">
      {/* Top Toolbar / Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800 bg-zinc-900/60 shrink-0 select-none flex-wrap gap-2">
        <span className="text-[11px] font-semibold text-zinc-400 truncate max-w-[200px]">
          {t("removeWatermarkLabel")}: <span className="font-mono text-zinc-300">{job.name}</span>
        </span>
        
        {/* Navigation / Drawing / Zoom Toolbar Controls */}
        <div className="flex items-center gap-3">
          {/* Tool Toggles */}
          <div className="flex items-center gap-0.5 p-0.5 bg-zinc-950 border border-zinc-800 rounded-md shrink-0">
            <button
              title="Draw Selection (Crosshair)"
              onClick={() => setTool("draw")}
              className={cn(
                "p-1 rounded transition-colors cursor-pointer",
                effectiveTool === "draw" ? "bg-emerald-600 text-white" : "text-zinc-400 hover:text-zinc-200"
              )}
            >
              <MousePointer className="w-3.5 h-3.5" />
            </button>
            <button
              title="Pan Canvas (Hand - Hold Spacebar)"
              onClick={() => setTool("pan")}
              className={cn(
                "p-1 rounded transition-colors cursor-pointer",
                effectiveTool === "pan" ? "bg-emerald-600 text-white" : "text-zinc-400 hover:text-zinc-200"
              )}
            >
              <Move className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Zoom Buttons */}
          <div className="flex items-center gap-1.5 bg-zinc-950 border border-zinc-800 rounded-md px-1.5 py-0.5 text-xs">
            <button
              onClick={handleZoomOut}
              disabled={zoom <= 1}
              className="text-zinc-400 hover:text-zinc-200 disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="font-mono text-[11px] font-semibold text-zinc-300 w-9 text-center">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={handleZoomIn}
              disabled={zoom >= 8}
              className="text-zinc-400 hover:text-zinc-200 disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleResetZoom}
              title="Fit to Screen"
              className="text-zinc-400 hover:text-zinc-200 ml-0.5 border-l border-zinc-800 pl-1.5 cursor-pointer"
            >
              <RefreshCw className="w-3 h-3" />
            </button>
          </div>

          {/* Shape Toggle Selector */}
          <div className="flex items-center gap-0.5 p-0.5 bg-zinc-950 border border-zinc-800 rounded-md shrink-0">
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
      </div>

      {/* Main Preview Viewport */}
      <div className="relative flex-1 flex items-center justify-center bg-zinc-950 p-2 overflow-hidden min-h-0">
        <div
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: "center center",
            transition: isDragging ? "none" : "transform 0.15s ease-out",
          }}
          className="relative max-h-full max-w-full select-none flex items-center justify-center"
        >
          {job.kind === "video" ? (
            <video
              ref={videoRef}
              src={url}
              autoPlay
              loop
              muted
              playsInline
              className="max-h-[300px] max-w-full object-contain rounded-md block bg-black"
            />
          ) : (
            <img
              src={url}
              className="max-h-[300px] max-w-full object-contain rounded-md block bg-black pointer-events-none"
              alt="Preview"
            />
          )}

          {/* Interactive Crop / Selection Overlay */}
          <div
            ref={overlayRef}
            className={cn(
              "absolute inset-0 rounded-md overflow-hidden pointer-events-auto",
              effectiveTool === "pan" 
                ? (isDragging ? "cursor-grabbing" : "cursor-grab") 
                : "cursor-crosshair"
            )}
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
            {/* Visual crop box border */}
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

        {/* Video Play/Pause floating controls */}
        {job.kind === "video" && (
          <button
            onClick={handlePlayPause}
            className="absolute bottom-3 left-3 p-1.5 rounded-full bg-black/60 hover:bg-black/80 border border-zinc-800 text-zinc-300 hover:text-white transition-all backdrop-blur-md opacity-0 group-hover/preview:opacity-100 cursor-pointer shadow-lg shadow-black/30 z-10"
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          </button>
        )}
      </div>
    </div>
  );
}
