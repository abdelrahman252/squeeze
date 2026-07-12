import { useEffect, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { useSettingsStore } from "@/store/settings";
import { useJobsStore } from "@/store/jobs";
import { ArrowLeft, ArrowRight, X, Play } from "lucide-react";
interface TourStep {
  title: string;
  desc: string;
  selector: string | null;
  placement: "top" | "bottom" | "left" | "right" | "center";
}

export function TourGuide() {
  const { t, isRtl } = useTranslation();
  const hasSeenTour = useSettingsStore((s) => s.hasSeenTour);
  const [active, setActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [highlightRect, setHighlightRect] = useState<DOMRect | null>(null);

  // Trigger tour if user hasn't seen it yet
  useEffect(() => {
    if (!hasSeenTour) {
      setActive(true);
      // Load interactive demo files so the UI is fully populated
      useJobsStore.getState().loadDemoData();
    }
  }, [hasSeenTour]);

  // Restart tour trigger event listener
  useEffect(() => {
    const handleRestart = () => {
      setCurrentStep(0);
      setActive(true);
      useJobsStore.getState().loadDemoData();
    };
    window.addEventListener("squeeze-restart-tour", handleRestart);
    return () => window.removeEventListener("squeeze-restart-tour", handleRestart);
  }, []);

  const steps: TourStep[] = [
    {
      title: t("tourWelcomeTitle"),
      desc: t("tourWelcomeDesc"),
      selector: null,
      placement: "center",
    },
    {
      title: t("tourFileListTitle"),
      desc: t("tourFileListDesc"),
      selector: "#tour-file-list",
      placement: "top",
    },
    {
      title: t("tourTabsTitle"),
      desc: t("tourTabsDesc"),
      selector: "#tour-tab-selector",
      placement: "bottom",
    },
    {
      title: t("tourSettingsTitle"),
      desc: t("tourSettingsDesc"),
      selector: "#tour-settings-panel",
      placement: "top",
    },
    {
      title: t("tourActionTitle"),
      desc: t("tourActionDesc"),
      selector: "#tour-action-button",
      placement: "left",
    },
  ];

  // Track position of highlighted element
  useEffect(() => {
    if (!active) {
      setHighlightRect(null);
      return;
    }

    const updatePosition = () => {
      const step = steps[currentStep];
      if (step && step.selector) {
        const el = document.querySelector(step.selector);
        if (el) {
          setHighlightRect(el.getBoundingClientRect());
        } else {
          setHighlightRect(null);
        }
      } else {
        setHighlightRect(null);
      }
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    
    // Add small delay to let transitions complete before sizing
    const timer = setTimeout(updatePosition, 300);

    return () => {
      window.removeEventListener("resize", updatePosition);
      clearTimeout(timer);
    };
  }, [active, currentStep]);

  if (!active) return null;

  const stepInfo = steps[currentStep];

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = () => {
    setActive(false);
    useSettingsStore.getState().patch({ hasSeenTour: true });
    // Keep demo data in the list so they can play with Squeeze, or clear it if they want.
    // Keeping it is much better so they can trigger compression and see it.
  };

  const handleSkip = () => {
    setActive(false);
    useSettingsStore.getState().patch({ hasSeenTour: true });
    useJobsStore.getState().clearDemoData();
  };

  // Determine tooltip style coordinates
  const getTooltipStyle = () => {
    if (!highlightRect || stepInfo.placement === "center") {
      return {
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        position: "fixed" as const,
      };
    }

    const spacing = 16;
    const rect = highlightRect;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const tooltipWidth = 340;
    const tooltipHeight = 180; // approximate height of our card

    let top = 0;
    let left = 0;
    let transform = "";

    switch (stepInfo.placement) {
      case "top":
        top = rect.top - spacing;
        left = rect.left + rect.width / 2;
        transform = "translate(-50%, -100%)";
        break;
      case "bottom":
        top = rect.bottom + spacing;
        left = rect.left + rect.width / 2;
        transform = "translate(-50%, 0)";
        break;
      case "left":
        top = rect.top + rect.height / 2;
        left = rect.left - spacing;
        transform = isRtl ? "translate(0, -50%)" : "translate(-100%, -50%)";
        break;
      case "right":
        top = rect.top + rect.height / 2;
        left = rect.right + spacing;
        transform = isRtl ? "translate(-100%, -50%)" : "translate(0, -50%)";
        break;
      default:
        return {
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          position: "fixed" as const,
        };
    }

    // Boundary check and clamping
    // 1. Clamp horizontal (left) position so the tooltip stays within screen borders (with 12px margin)
    const minLeft = tooltipWidth / 2 + 12;
    const maxLeft = viewportWidth - tooltipWidth / 2 - 12;
    const clampedLeft = Math.max(minLeft, Math.min(maxLeft, left));

    // 2. Clamp vertical (top) position so it fits vertically
    let clampedTop = top;
    if (stepInfo.placement === "top") {
      // The tooltip sits above `top`. Bounding box: [top - tooltipHeight, top]
      // If it would go above the screen (top < tooltipHeight + 12), flip it to bottom of the element
      if (top - tooltipHeight < 12) {
        clampedTop = rect.bottom + spacing;
        transform = "translate(-50%, 0)"; // Flip to bottom
      }
    } else if (stepInfo.placement === "bottom") {
      // The tooltip sits below `top`. Bounding box: [top, top + tooltipHeight]
      // If it would go below the screen (top + tooltipHeight > viewportHeight - 12), flip it to top of the element
      if (top + tooltipHeight > viewportHeight - 12) {
        clampedTop = rect.top - spacing;
        transform = "translate(-50%, -100%)"; // Flip to top
      }
    } else {
      // For left/right placements, center is at `top`. Bounding box: [top - tooltipHeight/2, top + tooltipHeight/2]
      const minTop = tooltipHeight / 2 + 12;
      const maxTop = viewportHeight - tooltipHeight / 2 - 12;
      clampedTop = Math.max(minTop, Math.min(maxTop, top));
    }

    return {
      top: `${clampedTop}px`,
      left: `${clampedLeft}px`,
      transform,
      position: "fixed" as const,
    };
  };

  return (
    <div className="fixed inset-0 z-[9999] pointer-events-none overflow-hidden select-none">
      {/* Dark overlay backdrop with giant box shadow cutout */}
      <div 
        className="absolute inset-0 bg-black/60 transition-all duration-300 pointer-events-auto"
        style={{
          // Use clip-path cutout or mask if rect exists. If not, simple dark backdrop.
          clipPath: highlightRect 
            ? `polygon(
                0% 0%, 0% 100%, 
                ${highlightRect.left}px 100%, 
                ${highlightRect.left}px ${highlightRect.top}px, 
                ${highlightRect.right}px ${highlightRect.top}px, 
                ${highlightRect.right}px ${highlightRect.bottom}px, 
                ${highlightRect.left}px ${highlightRect.bottom}px, 
                ${highlightRect.left}px 100%, 
                100% 100%, 100% 0%
              )`
            : "none"
        }}
        onClick={handleSkip}
      />

      {/* Pulsing ring around the cutout */}
      {highlightRect && (
        <div 
          className="absolute border border-emerald-500/80 rounded-xl shadow-[0_0_15px_rgba(16,185,129,0.3)] animate-pulse transition-all duration-300"
          style={{
            top: `${highlightRect.top - 4}px`,
            left: `${highlightRect.left - 4}px`,
            width: `${highlightRect.width + 8}px`,
            height: `${highlightRect.height + 8}px`,
          }}
        />
      )}

      {/* Tooltip dialog card */}
      <div 
        style={getTooltipStyle()}
        className="w-[340px] bg-zinc-950/95 border border-zinc-800 rounded-2xl shadow-2xl p-5 select-text pointer-events-auto flex flex-col gap-3.5 transition-all duration-300"
      >
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-emerald-400 tracking-wider uppercase bg-emerald-950/40 px-2.5 py-1 rounded-full border border-emerald-900/30">
            {isRtl ? "جولة تفاعلية" : "SQUEEZE TOUR"}
          </span>
          <button 
            onClick={handleSkip}
            className="p-1 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 transition-colors cursor-pointer"
            title={t("tourSkip")}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex flex-col gap-1.5">
          <h3 className="text-sm font-bold text-zinc-100 flex items-center gap-1.5 leading-snug">
            {stepInfo.title}
          </h3>
          <p className="text-xs text-zinc-400 leading-relaxed font-normal">
            {stepInfo.desc}
          </p>
        </div>

        <div className="flex items-center justify-between mt-1 pt-3 border-t border-zinc-900">
          {/* Progress indicators dots */}
          <div className="flex items-center gap-1.5">
            {steps.map((_, idx) => (
              <div 
                key={idx}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  currentStep === idx 
                    ? "w-4 bg-emerald-500" 
                    : "w-1.5 bg-zinc-800"
                }`}
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            {currentStep > 0 && (
              <button 
                onClick={handlePrev}
                className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 transition-colors cursor-pointer flex items-center gap-1"
              >
                {isRtl ? <ArrowRight className="w-3 h-3" /> : <ArrowLeft className="w-3 h-3" />}
                {t("tourPrev")}
              </button>
            )}

            <button 
              onClick={handleNext}
              className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow-md shadow-emerald-900/20 flex items-center gap-1.5 cursor-pointer"
            >
              {currentStep === steps.length - 1 ? (
                <>
                  <Play className="w-3 h-3" />
                  {t("tourDone")}
                </>
              ) : (
                <>
                  {t("tourNext")}
                  {isRtl ? <ArrowLeft className="w-3 h-3" /> : <ArrowRight className="w-3 h-3" />}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
