import { Settings, Sun, Moon, HelpCircle } from "lucide-react";
import { useUiStore } from "@/store/ui";
import { useTranslation } from "@/lib/i18n";

export function Titlebar() {
  const { t } = useTranslation();
  const isAdvancedOpen = useUiStore((s) => s.isAdvancedOpen);
  const theme = useUiStore((s) => s.theme);
  const lang = useUiStore((s) => s.lang);

  const toggleTheme = () => {
    useUiStore.getState().setTheme(theme === "dark" ? "light" : "dark");
  };

  const toggleLang = () => {
    useUiStore.getState().setLang(lang === "en" ? "ar" : "en");
  };

  return (
    <div
      data-tauri-drag-region
      className="flex items-center justify-between h-10 px-4 select-none shrink-0"
    >
      <div className="flex items-center">
        <img src="/logo.png" className="h-6 w-auto me-2" alt={t("title")} draggable={false} />
        <span className="text-sm font-semibold text-main">{t("title")}</span>
      </div>
      
      {/* Control buttons: left of Windows caption buttons (always on the right) */}
      <div className="flex items-center gap-1.5 mr-[138px]">
        {/* Language switcher */}
        <button
          onClick={toggleLang}
          className="text-xs font-semibold px-2 py-1 rounded hover:bg-zinc-200/20 text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
          title={lang === "en" ? "العربية" : "English"}
        >
          {lang === "en" ? "العربية" : "English"}
        </button>

        {/* Theme switcher */}
        <button
          onClick={toggleTheme}
          className="p-1.5 rounded-lg hover:bg-zinc-200/20 text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
          title={theme === "dark" ? "Light Mode" : "Dark Mode"}
        >
          {theme === "dark" ? (
            <Sun className="h-4 w-4" />
          ) : (
            <Moon className="h-4 w-4" />
          )}
        </button>

        {/* Onboarding Tour button */}
        <button
          onClick={() => window.dispatchEvent(new CustomEvent("squeeze-restart-tour"))}
          className="p-1.5 rounded-lg hover:bg-zinc-200/20 text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
          title={t("tourRestart")}
        >
          <HelpCircle className="h-4 w-4" />
        </button>

        {/* Settings button */}
        <button
          onClick={() => useUiStore.getState().setAdvancedOpen(!isAdvancedOpen)}
          className="p-1.5 rounded-lg hover:bg-zinc-200/20 text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
          aria-label={t("advancedSettings")}
          title={t("advancedSettings")}
        >
          <Settings className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
