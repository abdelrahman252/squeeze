import { useTranslation } from "@/lib/i18n";
import { useActiveTab } from "@/store/ui";

export function EmptyState({ isDraggingOver }: { isDraggingOver: boolean }) {
  const { t } = useTranslation();
  const activeTab = useActiveTab();

  const getDropLabel = () => {
    if (isDraggingOver) return t("releaseToAdd");
    switch (activeTab) {
      case "convert":
        return t("dropFilesHereConvert");
      case "remove-bg":
        return t("dropFilesHereRemoveBg");
      case "enhance":
        return t("dropFilesHereEnhance");
      default:
        return t("dropFilesHere");
    }
  };

  const getSubLabel = () => {
    switch (activeTab) {
      case "convert":
        return t("videoAudioImage");
      case "remove-bg":
        return t("filterImage");
      case "enhance":
        return t("videoImage");
      default:
        return t("videoAudioImagePdf");
    }
  };

  return (
    <div className="flex flex-col items-center justify-center gap-2">
      <p className="text-zinc-400 text-base font-medium transition-colors text-center px-4">
        {isDraggingOver ? <span className="text-emerald-400">{getDropLabel()}</span> : getDropLabel()}
      </p>
      <p className="text-zinc-500 text-sm text-center">{getSubLabel()}</p>
    </div>
  );
}
