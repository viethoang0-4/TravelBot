"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Backpack,
  CalendarDays,
  MapPin,
  Search,
  Wallet,
  CornerDownLeft,
  Route,
} from "lucide-react";
import { useTravelStore } from "@/store/travel-store";
import { RightPanelTab } from "@/types/travel";
import { cn } from "@/lib/utils";

interface Command {
  id: string;
  label: string;
  hint?: string;
  group: string;
  icon: React.ComponentType<{ className?: string }>;
  keywords: string;
  run: () => void;
}

const TAB_META: { id: RightPanelTab; label: string; icon: Command["icon"] }[] = [
  { id: "timeline", label: "Lịch trình", icon: CalendarDays },
  { id: "map", label: "Bản đồ", icon: MapPin },
  { id: "budget", label: "Ngân sách", icon: Wallet },
  { id: "checklist", label: "Chuẩn bị", icon: Backpack },
];

/** Bỏ dấu tiếng Việt để tìm kiếm không phân biệt dấu */
function deburr(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();
}

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const drafts = useTravelStore((s) => s.drafts);
  const activeDraftId = useTravelStore((s) => s.activeDraftId);
  const setActiveTab = useTravelStore((s) => s.setActiveTab);
  const switchDraft = useTravelStore((s) => s.switchDraft);
  const setSelectedActivity = useTravelStore((s) => s.setSelectedActivity);

  const activeItinerary = useMemo(
    () => drafts.find((d) => d.draft_id === activeDraftId)?.itinerary ?? null,
    [drafts, activeDraftId]
  );

  // Ctrl/Cmd+K để bật/tắt, Esc để đóng (+ custom event từ nút trên Navbar).
  // Reset state ngay trong handler (không setState trong effect body).
  useEffect(() => {
    const reset = () => {
      setQuery("");
      setActive(0);
    };
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        reset();
        setOpen((v) => !v);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    };
    const openPalette = () => {
      reset();
      setOpen(true);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("travelbot:open-command-palette", openPalette);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("travelbot:open-command-palette", openPalette);
    };
  }, []);

  // Focus ô input khi mở (sync DOM — không setState nên hợp lệ trong effect)
  useEffect(() => {
    if (open) requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  const commands = useMemo<Command[]>(() => {
    const close = () => setOpen(false);
    const list: Command[] = [];

    // Điều hướng
    for (const t of TAB_META) {
      list.push({
        id: `tab-${t.id}`,
        label: t.label,
        hint: "Chuyển tab",
        group: "Điều hướng",
        icon: t.icon,
        keywords: `${t.label} ${t.id} tab`,
        run: () => {
          setActiveTab(t.id);
          close();
        },
      });
    }

    // Lịch trình của bạn
    for (const d of drafts) {
      const isActive = d.draft_id === activeDraftId;
      list.push({
        id: `draft-${d.draft_id}`,
        label: d.itinerary.title,
        hint: isActive ? "Đang xem" : d.status === "confirmed" ? "Đã chốt" : "Nháp",
        group: "Lịch trình của bạn",
        icon: Route,
        keywords: `${d.itinerary.title} ${d.itinerary.destination}`,
        run: () => {
          switchDraft(d.draft_id);
          close();
        },
      });
    }

    // Hoạt động (của lịch trình đang xem) → chọn + mở bản đồ
    if (activeItinerary) {
      for (const day of activeItinerary.days) {
        for (const a of day.activities) {
          list.push({
            id: `act-${a.id}`,
            label: a.title,
            hint: `Ngày ${day.day} · ${a.time}`,
            group: "Hoạt động",
            icon: MapPin,
            keywords: `${a.title} ${a.location.name} ngay ${day.day}`,
            run: () => {
              setSelectedActivity(a.id);
              setActiveTab("map");
              close();
            },
          });
        }
      }
    }

    return list;
  }, [drafts, activeDraftId, activeItinerary, setActiveTab, switchDraft, setSelectedActivity]);

  const filtered = useMemo(() => {
    const q = deburr(query.trim());
    if (!q) return commands;
    return commands.filter((c) => deburr(c.keywords).includes(q));
  }, [commands, query]);

  // Con trỏ "thực" đã kẹp trong phạm vi danh sách đã lọc (derived — không cần effect)
  const safeActive = filtered.length === 0 ? -1 : Math.min(active, filtered.length - 1);

  const onListKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive(Math.min(safeActive + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive(Math.max(safeActive - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      filtered[safeActive]?.run();
    }
  };

  // Cuộn item active vào tầm nhìn (sync DOM — hợp lệ)
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-idx="${safeActive}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [safeActive]);

  // Render danh sách kèm tiêu đề nhóm
  let lastGroup = "";

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[200] flex items-start justify-center p-4 pt-[12vh]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-ink/40 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />

          {/* Panel */}
          <motion.div
            className="relative w-full max-w-lg overflow-hidden rounded-xl border border-border bg-popover shadow-wf"
            initial={{ opacity: 0, scale: 0.96, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -8 }}
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
            onKeyDown={onListKeyDown}
          >
            {/* Ô tìm kiếm */}
            <div className="flex items-center gap-2.5 border-b border-border px-4">
              <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Tìm tab, lịch trình, địa điểm..."
                className="h-12 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
              />
              <kbd className="hidden rounded border border-border bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground sm:inline">
                ESC
              </kbd>
            </div>

            {/* Danh sách lệnh */}
            <div ref={listRef} className="max-h-[320px] overflow-y-auto p-2">
              {filtered.length === 0 ? (
                <div className="py-10 text-center text-sm text-muted-foreground">
                  Không tìm thấy kết quả.
                </div>
              ) : (
                filtered.map((cmd, idx) => {
                  const Icon = cmd.icon;
                  const showHeader = cmd.group !== lastGroup;
                  lastGroup = cmd.group;
                  return (
                    <div key={cmd.id}>
                      {showHeader && (
                        <div className="px-2 pb-1 pt-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                          {cmd.group}
                        </div>
                      )}
                      <button
                        data-idx={idx}
                        onClick={() => cmd.run()}
                        onMouseMove={() => setActive(idx)}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-md px-2 py-2 text-left transition-colors",
                          idx === safeActive
                            ? "bg-terracotta/10 text-terracotta"
                            : "text-foreground hover:bg-muted"
                        )}
                      >
                        <Icon
                          className={cn(
                            "h-4 w-4 shrink-0",
                            idx === safeActive ? "text-terracotta" : "text-muted-foreground"
                          )}
                        />
                        <span className="flex-1 truncate text-sm font-medium">
                          {cmd.label}
                        </span>
                        {cmd.hint && (
                          <span className="shrink-0 text-[12px] text-muted-foreground">
                            {cmd.hint}
                          </span>
                        )}
                        {idx === safeActive && (
                          <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-terracotta" />
                        )}
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer gợi ý phím */}
            <div className="flex items-center gap-3 border-t border-border bg-muted/40 px-4 py-2 text-[12px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <kbd className="rounded border border-border bg-background px-1">↑</kbd>
                <kbd className="rounded border border-border bg-background px-1">↓</kbd>
                điều hướng
              </span>
              <span className="flex items-center gap-1">
                <kbd className="rounded border border-border bg-background px-1">↵</kbd>
                chọn
              </span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
