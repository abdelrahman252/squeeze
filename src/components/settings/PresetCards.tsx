import { Check, Zap } from "lucide-react";
import { 
  usePreset, 
  useSettingsStore,
  useGlobalVideoFormat,
  useGlobalImageFormat,
  useGlobalAudioFormat 
} from "@/store/settings";
import { useJobs, useJobCount } from "@/store/jobs";
import { getPresetEstimate } from "@/lib/estimate";
import { formatBytes } from "@/lib/format";
import { useTranslation } from "@/lib/i18n";
import { useUiStore, useActiveTab } from "@/store/ui";
import { cn } from "@/lib/utils";

function PresetCard({
  labelKey,
  subtitleKey,
  isDefault,
  isSelected,
  estimate,
  isDisabled,
  isDimmed,
  onClick,
}: {
  labelKey: "presetLess" | "presetRecommended" | "presetExtreme";
  subtitleKey: "presetLessDesc" | "presetRecommendedDesc" | "presetExtDesc";
  isDefault?: boolean;
  isSelected: boolean;
  estimate: string;
  isDisabled: boolean;
  isDimmed: boolean;
  onClick: () => void;
}) {
  const { t } = useTranslation();
  const tooltip = isDisabled ? t("none") : undefined;

  return (
    <button
      onClick={onClick}
      disabled={isDisabled}
      title={tooltip}
      className={`
        relative flex-1 min-w-[140px] p-2.5 rounded-xl border transition-all text-start
        ${isSelected
          ? "border-emerald-500 bg-emerald-950/30 shadow-lg shadow-emerald-500/10"
          : "border-border-main bg-bg-panel hover:border-zinc-500 hover:bg-bg-panel-hover"
        }
        ${isDisabled ? "opacity-30 cursor-not-allowed" : "cursor-pointer"}
        ${isDimmed && !isDisabled ? "opacity-40 grayscale" : ""}
      `}
    >
      {isSelected && (
        <div className="absolute top-2 right-2 rtl:right-auto rtl:left-2">
          <div className="bg-emerald-500 rounded-full p-1">
            <Check className="h-3 w-3 text-white" />
          </div>
        </div>
      )}
      {isDefault && !isSelected && (
        <div className="absolute top-2 right-2 rtl:right-auto rtl:left-2">
          <Zap className="h-3.5 w-3.5 text-emerald-400" />
        </div>
      )}
      <div className="font-semibold text-main text-sm mb-1">{t(labelKey)}</div>
      <div className="text-xs text-text-sub mb-1">{t(subtitleKey as any) || t("presetRecDesc")}</div>
      <div className="font-mono text-xs text-emerald-400 font-medium">
        {estimate}
      </div>
    </button>
  );
}

