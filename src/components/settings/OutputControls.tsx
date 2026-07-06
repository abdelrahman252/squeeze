import { useOutputMode, useFilenamePattern, useCustomOutputDir, useSettingsStore } from "@/store/settings";
import { useIsSqueezing, useReadyCompressableCount, useEncodingJobCount } from "@/store/jobs";
import { startSqueeze } from "@/hooks/useCompression";
import { Zap, Loader2 } from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";
import { useTranslation } from "@/lib/i18n";
import { useActiveTab } from "@/store/ui";

type OutputMode = "same-folder" | "subfolder" | "custom";

export function OutputControls() {
  const { t } = useTranslation();
  const outputMode      = useOutputMode();
  const customOutputDir = useCustomOutputDir();
  const filenamePattern = useFilenamePattern();
  const isSqueezing     = useIsSqueezing();
  const readyCompressableCount = useReadyCompressableCount();
  const encodingJobCount = useEncodingJobCount();
  const activeTab = useActiveTab();

  // Button is active when there are any ready video/audio/image jobs and we're not already compressing
  const canSqueeze = readyCompressableCount > 0 && !isSqueezing;

  const modes = [
    { id: "same-folder" as const, label: t("sameFolder") },
    { id: "subfolder" as const, label: t("subfolderSqueeze") },
    {
      id: "custom" as const,
      label: customOutputDir
        ? `${customOutputDir.split(/[\\/]/).pop()}`
        : t("customFolder"),
    },
  ];

  async function handleModeChange(mode: OutputMode) {
    if (mode === "custom") {
      if (typeof window === "undefined" || !(window as any).__TAURI_INTERNALS__ || !(window as any).__TAURI_INTERNALS__.metadata) {
        alert(t("openDialogError"));
        return;
      }
      const selected = await open({
        directory: true,
        multiple: false,
        title: t("selectCustomFolder"),
      });
      if (selected && typeof selected === "string") {
        useSettingsStore.getState().patch({ outputMode: mode, customOutputDir: selected });
      } else {
        // If cancelled, revert to previous mode if no custom dir is set yet
        if (!useSettingsStore.getState().customOutputDir) {
          useSettingsStore.getState().patch({ outputMode: "same-folder" });
        } else {
          // just force re-render if they cancelled but already had a custom dir
          useSettingsStore.getState().patch({ outputMode: "custom" });
        }
      }
    } else {
      useSettingsStore.getState().patch({ outputMode: mode });
    }
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Output mode — compact select dropdown */}
      <select
        value={outputMode}
        onChange={(e) => handleModeChange(e.target.value as OutputMode)}
        className="bg-bg-panel border border-border-main rounded-lg px-2 py-1.5 text-xs text-main focus:outline-none focus:border-emerald-500 cursor-pointer shrink-0 max-w-[220px] truncate"
      >
        {modes.map((mode) => (
          <option key={mode.id} value={mode.id} className="bg-bg-app">
            {mode.label}
          </option>
        ))}
      </select>

      {/* Filename pattern */}
      <input
        type="text"
        value={filenamePattern}
        onChange={(e) => {
          if (activeTab === "convert") {
            useSettingsStore.getState().patch({ filenamePatternConvert: e.target.value });
          } else {
            useSettingsStore.getState().patch({ filenamePattern: e.target.value });
          }
        }}
        className="flex-1 bg-bg-panel border border-border-main rounded-lg px-2 py-1.5 text-xs text-main placeholder-text-sub focus:outline-none focus:border-emerald-500"
        placeholder={activeTab === "convert" ? "{name}_converted{ext}" : "{name}_squeeze{ext}"}
      />

      {/* Squeeze button — right side, normal-sized, no w-full */}
      <button
        disabled={!canSqueeze}
        onClick={() => { void startSqueeze(); }}
        className={`
          px-5 py-2 rounded-lg font-bold text-sm flex items-center gap-1.5 transition-all shrink-0 cursor-pointer
          ${!canSqueeze
            ? "bg-bg-card text-text-sub opacity-50 cursor-not-allowed"
            : "bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30"
          }
        `}
      >
        {isSqueezing
          ? <Loader2 className="h-4 w-4 animate-spin" />
          : <Zap className="h-4 w-4" />
        }
        {isSqueezing ? `${t("statusCompressing")} ${encodingJobCount}/${readyCompressableCount + encodingJobCount}…` : (activeTab === "convert" ? t("convertAction") : t("squeeze"))}
      </button>
    </div>
  );
}
