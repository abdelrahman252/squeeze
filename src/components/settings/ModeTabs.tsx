import { useUiStore, useActiveTab } from "@/store/ui";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export function ModeTabs() {
  const { t } = useTranslation();
  const activeTab = useActiveTab();

  return (
    <div className="px-3 pt-1 pb-2 shrink-0">
      <div id="tour-tab-selector" className="flex items-center gap-1 p-1 bg-bg-panel border border-border-sub rounded-lg w-fit">
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
        <button
          onClick={() => useUiStore.getState().setActiveTab("remove-bg")}
          className={cn(
            "px-4 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer",
            activeTab === "remove-bg"
              ? "bg-emerald-600 text-white shadow shadow-emerald-600/30"
              : "text-text-sub hover:text-main"
          )}
        >
          {t("removeBgTab")}
        </button>
        <button
          onClick={() => useUiStore.getState().setActiveTab("enhance")}
          className={cn(
            "px-4 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer",
            activeTab === "enhance"
              ? "bg-emerald-600 text-white shadow shadow-emerald-600/30"
              : "text-text-sub hover:text-main"
          )}
        >
          {t("enhanceTab")}
        </button>
      </div>
    </div>
  );
}
