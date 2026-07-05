import { cn } from "@/lib/utils";
import type { FileKind } from "@/types";
import { useTranslation } from "@/lib/i18n";

interface Props {
  counts: Record<FileKind | "all", number>;
  active: FileKind | "all";
  onSelect: (v: FileKind | "all") => void;
}

export function TypeFilterChips({ counts, active, onSelect }: Props) {
  const { t } = useTranslation();

  const chipsList = [
    { labelKey: "filterAll" as const,    value: "all" as const   },
    { labelKey: "filterVideo" as const,  value: "video" as const },
    { labelKey: "filterAudio" as const,  value: "audio" as const },
    { labelKey: "filterImage" as const,  value: "image" as const },
    { labelKey: "filterPdf" as const,    value: "pdf" as const   },
  ];

  const visible = chipsList.filter((c) => c.value === "all" || counts[c.value] > 0);

  return (
    <div className="flex items-center gap-1.5 px-3 py-2 shrink-0 flex-wrap">
      {visible.map((chip) => (
        <button
          key={chip.value}
          onClick={() => onSelect(chip.value)}
          className={cn(
            "flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium transition-colors cursor-pointer",
            active === chip.value
              ? "bg-indigo-600 text-white"
              : "bg-bg-panel text-text-sub hover:bg-bg-panel-hover hover:text-main border border-border-sub"
          )}
        >
          {t(chip.labelKey)}
          <span
            className={cn(
              "text-[10px] font-semibold",
              active === chip.value ? "text-indigo-200" : "text-text-sub"
            )}
          >
            {counts[chip.value]}
          </span>
        </button>
      ))}
    </div>
  );
}
