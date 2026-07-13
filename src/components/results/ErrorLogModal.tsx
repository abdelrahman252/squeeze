import { X, Copy, Terminal } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

interface ErrorLogModalProps {
  jobName: string;
  errorMessage: string;
  onClose: () => void;
}

export function ErrorLogModal({ jobName, errorMessage, onClose }: ErrorLogModalProps) {
  const copyToClipboard = () => {
    navigator.clipboard.writeText(errorMessage)
      .then(() => toast.success("Error log copied to clipboard!"))
      .catch(() => toast.error("Failed to copy log"));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-8 bg-black/80">
      {/* Backdrop animation */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 cursor-default"
      />

      {/* Modal Dialog container animation */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className="relative w-full max-w-2xl bg-zinc-950 rounded-xl overflow-hidden border border-zinc-800 shadow-2xl flex flex-col max-h-[70vh] z-10"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 bg-zinc-900/40 shrink-0 select-none">
          <div className="flex items-center gap-2 text-zinc-100 font-semibold text-sm">
            <Terminal className="w-4 h-4 text-rose-500" />
            <span>Process Error Log: <span className="font-mono text-zinc-300">{jobName}</span></span>
          </div>
          <button onClick={onClose} className="p-1 text-zinc-400 hover:text-zinc-200 cursor-pointer transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content - Terminal Style Log */}
        <div className="flex-1 overflow-y-auto p-4 bg-zinc-950/80 font-mono text-[11px] text-zinc-300 select-text leading-relaxed whitespace-pre-wrap selection:bg-rose-500/30">
          {errorMessage}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-4 py-3 border-t border-zinc-800 bg-zinc-900/20 shrink-0 gap-2 select-none">
          <button
            onClick={copyToClipboard}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-800 hover:bg-zinc-800 text-xs text-zinc-300 hover:text-white transition-all cursor-pointer font-medium"
          >
            <Copy className="w-3.5 h-3.5" />
            Copy Log
          </button>
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs text-white transition-all cursor-pointer font-semibold shadow-md shadow-emerald-600/20"
          >
            Close
          </button>
        </div>
      </motion.div>
    </div>
  );
}
