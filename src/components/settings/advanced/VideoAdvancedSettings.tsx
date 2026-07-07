import { useVideoAdvanced, useSettingsStore } from "@/store/settings";
import { useTranslation } from "@/lib/i18n";
import { Tooltip } from "@/components/ui/Tooltip";

export function VideoAdvancedSettings() {
  const { t } = useTranslation();
  const settings = useVideoAdvanced();

  return (
    <div className="space-y-6">
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
    </div>
  );
}
