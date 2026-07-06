import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { FileKind } from "@/types";

type KindFilter = "all" | FileKind;

interface UiState {
  isAdvancedOpen: boolean;
  activeKindFilter: KindFilter;
  theme: "dark" | "light";
  lang: "en" | "ar";
  activeTab: "compress" | "convert";
  setAdvancedOpen: (v: boolean) => void;
  setKindFilter: (v: KindFilter) => void;
  setTheme: (v: "dark" | "light") => void;
  setLang: (v: "en" | "ar") => void;
  setActiveTab: (v: "compress" | "convert") => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      isAdvancedOpen: false,
      activeKindFilter: "all",
      theme: "dark",
      lang: "en",
      activeTab: "compress",
      setAdvancedOpen: (v) => set({ isAdvancedOpen: v }),
      setKindFilter: (v) => set({ activeKindFilter: v }),
      setTheme: (v) => set({ theme: v }),
      setLang: (v) => set({ lang: v }),
      setActiveTab: (v) => set({ activeTab: v }),
    }),
    {
      name: "squeeze-ui-settings",
      partialize: (state) => ({ theme: state.theme, lang: state.lang, activeTab: state.activeTab }),
    }
  )
);

// Atomic selectors (HR-7)
export const useIsAdvancedOpen = () => useUiStore((s) => s.isAdvancedOpen);
export const useActiveKindFilter = () => useUiStore((s) => s.activeKindFilter);
export const useTheme = () => useUiStore((s) => s.theme);
export const useLang = () => useUiStore((s) => s.lang);
export const useActiveTab = () => useUiStore((s) => s.activeTab);
