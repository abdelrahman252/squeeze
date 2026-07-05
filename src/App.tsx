import { LayoutGroup, motion, AnimatePresence } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { Toaster, toast } from "sonner";
import { Titlebar } from "@/components/titlebar/Titlebar";
import { Dropzone } from "@/components/dropzone/Dropzone";
import { FileList } from "@/components/filelist/FileList";
import { QueueTotalBanner } from "@/components/filelist/QueueTotalBanner";
import { PresetCards } from "@/components/settings/PresetCards";
import { startSqueeze } from "@/hooks/useCompression";
import { OutputControls } from "@/components/settings/OutputControls";
import { AdvancedDrawer } from "@/components/settings/AdvancedDrawer";
import { useMaximized } from "@/hooks/useMaximized";
import { useDragDrop } from "@/hooks/useDragDrop";
import { useShortcuts } from "@/hooks/useShortcuts";
import { useJobsStore } from "@/store/jobs";
import { useTranslation } from "@/lib/i18n";
import { useUiStore } from "@/store/ui";
import { check } from "@tauri-apps/plugin-updater";

export default function App() {
  const { isRtl } = useTranslation();
  const theme = useUiStore((s) => s.theme);
  const maximized  = useMaximized();
  useShortcuts();
  const { isDraggingOver, onDragOver, onDragLeave, onDrop } = useDragDrop();
  const jobCount   = useJobsStore((s) => s.jobIds.length);

  // Lag the "has files" signal by one animation cycle (250ms).
  // Without this, Dropzone switches from compact→empty at the exact moment
  // Clear All fires, causing the empty state to race against the exiting
  // file list, filter chips, and preset cards — creating the flash in the middle.
  const [laggedHasFiles, setLaggedHasFiles] = useState(jobCount > 0);
  const lagTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (jobCount > 0) {
      if (lagTimer.current) clearTimeout(lagTimer.current);
      setLaggedHasFiles(true);
    } else {
      lagTimer.current = setTimeout(() => setLaggedHasFiles(false), 250);
    }
    return () => { if (lagTimer.current) clearTimeout(lagTimer.current); };
  }, [jobCount]);

  useEffect(() => {
    const handleAutoSqueeze = () => {
      void startSqueeze();
    };
    window.addEventListener("squeeze-auto-squeeze", handleAutoSqueeze);
    return () => window.removeEventListener("squeeze-auto-squeeze", handleAutoSqueeze);
  }, []);

  useEffect(() => {
    async function runUpdateCheck() {
      if (typeof window === "undefined" || !(window as any).__TAURI_INTERNALS__ || !(window as any).__TAURI_INTERNALS__.metadata) {
        return;
      }
      try {
        const update = await check();
        if (update) {
          const yes = window.confirm(
            `A new version (v${update.version}) is available. Would you like Squeeze to download and install it now?`
          );
          if (yes) {
            toast.info("Downloading update in the background...");
            await update.downloadAndInstall();
            alert("Update installed successfully! Please restart Squeeze to apply the update.");
          }
        }
      } catch (err) {
        console.error("Update check failed:", err);
      }
    }
    const timer = setTimeout(() => {
      void runUpdateCheck();
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div
      dir={isRtl ? "rtl" : "ltr"}
      className={`${theme} flex flex-col h-screen bg-app text-main overflow-hidden ${
        maximized ? "" : "rounded-xl"
      }`}
    >
      <Titlebar />

      {/* Drag handlers cover the entire content area so drops work over FileList too */}
      <LayoutGroup>
        <div
          className="flex flex-col flex-1 min-h-0 relative"
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
        >
          {/* Dropzone: flex-1 when empty, shrinks to h-12 toolbar when populated.
              Uses motion.div layout internally for the animated height collapse. */}
          <Dropzone isDraggingOver={isDraggingOver} hasFiles={laggedHasFiles} />

          {/* Main content block wrapped in AnimatePresence mode="popLayout" */}
          <AnimatePresence mode="popLayout">
            {jobCount > 0 && (
              <motion.div
                key="content"
                layout
                className="flex flex-col flex-1 min-h-0 w-full"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20, pointerEvents: "none" }}
                transition={{ duration: 0.2 }}
              >
                <FileList />
                
                <QueueTotalBanner />
                
                <div className="px-3 pb-3 shrink-0">
                  <PresetCards />
                  <OutputControls />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </LayoutGroup>

      {/* Advanced drawer */}
      <AdvancedDrawer />

      {/* Hardcode theme="dark" — never rely on system theme detection (bug #2) */}
      <Toaster theme="dark" position="bottom-right" closeButton />
    </div>
  );
}
