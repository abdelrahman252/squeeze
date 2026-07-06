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
  const compressOnConvert = useSettingsStore(s => s.compressOnConvert) || false;

  const jobsList = Object.values(jobs);
  const videoInputExts = Array.from(new Set(jobsList.filter(j => j.kind === "video").map(j => j.inputPath.split(".").pop()?.toUpperCase()))).filter(Boolean);
  const imageInputExts = Array.from(new Set(jobsList.filter(j => j.kind === "image").map(j => j.inputPath.split(".").pop()?.toUpperCase()))).filter(Boolean);
  const audioInputExts = Array.from(new Set(jobsList.filter(j => j.kind === "audio").map(j => j.inputPath.split(".").pop()?.toUpperCase()))).filter(Boolean);

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
            <div className={cn(
              "flex-grow flex-shrink-0 basis-[200px] p-3 rounded-xl border flex flex-col gap-2 transition-all duration-200",
              videoInputExts.length === 0
                ? "border-border-main bg-bg-panel/40 opacity-40"
                : "border-border-main bg-bg-panel"
            )}>
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-text-sub">{t("targetVideoFormat")}</label>
                {videoInputExts.length > 0 && (
                  <span className="text-[10px] bg-bg-card border border-border-main px-1 py-0.5 rounded text-text-sub font-mono uppercase">
                    {videoInputExts.join(", ")}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {videoInputExts.length > 0 ? (
                  <>
                    <span className="text-xs font-mono text-text-sub font-semibold">{videoInputExts[0]}{videoInputExts.length > 1 ? "+" : ""}</span>
                    <span className="text-emerald-500 font-bold">→</span>
                    <select
                      value={globalVideoFormat || ""}
                      onChange={(e) => useSettingsStore.getState().patch({ globalVideoFormat: e.target.value || undefined })}
                      className="flex-1 bg-bg-app border border-border-main rounded-lg px-2 py-1.5 text-xs text-main focus:outline-none focus:border-emerald-500 cursor-pointer"
                    >
                      <option value="" className="bg-bg-app">{t("original")} (No conversion)</option>
                      <option value="mp4" className="bg-bg-app">MP4</option>
                      <option value="webm" className="bg-bg-app">WebM</option>
                    </select>
                  </>
                ) : (
                  <select
                    disabled
                    className="w-full bg-bg-app border border-border-main rounded-lg px-2 py-1.5 text-xs text-text-sub opacity-50 cursor-not-allowed"
                  >
                    <option>{t("noVideosInQueue")}</option>
                  </select>
                )}
              </div>
            </div>

            {/* Images conversion card */}
            <div className={cn(
              "flex-grow flex-shrink-0 basis-[200px] p-3 rounded-xl border flex flex-col gap-2 transition-all duration-200",
              imageInputExts.length === 0
                ? "border-border-main bg-bg-panel/40 opacity-40"
                : "border-border-main bg-bg-panel"
            )}>
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-text-sub">{t("targetImageFormat")}</label>
                {imageInputExts.length > 0 && (
                  <span className="text-[10px] bg-bg-card border border-border-main px-1 py-0.5 rounded text-text-sub font-mono uppercase">
                    {imageInputExts.join(", ")}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {imageInputExts.length > 0 ? (
                  <>
                    <span className="text-xs font-mono text-text-sub font-semibold">{imageInputExts[0]}{imageInputExts.length > 1 ? "+" : ""}</span>
                    <span className="text-emerald-500 font-bold">→</span>
                    <select
                      value={globalImageFormat || ""}
                      onChange={(e) => useSettingsStore.getState().patch({ globalImageFormat: e.target.value || undefined })}
                      className="flex-1 bg-bg-app border border-border-main rounded-lg px-2.5 py-1.5 text-xs text-main focus:outline-none focus:border-emerald-500 cursor-pointer"
                    >
                      <option value="" className="bg-bg-app">{t("original")} (No conversion)</option>
                      <option value="jpeg" className="bg-bg-app">JPEG</option>
                      <option value="png" className="bg-bg-app">PNG</option>
                      <option value="webp" className="bg-bg-app">WebP</option>
                    </select>
                  </>
                ) : (
                  <select
                    disabled
                    className="w-full bg-bg-app border border-border-main rounded-lg px-2 py-1.5 text-xs text-text-sub opacity-50 cursor-not-allowed"
                  >
                    <option>{t("noImagesInQueue")}</option>
                  </select>
                )}
              </div>
            </div>

            {/* Audios conversion card */}
            <div className={cn(
              "flex-grow flex-shrink-0 basis-[200px] p-3 rounded-xl border flex flex-col gap-2 transition-all duration-200",
              audioInputExts.length === 0
                ? "border-border-main bg-bg-panel/40 opacity-40"
                : "border-border-main bg-bg-panel"
            )}>
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-text-sub">{t("targetAudioFormat")}</label>
                {audioInputExts.length > 0 && (
                  <span className="text-[10px] bg-bg-card border border-border-main px-1 py-0.5 rounded text-text-sub font-mono uppercase">
                    {audioInputExts.join(", ")}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {audioInputExts.length > 0 ? (
                  <>
                    <span className="text-xs font-mono text-text-sub font-semibold">{audioInputExts[0]}{audioInputExts.length > 1 ? "+" : ""}</span>
                    <span className="text-emerald-500 font-bold">→</span>
                    <select
                      value={globalAudioFormat || ""}
                      onChange={(e) => useSettingsStore.getState().patch({ globalAudioFormat: e.target.value || undefined })}
                      className="flex-1 bg-bg-app border border-border-main rounded-lg px-2.5 py-1.5 text-xs text-main focus:outline-none focus:border-emerald-500 cursor-pointer"
                    >
                      <option value="" className="bg-bg-app">{t("original")} (No conversion)</option>
                      <option value="mp3" className="bg-bg-app">MP3</option>
                      <option value="m4a" className="bg-bg-app">M4A</option>
                      <option value="wav" className="bg-bg-app">WAV</option>
                      <option value="ogg" className="bg-bg-app">OGG</option>
                    </select>
                  </>
                ) : (
                  <select
                    disabled
                    className="w-full bg-bg-app border border-border-main rounded-lg px-2 py-1.5 text-xs text-text-sub opacity-50 cursor-not-allowed"
                  >
                    <option>{t("noAudiosInQueue")}</option>
                  </select>
                )}
              </div>
            </div>
          </div>

          {/* Suggestion & Compress-during-conversion option */}
          <div className="mt-2 p-3.5 rounded-xl border border-dashed border-emerald-500/30 bg-emerald-950/5 flex flex-col gap-3">
            <div className="flex items-start gap-2.5 text-xs text-text-sub">
              <span className="text-emerald-400 text-sm mt-0.5">💡</span>
              <div>
                <span className="font-semibold text-main">{t("convertTipTitle")}</span>{" "}
                {t("convertTipDesc")}
              </div>
            </div>
            
            <div className="h-px bg-border-sub/50" />
            
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={compressOnConvert}
                onChange={(e) => useSettingsStore.getState().patch({ compressOnConvert: e.target.checked })}
                className="w-4 h-4 rounded border-border-main text-emerald-600 focus:ring-emerald-500 focus:ring-offset-bg-app bg-bg-app cursor-pointer"
              />
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-main">{t("compressOnConvertLabel")}</span>
                <span className="text-[11px] text-text-sub">{t("compressOnConvertSub")}</span>
              </div>
            </label>
            
            {compressOnConvert && (
              <div className="flex flex-col gap-2 pl-6 pt-1">
                <div className="text-[10px] font-semibold text-text-sub uppercase tracking-wider">{t("compressionPreset")}</div>
                <div className="flex gap-2 flex-wrap w-full">
                  {presetsList.map((preset, idx) => (
                    <button
                      key={preset.id}
                      onClick={() => useSettingsStore.getState().patch({ preset: preset.id })}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-xs font-medium border transition-all cursor-pointer",
                        currentPreset === preset.id
                          ? "border-emerald-500 bg-emerald-950/20 text-emerald-400 font-semibold"
                          : "border-border-main bg-bg-panel text-text-sub hover:border-zinc-500 hover:text-main"
                      )}
                    >
                      {t(preset.labelKey)} ({estimates[idx]})
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
