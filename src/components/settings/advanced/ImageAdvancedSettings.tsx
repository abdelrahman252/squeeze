import { useImageAdvanced, useSettingsStore } from "@/store/settings";
import { useTranslation } from "@/lib/i18n";

export function ImageAdvancedSettings() {
  const { t } = useTranslation();
  const settings = useImageAdvanced();

  return (
    <div className="space-y-6">
      {/* Quality */}
      <div>
        <label className="block text-sm font-medium text-main mb-2">
          {t("qualityLabel")}: {settings?.quality ?? 85}
        </label>
        <input
          type="range"
          min="1"
          max="100"
          value={settings?.quality ?? 85}
          onChange={(e) => useSettingsStore.getState().patchImageAdvanced({ quality: parseInt(e.target.value) })}
          className="w-full accent-indigo-500 cursor-pointer"
        />
        <div className="flex justify-between text-xs text-text-sub mt-1">
          <span>1 ({t("worst")})</span>
          <span>100 ({t("best")})</span>
        </div>
      </div>

      {/* Resize mode */}
      <div>
        <label className="block text-sm font-medium text-main mb-2">{t("resizeLabel")}</label>
        <select
          value={settings?.resize?.mode ?? "off"}
          onChange={(e) => useSettingsStore.getState().patchImageAdvanced({ resize: { mode: e.target.value as "fit" | "exact" | "off" } })}
          className="w-full bg-bg-app border border-border-main rounded-lg px-3 py-2 text-sm text-main focus:outline-none focus:border-indigo-500 cursor-pointer"
        >
          <option value="off" className="bg-bg-app">{t("off")}</option>
          <option value="fit" className="bg-bg-app">{t("fitDimensions")}</option>
          <option value="exact" className="bg-bg-app">{t("exactDimensions")}</option>
        </select>
      </div>

      {/* Strip metadata */}
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="strip-metadata"
          checked={settings?.stripMetadata ?? false}
          onChange={(e) => useSettingsStore.getState().patchImageAdvanced({ stripMetadata: e.target.checked })}
          className="accent-indigo-500 cursor-pointer"
        />
        <label htmlFor="strip-metadata" className="text-sm text-main cursor-pointer">{t("stripMetadataLabel")}</label>
      </div>
    </div>
  );
}
