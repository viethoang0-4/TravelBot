"use client";

import { useTravelStore } from "@/store/travel-store";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Calendar, CheckCircle2, FileEdit, MapPin, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

function formatRelativeDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "vừa xong";
  if (diffMin < 60) return `${diffMin} phút trước`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH} giờ trước`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `${diffD} ngày trước`;
  return d.toLocaleDateString("vi-VN");
}

export default function DraftsBar() {
  const drafts = useTravelStore((s) => s.drafts);
  const activeDraftId = useTravelStore((s) => s.activeDraftId);
  const switchDraft = useTravelStore((s) => s.switchDraft);
  const deleteDraft = useTravelStore((s) => s.deleteDraft);

  if (drafts.length === 0) return null;

  const sorted = [...drafts].sort((a, b) => {
    if (a.status !== b.status) return a.status === "confirmed" ? -1 : 1;
    return b.updated_at.localeCompare(a.updated_at);
  });

  return (
    <div className="border-b border-border bg-muted/30 shrink-0">
      <div className="px-3 py-2 flex items-center gap-2 overflow-x-auto scrollbar-thin">
        <span className="text-[11px] font-semibold uppercase tracking-wider shrink-0 mr-1 text-muted-foreground">
          Lịch trình ({drafts.length})
        </span>

        <AnimatePresence initial={false}>
          {sorted.map((draft) => {
            const isActive = draft.draft_id === activeDraftId;
            const isConfirmed = draft.status === "confirmed";
            return (
              <motion.div
                key={draft.draft_id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.2 }}
                className="shrink-0"
              >
                <button
                  onClick={() => switchDraft(draft.draft_id)}
                  className={cn(
                    "group relative flex items-center gap-2 pl-3 pr-2 py-1.5 rounded-sm text-left transition-all",
                    "border min-w-[180px] max-w-[260px]",
                    isActive
                      ? "bg-background border-terracotta shadow-sm ring-2 ring-terracotta/20"
                      : "bg-background/60 border-border hover:border-terracotta/50 hover:bg-background"
                  )}
                >
                  <div
                    className={cn(
                      "w-7 h-7 rounded-sm flex items-center justify-center shrink-0",
                      isConfirmed
                        ? "bg-sage/15 text-sage"
                        : "bg-sand text-clay"
                    )}
                  >
                    {isConfirmed ? (
                      <CheckCircle2 className="w-4 h-4" />
                    ) : (
                      <FileEdit className="w-4 h-4" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold truncate text-foreground">
                        {draft.itinerary.title}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                      <Calendar className="w-2.5 h-2.5" />
                      <span>{formatRelativeDate(draft.created_at)}</span>
                      <span>·</span>
                      <MapPin className="w-2.5 h-2.5" />
                      <span className="truncate">{draft.itinerary.destination.split(",")[0]}</span>
                    </div>
                  </div>

                  <Badge
                    className={cn(
                      "text-[9px] px-1.5 py-0 h-4 shrink-0 border-0",
                      isConfirmed
                        ? "bg-sage/15 text-sage"
                        : "bg-clay/10 text-clay"
                    )}
                  >
                    {isConfirmed ? "Đã chốt" : "Nháp"}
                  </Badge>

                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`Xoá lịch trình "${draft.itinerary.title}"?`)) {
                        deleteDraft(draft.draft_id);
                      }
                    }}
                    className="opacity-0 group-hover:opacity-100 absolute -top-1 -right-1 w-4 h-4 rounded-full bg-destructive text-white flex items-center justify-center transition-opacity shadow-sm"
                  >
                    <X className="w-2.5 h-2.5" />
                  </span>
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
