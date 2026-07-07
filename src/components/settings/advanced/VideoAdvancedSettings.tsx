import { useVideoAdvanced, useSettingsStore } from "@/store/settings";
import { useTranslation } from "@/lib/i18n";
import { Tooltip } from "@/components/ui/Tooltip";
import { open } from "@tauri-apps/plugin-dialog";

export function VideoAdvancedSettings() {
  const { t } = useTranslation();
  const settings = useVideoAdvanced();
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
      {/* Codec */}
      <div>
        <label className="block text-sm font-medium text-main mb-2">
          {t("codec")}
          <Tooltip content={t("tipVideoCodec")} />
        </label>
        <select
          value={settings?.codec ?? "h264"}
          onChange={(e) => useSettingsStore.getState().patchVideoAdvanced({ codec: e.target.value as "h264" | "h265" | "av1" })}
          className="w-full bg-bg-app border border-border-main rounded-lg px-3 py-2 text-sm text-main focus:outline-none focus:border-emerald-500 cursor-pointer"
        >
          <option value="h264" className="bg-bg-app">H.264</option>
          <option value="h265" className="bg-bg-app">H.265 (HEVC)</option>
          <option value="av1" className="bg-bg-app">AV1</option>
        </select>
      </div>

      {/* CRF */}
      <div>
        <label className="block text-sm font-medium text-main mb-2">
          CRF ({t("qualityLabel")}): {settings?.crf ?? 23}
          <Tooltip content={t("tipVideoCrf")} />
        </label>
        <input
          type="range"
          min="0"
          max="51"
          value={settings?.crf ?? 23}
          onChange={(e) => useSettingsStore.getState().patchVideoAdvanced({ crf: parseInt(e.target.value) })}
          className="w-full accent-emerald-500 cursor-pointer"
        />
        <div className="flex justify-between text-xs text-text-sub mt-1">
          <span>0 ({t("lossless")})</span>
          <span>51 ({t("worst")})</span>
        </div>
      </div>

      {/* Resolution scale */}
      <div>
        <label className="block text-sm font-medium text-main mb-2">
          {t("targetResolution")}
          <Tooltip content={t("tipTargetResolution")} />
        </label>
        <select
          value={settings?.targetResolution ?? "original"}
          onChange={(e) => useSettingsStore.getState().patchVideoAdvanced({ targetResolution: e.target.value as "original" | "4k" | "1080p" | "720p" | "480p" | "custom" })}
          className="w-full bg-bg-app border border-border-main rounded-lg px-3 py-2 text-sm text-main focus:outline-none focus:border-emerald-500 cursor-pointer"
        >
          <option value="original" className="bg-bg-app">{t("originalRes")}</option>
          <option value="4k" className="bg-bg-app">4K (2160p)</option>
          <option value="1080p" className="bg-bg-app">1080p</option>
          <option value="720p" className="bg-bg-app">720p</option>
          <option value="480p" className="bg-bg-app">480p</option>
          <option value="custom" className="bg-bg-app">{t("customRes")}</option>
        </select>
      </div>

      {/* Resize Dimensions */}
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

      {/* FPS cap */}
      <div>
        <label className="block text-sm font-medium text-main mb-2">
          {t("fpsLabel")}
          <Tooltip content={t("tipTargetFps")} />
        </label>
        <input
          type="number"
          value={settings?.fps ?? ""}
          onChange={(e) => useSettingsStore.getState().patchVideoAdvanced({ fps: e.target.value ? parseInt(e.target.value) : undefined })}
          placeholder={t("noCap")}
          className="w-full bg-bg-app border border-border-main rounded-lg px-3 py-2 text-sm text-main placeholder-text-sub focus:outline-none focus:border-emerald-500"
        />
      </div>

      {/* Hardware encoder */}
      <div>
        <label className="block text-sm font-medium text-main mb-2">
          {t("hwEncoder")}
          <Tooltip content={t("tipHwEncoder")} />
        </label>
        <select
          value={settings?.hwEncoder ?? "auto"}
          onChange={(e) => useSettingsStore.getState().patchVideoAdvanced({ hwEncoder: e.target.value as "auto" | "nvenc" | "qsv" | "amf" | "none" })}
          className="w-full bg-bg-app border border-border-main rounded-lg px-3 py-2 text-sm text-main focus:outline-none focus:border-emerald-500 cursor-pointer"
        >
          <option value="auto" className="bg-bg-app">{t("default")}</option>
          <option value="nvenc" className="bg-bg-app">NVENC (NVIDIA)</option>
          <option value="qsv" className="bg-bg-app">QSV (Intel)</option>
          <option value="amf" className="bg-bg-app">AMF (AMD)</option>
          <option value="none" className="bg-bg-app">{t("none")} ({t("softwareOnly")})</option>
        </select>
      </div>

      {/* Audio bitrate */}
      <div>
        <label className="block text-sm font-medium text-main mb-2">
          {t("audioSettings")} ({t("bitrateLabel")} kbps)
          <Tooltip content={t("tipAudioKbps")} />
        </label>
        <input
          type="number"
          value={settings?.audioKbps ?? 128}
          onChange={(e) => useSettingsStore.getState().patchVideoAdvanced({ audioKbps: parseInt(e.target.value) })}
          className="w-full bg-bg-app border border-border-main rounded-lg px-3 py-2 text-sm text-main focus:outline-none focus:border-emerald-500"
        />
      </div>

      {/* Audio Cleanup */}
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="audio-cleanup"
          checked={settingsStore.audioCleanup}
          onChange={(e) => useSettingsStore.getState().patch({ audioCleanup: e.target.checked })}
          className="accent-emerald-500 cursor-pointer"
        />
        <label htmlFor="audio-cleanup" className="text-sm text-main cursor-pointer">
          {t("audioCleanupLabel")}
          <Tooltip content={t("tipAudioCleanup")} />
        </label>
      </div>

      {/* Auto Reframe */}
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="auto-reframe"
          checked={settingsStore.autoReframe}
          onChange={(e) => useSettingsStore.getState().patch({ autoReframe: e.target.checked })}
          className="accent-emerald-500 cursor-pointer"
        />
        <label htmlFor="auto-reframe" className="text-sm text-main cursor-pointer">
          {t("autoReframeLabel")}
          <Tooltip content={t("tipAutoReframe")} />
        </label>
      </div>

      {/* FastStart */}
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="faststart"
          checked={settings?.faststart ?? true}
          onChange={(e) => useSettingsStore.getState().patchVideoAdvanced({ faststart: e.target.checked })}
          className="accent-emerald-500 cursor-pointer"
        />
        <label htmlFor="faststart" className="text-sm text-main cursor-pointer">
          {t("faststartLabel")} ({t("webPlayback")})
          <Tooltip content={t("tipFaststart")} />
        </label>
      </div>

      {/* Strip metadata */}
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="strip-metadata"
          checked={settings?.stripMetadata ?? false}
          onChange={(e) => useSettingsStore.getState().patchVideoAdvanced({ stripMetadata: e.target.checked })}
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
