import { Check, Zap } from "lucide-react";
import { usePreset, useSettingsStore } from "@/store/settings";
import { useJobs, useJobCount } from "@/store/jobs";
import { getPresetEstimate } from "@/lib/estimate";
import { formatBytes } from "@/lib/format";
import { useTranslation } from "@/lib/i18n";

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
          ? "border-indigo-500 bg-indigo-950/30 shadow-lg shadow-indigo-500/10"
          : "border-border-main bg-bg-panel hover:border-zinc-500 hover:bg-bg-panel-hover"
        }
        ${isDisabled ? "opacity-30 cursor-not-allowed" : "cursor-pointer"}
        ${isDimmed && !isDisabled ? "opacity-40 grayscale" : ""}
      `}
    >
      {isSelected && (
        <div className="absolute top-2 right-2 rtl:right-auto rtl:left-2">
          <div className="bg-indigo-500 rounded-full p-1">
            <Check className="h-3 w-3 text-white" />
          </div>
        </div>
      )}
      {isDefault && !isSelected && (
        <div className="absolute top-2 right-2 rtl:right-auto rtl:left-2">
          <Zap className="h-3.5 w-3.5 text-indigo-400" />
        </div>
      )}
      <div className="font-semibold text-main text-sm mb-1">{t(labelKey)}</div>
      <div className="text-xs text-text-sub mb-1">{t(subtitleKey as any) || t("presetRecDesc")}</div>
      <div className="font-mono text-xs text-indigo-400 font-medium">
        {estimate}
      </div>
    </button>
  );
}

export function PresetCards() {
  const currentPreset = usePreset();
  const targetFileSize = useSettingsStore(s => s.targetFileSize);
  const isFitForActive = targetFileSize !== undefined;
  const jobs = useJobs();
  const jobCount = useJobCount();

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
    <div className="flex gap-3 mb-4 flex-wrap">
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
  );
}
