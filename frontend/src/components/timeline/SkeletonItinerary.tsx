"use client";

import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, Loader2 } from "lucide-react";
import { useTravelStore, PlanningStep } from "@/store/travel-store";
import { PLANNING_STEPS } from "@/lib/quick-actions";

export default function SkeletonItinerary() {
  const planningStep = useTravelStore((s) => s.planningStep);
  const setPlanningStep = useTravelStore((s) => s.setPlanningStep);
  const isPlanning = useTravelStore((s) => s.isPlanning);

  useEffect(() => {
    if (!isPlanning) return;
    const idx = PLANNING_STEPS.findIndex((s) => s.key === planningStep);
    if (idx === -1 || idx >= PLANNING_STEPS.length - 1) return;
    const current = PLANNING_STEPS[idx];
    const t = setTimeout(() => {
      setPlanningStep(PLANNING_STEPS[idx + 1].key as PlanningStep);
    }, current.duration);
    return () => clearTimeout(t);
  }, [planningStep, isPlanning, setPlanningStep]);

  const currentIdx = PLANNING_STEPS.findIndex((s) => s.key === planningStep);

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4 relative">
      {/* Header banner skeleton */}
      <div className="rounded-lg bg-sand border border-border p-4 relative overflow-hidden shadow-sm">
        <ShimmerOverlay />
        <div className="space-y-2 relative">
          <div className="h-5 w-3/4 bg-clay/20 rounded-sm" />
          <div className="h-3 w-1/2 bg-clay/15 rounded-sm" />
          <div className="h-3 w-2/3 bg-clay/15 rounded-sm mt-2" />
        </div>
      </div>

      {/* Processing steps */}
      <div className="rounded-sm border border-terracotta/20 bg-terracotta/5 p-4 space-y-2.5 shadow-sm">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-terracotta mb-2">
          TravelBot đang lập kế hoạch...
        </p>
        {PLANNING_STEPS.map((step, idx) => {
          const isDone = idx < currentIdx;
          const isActive = idx === currentIdx;
          const isPending = idx > currentIdx;

          return (
            <motion.div
              key={step.key}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: isPending ? 0.4 : 1, x: 0 }}
              transition={{ duration: 0.3, delay: idx * 0.05 }}
              className="flex items-center gap-3"
            >
              <div className="w-7 h-7 rounded-sm flex items-center justify-center shrink-0 text-sm">
                {isDone && (
                  <CheckCircle2 className="w-5 h-5 text-terracotta" />
                )}
                {isActive && (
                  <Loader2 className="w-5 h-5 text-terracotta animate-spin" />
                )}
                {isPending && (
                  <span className="w-5 h-5 rounded-sm border-2 border-dashed border-clay/30" />
                )}
              </div>
              <span
                className={`text-sm flex-1 ${
                  isActive
                    ? "text-foreground font-semibold"
                    : isDone
                    ? "text-muted-foreground line-through"
                    : "text-muted-foreground"
                }`}
              >
                {step.icon} {step.message}
              </span>
            </motion.div>
          );
        })}
      </div>

      {/* Placeholder day skeletons */}
      {[1, 2, 3].map((d) => (
        <div key={d} className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-md bg-sand border border-border relative overflow-hidden">
              <ShimmerOverlay />
            </div>
            <div className="flex-1 space-y-1">
              <div className="h-3 w-1/3 bg-muted rounded-sm relative overflow-hidden">
                <ShimmerOverlay />
              </div>
              <div className="h-2 w-1/4 bg-muted rounded-sm relative overflow-hidden">
                <ShimmerOverlay />
              </div>
            </div>
          </div>
          <div className="ml-3.5 pl-5 border-l-2 border-dashed border-clay/15 space-y-2">
            {[1, 2].map((a) => (
              <div key={a} className="rounded-sm border border-border bg-card p-3 relative overflow-hidden shadow-sm">
                <ShimmerOverlay />
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-sm bg-muted shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 w-2/3 bg-muted rounded-sm" />
                    <div className="h-2 w-full bg-muted rounded-sm" />
                    <div className="h-2 w-3/4 bg-muted rounded-sm" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      <AnimatePresence>
        {isPlanning && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="pointer-events-none fixed inset-0 backdrop-blur-[1px] -z-10"
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function ShimmerOverlay() {
  return (
    <motion.div
      className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/40 dark:via-white/10 to-transparent"
      animate={{ translateX: ["-100%", "200%"] }}
      transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
    />
  );
}
