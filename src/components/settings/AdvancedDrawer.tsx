import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, RefreshCw } from "lucide-react";
import { useUiStore } from "@/store/ui";
import { check } from "@tauri-apps/plugin-updater";
import { toast } from "sonner";
import { useTargetFileSize, useParallelJobs, useSettingsStore } from "@/store/settings";
import { VideoAdvancedSettings } from "./advanced/VideoAdvancedSettings";
import { AudioAdvancedSettings } from "./advanced/AudioAdvancedSettings";
import { ImageAdvancedSettings } from "./advanced/ImageAdvancedSettings";
import { PdfAdvancedSettings } from "./advanced/PdfAdvancedSettings";
import { useTranslation } from "@/lib/i18n";

export function AdvancedDrawer() {
  const { t, isRtl } = useTranslation();
  const isOpen = useUiStore((s) => s.isAdvancedOpen);
  const [activeTab, setActiveTab] = useState<"video" | "audio" | "image" | "pdf">("video");
  const [isChecking, setIsChecking] = useState(false);

  const handleCheckUpdates = async () => {
    setIsChecking(true);
    try {
      const update = await check();
      if (update) {
        const ok = confirm(
          t("updateAvailablePrompt").replace("{version}", update.version)
        );
        if (ok) {
          toast.info(t("updateDownloading"));
          await update.downloadAndInstall();
          alert(t("updateSuccessPrompt"));
        }
      } else {
        toast.success(t("noUpdatesFound"));
      }
    } catch (err) {
      console.error(err);
      toast.error(t("updateCheckFailed"));
    } finally {
      setIsChecking(false);
    }
  };

  const targetFileSize = useTargetFileSize();
  const parallelJobs = useParallelJobs();

  const tabsList = [
    { id: "video" as const, labelKey: "filterVideo" as const },
    { id: "audio" as const, labelKey: "filterAudio" as const },
    { id: "image" as const, labelKey: "filterImage" as const },
    { id: "pdf" as const, labelKey: "filterPdf" as const },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => useUiStore.getState().setAdvancedOpen(false)}
            className="fixed inset-0 bg-black/50 z-40"
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: isRtl ? "-100%" : "100%" }}
            animate={{ x: 0 }}
            exit={{ x: isRtl ? "-100%" : "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className={`fixed top-0 h-full w-[384px] bg-bg-panel shadow-2xl z-50 flex flex-col ${
              isRtl ? "left-0 border-r border-border-main" : "right-0 border-l border-border-main"
            }`}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border-main">
              <h2 className="text-lg font-semibold text-main">{t("advancedSettings")}</h2>
              <button
                onClick={() => useUiStore.getState().setAdvancedOpen(false)}
                className="p-1 rounded hover:bg-bg-panel-hover text-text-sub hover:text-main transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-border-main">
              {tabsList.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                    flex-1 py-3 text-sm font-medium transition-colors cursor-pointer
                    ${activeTab === tab.id
                      ? "text-emerald-400 border-b-2 border-emerald-500"
                      : "text-text-sub hover:text-main"
                    }
                  `}
                >
                  {t(tab.labelKey)}
                </button>
              ))}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4">
              {/* Global settings */}
              <div className="mb-6 pb-6 border-b border-border-main">
                <h3 className="text-sm font-medium text-main mb-4">{t("globalLabel")}</h3>

                {/* Parallel jobs */}
                <div className="mb-4">
                  <label className="block text-sm text-text-sub mb-2">{t("parallelJobs")}</label>
                  <input
                    type="number"
                    min="1"
                    max="16"
                    value={parallelJobs}
                    onChange={(e) => useSettingsStore.getState().patch({ parallelJobs: parseInt(e.target.value) })}
                    className="w-full bg-bg-app border border-border-main rounded-lg px-3 py-2 text-sm text-main focus:outline-none focus:border-emerald-500"
                  />
                </div>

                {/* Target file size */}
                <div>
                  <label className="block text-sm text-text-sub mb-2">{t("targetFileSizeOptional")}</label>
                  <div className="flex gap-2">
                    <select
                       value={targetFileSize?.mode ?? "absolute"}
                      onChange={(e) =>
                        useSettingsStore.getState().patch({
                          targetFileSize: {
                            mode: e.target.value as "absolute" | "percent",
                            value: targetFileSize?.value ?? 0,
                          },
                        })
                      }
                      className="bg-bg-app border border-border-main rounded-lg px-3 py-2 text-sm text-main focus:outline-none focus:border-emerald-500"
                    >
                      <option value="absolute" className="bg-bg-app">MB</option>
                      <option value="percent" className="bg-bg-app">%</option>
                    </select>
                    <input
                      type="number"
                      value={targetFileSize?.value ?? ""}
                      onChange={(e) =>
                        useSettingsStore.getState().patch({
                          targetFileSize: {
                            mode: (targetFileSize?.mode ?? "absolute") as "absolute" | "percent",
                            value: parseFloat(e.target.value),
                          },
                        })
                      }
                      placeholder={t("none")}
                      className="flex-1 bg-bg-app border border-border-main rounded-lg px-3 py-2 text-sm text-main placeholder-text-sub focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>
              </div>

              {/* Tab content */}
              {activeTab === "video" && <VideoAdvancedSettings />}
              {activeTab === "audio" && <AudioAdvancedSettings />}
              {activeTab === "image" && <ImageAdvancedSettings />}
              {activeTab === "pdf" && <PdfAdvancedSettings />}
            </div>

            {/* Footer / Update Button */}
            <div className="flex-shrink-0 border-t border-border-main p-4 bg-bg-panel flex flex-col gap-2">
              <button
                disabled={isChecking}
                onClick={handleCheckUpdates}
                className={`
                  w-full py-2.5 px-4 rounded-lg font-semibold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer border
                  ${isChecking
                    ? "bg-bg-card border-border-main text-text-sub opacity-50 cursor-not-allowed"
                    : "bg-emerald-600/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-600/20 hover:border-emerald-500/40"
                  }
                `}
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isChecking ? "animate-spin" : ""}`} />
                {isChecking ? t("checkingUpdates") : t("checkForUpdates")}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
