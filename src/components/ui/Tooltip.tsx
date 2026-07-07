import { HelpCircle } from "lucide-react";

export function Tooltip({ content }: { content: string }) {
  return (
    <span className="group relative inline-block cursor-help ml-1 align-middle select-none">
      <HelpCircle className="h-3.5 w-3.5 text-zinc-500 hover:text-emerald-400 transition-colors" />
      <span className="pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-200 absolute bottom-full left-1/2 -translate-x-1/2 mb-2 p-2 bg-zinc-950 text-[10px] text-zinc-300 font-sans font-medium border border-zinc-800 rounded-lg w-48 text-center shadow-xl z-50 leading-relaxed normal-case">
        {content}
      </span>
    </span>
  );
}
