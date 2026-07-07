import { useAudioAdvanced, useSettingsStore } from "@/store/settings";
import { useTranslation } from "@/lib/i18n";
import { Tooltip } from "@/components/ui/Tooltip";

export function AudioAdvancedSettings() {
  const { t } = useTranslation();
  const settings = useAudioAdvanced();
  const settingsStore = useSettingsStore();

  return (
    <div className="space-y-6">
      {/* Codec */}
      <div>
        <label className="block text-sm font-medium text-main mb-2">
          {t("codec")}
          <Tooltip content={t("tipAudioCodec")} />
        </label>
        <select
          value={settings?.codec ?? "aac"}
          onChange={(e) => useSettingsStore.getState().patchAudioAdvanced({ codec: e.target.value as "mp3" | "aac" | "opus" | "flac" | "wav" })}
          className="w-full bg-bg-app border border-border-main rounded-lg px-3 py-2 text-sm text-main focus:outline-none focus:border-emerald-500 cursor-pointer"
        >
          <option value="aac" className="bg-bg-app">AAC</option>
          <option value="mp3" className="bg-bg-app">MP3</option>
          <option value="opus" className="bg-bg-app">Opus</option>
          <option value="flac" className="bg-bg-app">FLAC (lossless)</option>
          <option value="wav" className="bg-bg-app">WAV (uncompressed)</option>
        </select>
      </div>

      {/* Bitrate */}
      <div>
        <label className="block text-sm font-medium text-main mb-2">
          {t("bitrateLabel")} (kbps)
          <Tooltip content={t("tipAudioKbps")} />
        </label>
        <input
          type="number"
          value={settings?.kbps ?? 128}
          onChange={(e) => useSettingsStore.getState().patchAudioAdvanced({ kbps: parseInt(e.target.value) })}
          className="w-full bg-bg-app border border-border-main rounded-lg px-3 py-2 text-sm text-main focus:outline-none focus:border-emerald-500"
        />
      </div>

      {/* Sample rate */}
      <div>
        <label className="block text-sm font-medium text-main mb-2">
          {t("sampleRateLabel")} (Hz)
          <Tooltip content={t("tipAudioSampleRate")} />
        </label>
        <select
          value={settings?.sampleRate ?? ""}
          onChange={(e) => useSettingsStore.getState().patchAudioAdvanced({ sampleRate: e.target.value ? parseInt(e.target.value) : undefined })}
          className="w-full bg-bg-app border border-border-main rounded-lg px-3 py-2 text-sm text-main focus:outline-none focus:border-emerald-500 cursor-pointer"
        >
          <option value="" className="bg-bg-app">{t("default")}</option>
          <option value="48000" className="bg-bg-app">48000</option>
          <option value="44100" className="bg-bg-app">44100</option>
          <option value="22050" className="bg-bg-app">22050</option>
        </select>
      </div>

      {/* Audio Cleanup */}
      <div className="flex items-center gap-2 border-t border-border-main pt-4">
        <input
          type="checkbox"
          id="audio-cleanup-audio"
          checked={settingsStore.audioCleanup}
          onChange={(e) => useSettingsStore.getState().patch({ audioCleanup: e.target.checked })}
          className="accent-emerald-500 cursor-pointer"
        />
        <label htmlFor="audio-cleanup-audio" className="text-sm text-main cursor-pointer">
          {t("audioCleanupLabel")}
          <Tooltip content={t("tipAudioCleanup")} />
        </label>
      </div>
    </div>
  );
}
