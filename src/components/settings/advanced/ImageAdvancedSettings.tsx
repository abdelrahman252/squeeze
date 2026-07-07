import { useImageAdvanced, useSettingsStore } from "@/store/settings";
import { useTranslation } from "@/lib/i18n";
import { Tooltip } from "@/components/ui/Tooltip";
import { open } from "@tauri-apps/plugin-dialog";

export function ImageAdvancedSettings() {
  const { t } = useTranslation();
  const settings = useImageAdvanced();
  const settingsStore = useSettingsStore();

  const handleSelectWatermark = async () => {
    try {
      const selected = await open({
        directory: false,
        multiple: false,
        title: t("selectWatermark"),
        filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg"] }],
      });
      if (selected && typeof selected === "string") {
        useSettingsStore.getState().patch({ watermarkPath: selected });
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6 pb-6">
      {/* Quality */}
      <div>
        <label className="block text-sm font-medium text-main mb-2">
          {t("qualityLabel")}: {settings?.quality ?? 85}
          <Tooltip content={t("tipImageQuality")} />
        </label>
        <input
          type="range"
          min="1"
          max="100"
          value={settings?.quality ?? 85}
          onChange={(e) => useSettingsStore.getState().patchImageAdvanced({ quality: parseInt(e.target.value) })}
          className="w-full accent-emerald-500 cursor-pointer"
        />
        <div className="flex justify-between text-xs text-text-sub mt-1">
          <span>1 ({t("worst")})</span>
          <span>100 ({t("best")})</span>
        </div>
      </div>

      {/* Resize mode */}
      <div>
        <label className="block text-sm font-medium text-main mb-2">
          {t("resizeLabel")}
          <Tooltip content={t("tipTargetResolution")} />
        </label>
        <select
          value={settings?.resize?.mode ?? "off"}
          onChange={(e) => useSettingsStore.getState().patchImageAdvanced({ resize: { mode: e.target.value as "fit" | "exact" | "off" } })}
          className="w-full bg-bg-app border border-border-main rounded-lg px-3 py-2 text-sm text-main focus:outline-none focus:border-emerald-500 cursor-pointer"
        >
          <option value="off" className="bg-bg-app">{t("off")}</option>
          <option value="fit" className="bg-bg-app">{t("fitDimensions")}</option>
          <option value="exact" className="bg-bg-app">{t("exactDimensions")}</option>
        </select>
      </div>

      {/* Resize Dimensions */}
      {settings?.resize?.mode !== "off" && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-main mb-2">
              {t("resizeWidthLabel")}
              <Tooltip content={t("tipResizeWidth")} />
            </label>
            <input
              type="number"
              placeholder={t("originalRes")}
              value={settingsStore.resizeWidth ?? ""}
              onChange={(e) => useSettingsStore.getState().patch({ resizeWidth: e.target.value ? parseInt(e.target.value) : undefined })}
              className="w-full bg-bg-app border border-border-main rounded-lg px-3 py-2 text-sm text-main placeholder-text-sub focus:outline-none focus:border-emerald-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-main mb-2">
              {t("resizeHeightLabel")}
            </label>
            <input
              type="number"
              placeholder={t("originalRes")}
              value={settingsStore.resizeHeight ?? ""}
              onChange={(e) => useSettingsStore.getState().patch({ resizeHeight: e.target.value ? parseInt(e.target.value) : undefined })}
              className="w-full bg-bg-app border border-border-main rounded-lg px-3 py-2 text-sm text-main placeholder-text-sub focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>
      )}

      {/* Strip metadata */}
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="strip-metadata"
          checked={settings?.stripMetadata ?? false}
          onChange={(e) => useSettingsStore.getState().patchImageAdvanced({ stripMetadata: e.target.checked })}
          className="accent-emerald-500 cursor-pointer"
        />
        <label htmlFor="strip-metadata" className="text-sm text-main cursor-pointer">
          {t("stripMetadataLabel")}
          <Tooltip content={t("tipStripMetadata")} />
        </label>
      </div>

      {/* Watermark Settings */}
      <div className="space-y-4 border-t border-border-main pt-4">
        <h4 className="text-xs font-semibold text-text-sub tracking-wider uppercase flex items-center gap-1.5">
          {t("watermarkLabel")}
          <Tooltip content={t("tipWatermark")} />
        </h4>
        
        <div>
          <label className="block text-sm text-main mb-2">
            {t("watermarkPathLabel")}
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              readOnly
              placeholder="None selected"
              value={settingsStore.watermarkPath ?? ""}
              className="flex-grow bg-bg-app border border-border-main rounded-lg px-3 py-2 text-xs text-main placeholder-text-sub truncate"
            />
            <button
              onClick={handleSelectWatermark}
              className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 rounded-lg text-xs font-semibold cursor-pointer transition-colors shrink-0"
            >
              {t("browse")}
            </button>
          </div>
        </div>

        {settingsStore.watermarkPath && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-main mb-2">
                {t("watermarkPosLabel")}
              </label>
              <select
                value={settingsStore.watermarkPos ?? "bottomRight"}
                onChange={(e) => useSettingsStore.getState().patch({ watermarkPos: e.target.value as any })}
                className="w-full bg-bg-app border border-border-main rounded-lg px-2.5 py-1.5 text-xs text-main focus:outline-none focus:border-emerald-500 cursor-pointer"
              >
                <option value="topLeft" className="bg-bg-app">Top Left</option>
                <option value="topRight" className="bg-bg-app">Top Right</option>
                <option value="bottomLeft" className="bg-bg-app">Bottom Left</option>
                <option value="bottomRight" className="bg-bg-app">Bottom Right</option>
                <option value="center" className="bg-bg-app">Center</option>
              </select>
            </div>

            <div>
              <label className="block text-sm text-main mb-2">
                {t("watermarkOpacityLabel")}: {Math.round((settingsStore.watermarkOpacity ?? 0.8) * 100)}%
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={settingsStore.watermarkOpacity ?? 0.8}
                onChange={(e) => useSettingsStore.getState().patch({ watermarkOpacity: parseFloat(e.target.value) })}
                className="w-full accent-emerald-500 cursor-pointer animate-[pulse_1.5s_infinite]"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
