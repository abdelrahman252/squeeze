import { usePdfAdvanced, useSettingsStore } from "@/store/settings";
import { useTranslation } from "@/lib/i18n";
import { Tooltip } from "@/components/ui/Tooltip";

export function PdfAdvancedSettings() {
  const { t } = useTranslation();
  const settings = usePdfAdvanced();

  return (
    <div className="space-y-6">
      {/* Preset */}
      <div>
        <label className="block text-sm font-medium text-main mb-2">
          {t("compressionPreset")}
          <Tooltip content={t("tipPdfQuality")} />
        </label>
        <select
          value={settings?.preset ?? "ebook"}
          onChange={(e) => useSettingsStore.getState().patchPdfAdvanced({ preset: e.target.value as "screen" | "ebook" | "printer" | "prepress" })}
          className="w-full bg-bg-app border border-border-main rounded-lg px-3 py-2 text-sm text-main focus:outline-none focus:border-emerald-500 cursor-pointer"
        >
          <option value="screen" className="bg-bg-app">/screen (72 dpi, {t("presetLess").toLowerCase()})</option>
          <option value="ebook" className="bg-bg-app">/ebook (150 dpi, {t("presetRecommended").toLowerCase()})</option>
          <option value="printer" className="bg-bg-app">/printer (300 dpi, {t("presetExtreme").toLowerCase()})</option>
          <option value="prepress" className="bg-bg-app">/prepress (300 dpi, {t("presetLossless").toLowerCase()})</option>
        </select>
      </div>

      {/* DPI override */}
      <div>
        <label className="block text-sm font-medium text-main mb-2">
          {t("dpiOverride")}
          <Tooltip content={t("tipPdfQuality")} />
        </label>
        <input
          type="number"
          value={settings?.dpi ?? ""}
          onChange={(e) => useSettingsStore.getState().patchPdfAdvanced({ dpi: e.target.value ? parseInt(e.target.value) : undefined })}
          placeholder={t("default")}
          className="w-full bg-bg-app border border-border-main rounded-lg px-3 py-2 text-sm text-main placeholder-text-sub focus:outline-none focus:border-emerald-500"
        />
      </div>

      {/* Downsample threshold */}
      <div>
        <label className="block text-sm font-medium text-main mb-2">
          {t("downsampleThreshold")} (dpi)
          <Tooltip content={t("tipPdfQuality")} />
        </label>
        <input
          type="number"
          value={settings?.downsampleThreshold ?? ""}
          onChange={(e) => useSettingsStore.getState().patchPdfAdvanced({ downsampleThreshold: e.target.value ? parseInt(e.target.value) : undefined })}
          placeholder={t("default")}
          className="w-full bg-bg-app border border-border-main rounded-lg px-3 py-2 text-sm text-main placeholder-text-sub focus:outline-none focus:border-emerald-500"
        />
        <p className="text-xs text-text-sub mt-1">{t("downsampleDesc")}</p>
      </div>
    </div>
  );
}