export function PresetCards() {
  const { t } = useTranslation();
  const activeTab = useActiveTab();
  const currentPreset = usePreset();
  const targetFileSize = useSettingsStore(s => s.targetFileSize);
  const isFitForActive = targetFileSize !== undefined;
  const jobs = useJobs();
  const jobCount = useJobCount();

  const globalVideoFormat = useGlobalVideoFormat();
  const globalImageFormat = useGlobalImageFormat();
  const globalAudioFormat = useGlobalAudioFormat();

  const presetsList = [
    {
      id: "less" as const,
      labelKey: "presetLess" as const,
      subtitleKey: "presetLessDesc" as const,
    },
    {
      id: "recommended" as const,
      labelKey: "presetRecommended" as const,
      subtitleKey: "presetRecommendedDesc" as const,
      default: true,
    },
    {
      id: "extreme" as const,
      labelKey: "presetExtreme" as const,
      subtitleKey: "presetExtDesc" as const,
    },
  ];

  // Compute estimates for all presets
  const estimates = presetsList.map((p) => {
    const estBytes = jobCount > 0 ? getPresetEstimate(jobs, p.id) : undefined;
    return estBytes !== undefined ? formatBytes(estBytes) : "—";
  });

  return (
    <div className="flex flex-col w-full">
      {/* Mode Switcher Tabs */}
      <div className="flex items-center gap-1 p-1 bg-bg-panel border border-border-sub rounded-lg self-start mb-3">
        <button
          onClick={() => useUiStore.getState().setActiveTab("compress")}
          className={cn(
            "px-4 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer",
            activeTab === "compress"
              ? "bg-emerald-600 text-white shadow shadow-emerald-600/30"
              : "text-text-sub hover:text-main"
          )}
        >
          {t("compressTab")}
        </button>
        <button
          onClick={() => useUiStore.getState().setActiveTab("convert")}
          className={cn(
            "px-4 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer",
            activeTab === "convert"
              ? "bg-emerald-600 text-white shadow shadow-emerald-600/30"
              : "text-text-sub hover:text-main"
          )}
        >
          {t("convertTab")}
        </button>
      </div>

      {activeTab === "compress" ? (
        <div className="flex gap-3 mb-4 flex-wrap w-full">
          {presetsList.map((preset, idx) => (
            <PresetCard
              key={preset.id}
              labelKey={preset.labelKey}
              subtitleKey={preset.subtitleKey}
              isDefault={preset.default}
              isSelected={currentPreset === preset.id && !isFitForActive}
              estimate={estimates[idx]}
              isDisabled={false}
              isDimmed={isFitForActive}
              onClick={() => useSettingsStore.getState().patch({ preset: preset.id, targetFileSize: undefined })}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col w-full gap-2.5 mb-4">
          <div className="text-xs font-semibold text-text-sub tracking-wider uppercase mb-1">
            {t("convertLabel")}
          </div>
          
          <div className="flex gap-3 flex-wrap w-full">
            {/* Videos conversion card */}
            <div className="flex-grow flex-shrink-0 basis-[200px] p-3 rounded-xl border border-border-main bg-bg-panel flex flex-col gap-2">
              <label className="text-xs font-medium text-text-sub">{t("targetVideoFormat")}</label>
              <select
                value={globalVideoFormat || ""}
                onChange={(e) => useSettingsStore.getState().patch({ globalVideoFormat: e.target.value || undefined })}
                className="w-full bg-bg-app border border-border-main rounded-lg px-2.5 py-1.5 text-xs text-main focus:outline-none focus:border-emerald-500 cursor-pointer"
              >
                <option value="" className="bg-bg-app">{t("original")} (No conversion)</option>
                <option value="mp4" className="bg-bg-app">MP4</option>
                <option value="webm" className="bg-bg-app">WebM</option>
              </select>
            </div>

            {/* Images conversion card */}
            <div className="flex-grow flex-shrink-0 basis-[200px] p-3 rounded-xl border border-border-main bg-bg-panel flex flex-col gap-2">
              <label className="text-xs font-medium text-text-sub">{t("targetImageFormat")}</label>
              <select
                value={globalImageFormat || ""}
                onChange={(e) => useSettingsStore.getState().patch({ globalImageFormat: e.target.value || undefined })}
                className="w-full bg-bg-app border border-border-main rounded-lg px-2.5 py-1.5 text-xs text-main focus:outline-none focus:border-emerald-500 cursor-pointer"
              >
                <option value="" className="bg-bg-app">{t("original")} (No conversion)</option>
                <option value="jpeg" className="bg-bg-app">JPEG</option>
                <option value="png" className="bg-bg-app">PNG</option>
                <option value="webp" className="bg-bg-app">WebP</option>
              </select>
            </div>

            {/* Audios conversion card */}
            <div className="flex-grow flex-shrink-0 basis-[200px] p-3 rounded-xl border border-border-main bg-bg-panel flex flex-col gap-2">
              <label className="text-xs font-medium text-text-sub">{t("targetAudioFormat")}</label>
              <select
                value={globalAudioFormat || ""}
                onChange={(e) => useSettingsStore.getState().patch({ globalAudioFormat: e.target.value || undefined })}
                className="w-full bg-bg-app border border-border-main rounded-lg px-2.5 py-1.5 text-xs text-main focus:outline-none focus:border-emerald-500 cursor-pointer"
              >
                <option value="" className="bg-bg-app">{t("original")} (No conversion)</option>
                <option value="mp3" className="bg-bg-app">MP3</option>
                <option value="m4a" className="bg-bg-app">M4A</option>
                <option value="wav" className="bg-bg-app">WAV</option>
                <option value="ogg" className="bg-bg-app">OGG</option>
              </select>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
