import { open } from "@tauri-apps/plugin-dialog";
import { v4 as uuidv4 } from "uuid";
import { Upload, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { fileKindFromPath } from "@/lib/kinds";
import { getPathInfo } from "@/lib/tauri";
import { useJobsStore } from "@/store/jobs";
import type { NewJobInput } from "@/store/jobs";
import { EmptyState } from "./EmptyState";
import { useTranslation } from "@/lib/i18n";
import { useActiveTab } from "@/store/ui";

const VIDEO_EXTS = ["mp4", "mov", "mkv", "webm", "avi", "m4v", "wmv", "flv"];
const AUDIO_EXTS = ["mp3", "m4a", "aac", "wav", "flac", "ogg", "opus", "wma"];
const IMAGE_EXTS = ["jpg", "jpeg", "png", "webp", "heic", "heif", "avif", "bmp", "tiff"];
const PDF_EXTS   = ["pdf"];
const ALL_EXTS   = [...VIDEO_EXTS, ...AUDIO_EXTS, ...IMAGE_EXTS, ...PDF_EXTS];

interface DropzoneProps {
  isDraggingOver: boolean;
  hasFiles: boolean;
}

export function Dropzone({ isDraggingOver, hasFiles }: DropzoneProps) {
  const { t } = useTranslation();
  const activeTab = useActiveTab();

  async function handleOpenDialog() {
    if (typeof window === "undefined" || !(window as any).__TAURI_INTERNALS__ || !(window as any).__TAURI_INTERNALS__.metadata) {
      alert(t("openDialogError"));
      return;
    }

    let dialogFilters = [
      { name: "All supported", extensions: ALL_EXTS },
      { name: "Video",         extensions: VIDEO_EXTS },
      { name: "Audio",         extensions: AUDIO_EXTS },
      { name: "Images",        extensions: IMAGE_EXTS },
      { name: "PDF",           extensions: PDF_EXTS   },
    ];

    if (activeTab === "remove-bg") {
      dialogFilters = [
        { name: "Images",        extensions: IMAGE_EXTS },
      ];
    } else if (activeTab === "enhance") {
      dialogFilters = [
        { name: "Video & Images", extensions: [...VIDEO_EXTS, ...IMAGE_EXTS] },
        { name: "Video",         extensions: VIDEO_EXTS },
        { name: "Images",        extensions: IMAGE_EXTS },
      ];
    } else if (activeTab === "convert") {
      dialogFilters = [
        { name: "Video & Audio & Images", extensions: [...VIDEO_EXTS, ...AUDIO_EXTS, ...IMAGE_EXTS] },
        { name: "Video",         extensions: VIDEO_EXTS },
        { name: "Audio",         extensions: AUDIO_EXTS },
        { name: "Images",        extensions: IMAGE_EXTS },
      ];
    }

    const selected = await open({
      multiple: true,
      filters: dialogFilters,
    });

    if (!selected) return;
    const paths = Array.isArray(selected) ? selected : [selected];

    const toAdd: NewJobInput[] = [];

    for (const path of paths) {
      const info = await getPathInfo(path);
      if (!info.exists) continue;
      const kind = fileKindFromPath(info.name);
      if (kind === "unsupported") continue;
      toAdd.push({ id: uuidv4(), inputPath: info.path, name: info.name, kind, inputBytes: info.size });
    }
    if (toAdd.length > 0) {
      useJobsStore.getState().addFiles(toAdd);
    }
  }

  function handleClearAll() {
    const currentState = useJobsStore.getState();
    const prevJobs = { ...currentState.jobs };
    const prevJobIds = [...currentState.jobIds];
    const count = prevJobIds.length;
    
    currentState.clear();
    
    toast.success(`${count} files cleared`, {
      action: {
        label: "Undo",
        onClick: () => {
          useJobsStore.setState({ jobs: prevJobs, jobIds: prevJobIds });
        },
      },
    });
  }

  return (
    <div className="px-3 pt-3 shrink-0 relative">
      <AnimatePresence mode="wait">
        {!hasFiles ? (
          // ── Large Dropzone panel (Empty State) ─────────────────────────────
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col flex-1"
          >
            <motion.div
              whileHover={{ scale: 1.01 }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
              onClick={handleOpenDialog}
              className={cn(
                "flex flex-col flex-1 items-center justify-center gap-4 min-h-[260px] cursor-pointer",
                "rounded-xl border-2 border-dashed transition-colors",
                isDraggingOver
                  ? "border-emerald-500 bg-emerald-950/30 shadow-lg shadow-emerald-500/20"
                  : "border-border-main hover:border-zinc-500 hover:bg-zinc-950/10"
              )}
            >
              <motion.div
                animate={{ scale: isDraggingOver ? 1.2 : 1, y: isDraggingOver ? -5 : 0 }}
                transition={{ type: "spring", stiffness: 400, damping: 25 }}
                className="text-zinc-500 mb-2 animate-pulse"
              >
                <Upload className="h-10 w-10 opacity-50" />
              </motion.div>
              <EmptyState isDraggingOver={isDraggingOver} />
              <button
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-bg-panel hover:bg-bg-panel-hover text-main text-sm transition-colors pointer-events-none"
              >
                <Upload className="h-4 w-4" />
                {t("openFiles")}
              </button>
            </motion.div>
          </motion.div>
        ) : (
          // ── Compact ~48 px toolbar ─────────────────────────────────────────
          <motion.div
            key="compact"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className={cn(
              "flex items-center justify-between h-full px-3 py-2 rounded-xl border transition-colors",
              isDraggingOver
                ? "border-emerald-500 bg-emerald-950/30 shadow-[0_0_15px_rgba(16,185,129,0.2)]"
                : "border-border-main bg-bg-panel"
            )}
          >
            <span className="text-text-sub text-xs transition-colors flex items-center gap-2">
              <motion.div animate={{ y: isDraggingOver ? -2 : 0, opacity: isDraggingOver ? 1 : 0.5 }}>
                <Upload className="h-4 w-4" />
              </motion.div>
              {isDraggingOver ? <span className="text-emerald-400">{t("releaseToAddEllipsis")}</span> : t("dropFilesAnywhere")}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={handleClearAll}
                className="flex items-center gap-1.5 px-3 py-1 rounded-md text-text-sub hover:text-main hover:bg-bg-panel-hover text-xs transition-colors cursor-pointer"
                title={t("clearAll")}
              >
                <Trash2 className="h-3.5 w-3.5" />
                {t("clearAll")}
              </button>
              <button
                onClick={handleOpenDialog}
                className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-bg-panel hover:bg-bg-panel-hover text-main text-xs transition-colors cursor-pointer"
              >
                <Upload className="h-3.5 w-3.5" />
                {t("addMore")}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
