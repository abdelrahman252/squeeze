import { useTranslation } from "@/lib/i18n";

export function EmptyState({ isDraggingOver }: { isDraggingOver: boolean }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center justify-center gap-2">
      <p className="text-zinc-400 text-base font-medium transition-colors">
        {isDraggingOver ? <span className="text-indigo-400">{t("releaseToAdd")}</span> : t("dropFilesHere")}
      </p>
      <p className="text-zinc-500 text-sm">{t("videoAudioImagePdf")}</p>
    </div>
  );
}
