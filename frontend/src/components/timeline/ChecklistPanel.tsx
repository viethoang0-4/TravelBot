"use client";

import { useEffect, useReducer, useState } from "react";
import { useActiveItinerary, useActiveDraft } from "@/store/travel-store";
import { Cloud, Backpack, Lightbulb, RotateCcw, Plus, X } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { motion, AnimatePresence } from "framer-motion";
import {
  DEFAULT_CHECKLIST,
  DEFAULT_CATEGORIES,
  CULTURAL_NOTES,
  ChecklistItem,
} from "@/lib/checklist-defaults";
import { suggestChecklistItems } from "@/lib/checklist-suggestions";
import { nanoid } from "nanoid";

// ─── State ────────────────────────────────────────────────────────────────────

interface ChecklistState {
  removedDefaults: string[];
  customItems: ChecklistItem[];
  checked: string[];
  dismissedSuggestions: string[];
  acceptedSuggestions: string[];
}

type Action =
  | { type: "TOGGLE"; id: string }
  | { type: "REMOVE_DEFAULT"; id: string }
  | { type: "REMOVE_CUSTOM"; id: string }
  | { type: "ADD_CUSTOM"; item: ChecklistItem }
  | { type: "RESET_DEFAULTS" }
  | { type: "ACCEPT_SUGGESTION"; item: ChecklistItem }
  | { type: "DISMISS_SUGGESTION"; id: string }
  | { type: "LOAD"; state: ChecklistState };

function reducer(state: ChecklistState, action: Action): ChecklistState {
  switch (action.type) {
    case "TOGGLE": {
      const checked = state.checked.includes(action.id)
        ? state.checked.filter((id) => id !== action.id)
        : [...state.checked, action.id];
      return { ...state, checked };
    }
    case "REMOVE_DEFAULT":
      return {
        ...state,
        removedDefaults: [...state.removedDefaults, action.id],
        checked: state.checked.filter((id) => id !== action.id),
      };
    case "REMOVE_CUSTOM":
      return {
        ...state,
        customItems: state.customItems.filter((i) => i.id !== action.id),
        checked: state.checked.filter((id) => id !== action.id),
      };
    case "ADD_CUSTOM":
      return { ...state, customItems: [...state.customItems, action.item] };
    case "RESET_DEFAULTS":
      return { ...state, removedDefaults: [] };
    case "ACCEPT_SUGGESTION":
      return {
        ...state,
        customItems: [...state.customItems, action.item],
        acceptedSuggestions: [...state.acceptedSuggestions, action.item.id],
      };
    case "DISMISS_SUGGESTION":
      return {
        ...state,
        dismissedSuggestions: [...state.dismissedSuggestions, action.id],
      };
    case "LOAD":
      return action.state;
    default:
      return state;
  }
}

const INITIAL_STATE: ChecklistState = {
  removedDefaults: [],
  customItems: [],
  checked: [],
  dismissedSuggestions: [],
  acceptedSuggestions: [],
};

function migrateOldState(raw: unknown): ChecklistState {
  // Old format: plain array of checked ids
  if (Array.isArray(raw)) {
    return { ...INITIAL_STATE, checked: raw as string[] };
  }
  if (raw && typeof raw === "object") {
    return raw as ChecklistState;
  }
  return INITIAL_STATE;
}

// ─── AddItemInput ─────────────────────────────────────────────────────────────

function AddItemInput({ onAdd }: { onAdd: (label: string) => void }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");

  const commit = () => {
    const trimmed = value.trim();
    if (trimmed) {
      onAdd(trimmed);
      setValue("");
    }
    setOpen(false);
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-terracotta transition-colors py-1 pl-1"
      >
        <Plus className="w-3.5 h-3.5" />
        Thêm mục…
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1.5 mt-1">
      <input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") setOpen(false);
        }}
        placeholder="Tên mục…"
        className="flex-1 text-[13px] bg-card border border-border rounded-sm px-2 py-1.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-terracotta"
      />
      <button
        onClick={commit}
        className="text-[13px] bg-terracotta text-white px-2 py-1.5 rounded-sm hover:bg-terracotta-dark transition-colors"
      >
        Thêm
      </button>
      <button
        onClick={() => setOpen(false)}
        className="text-[13px] text-muted-foreground hover:text-foreground px-1 py-1.5"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ChecklistPanel() {
  const itinerary = useActiveItinerary();
  const draft = useActiveDraft();
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // Load from localStorage
  useEffect(() => {
    if (!draft?.draft_id) return;
    const v2key = `checklist:v2:${draft.draft_id}`;
    const oldKey = `checklist:${draft.draft_id}`;
    const raw = localStorage.getItem(v2key) ?? localStorage.getItem(oldKey);
    if (raw) {
      try {
        dispatch({ type: "LOAD", state: migrateOldState(JSON.parse(raw)) });
      } catch {
        dispatch({ type: "LOAD", state: INITIAL_STATE });
      }
    } else {
      dispatch({ type: "LOAD", state: INITIAL_STATE });
    }
  }, [draft?.draft_id]);

  // Save to localStorage on change
  useEffect(() => {
    if (!draft?.draft_id) return;
    const v2key = `checklist:v2:${draft.draft_id}`;
    localStorage.setItem(v2key, JSON.stringify(state));
  }, [state, draft?.draft_id]);

  if (!itinerary) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 p-8 text-center">
        <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center">
          <Backpack className="w-8 h-8 text-muted-foreground" />
        </div>
        <p className="text-sm text-muted-foreground">
          Tạo lịch trình để xem checklist chuẩn bị
        </p>
      </div>
    );
  }

  // Build active checklist: defaults minus removed + custom items
  const activeDefaults = DEFAULT_CHECKLIST.filter(
    (i) => !state.removedDefaults.includes(i.id)
  );
  const allItems = [...activeDefaults, ...state.customItems];
  const totalItems = allItems.length;
  const checkedCount = allItems.filter((i) => state.checked.includes(i.id)).length;
  const progress = totalItems > 0 ? Math.round((checkedCount / totalItems) * 100) : 0;

  // Suggestions
  const suggestions = suggestChecklistItems(itinerary).filter(
    (s) =>
      !state.dismissedSuggestions.includes(s.id) &&
      !state.acceptedSuggestions.includes(s.id) &&
      !state.customItems.some((c) => c.id === s.id)
  );

  // Group all items by category
  const grouped: Record<string, ChecklistItem[]> = {};
  for (const cat of DEFAULT_CATEGORIES) {
    const items = allItems.filter((i) => i.category === cat);
    if (items.length > 0 || activeDefaults.some((d) => d.category === cat)) {
      grouped[cat] = items;
    }
  }
  // Extra custom categories not in defaults
  for (const item of state.customItems) {
    if (!DEFAULT_CATEGORIES.includes(item.category)) {
      if (!grouped[item.category]) grouped[item.category] = [];
      grouped[item.category].push(item);
    }
  }

  const handleReset = () => {
    dispatch({ type: "RESET_DEFAULTS" });
    setShowResetConfirm(false);
  };

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-4">

        {/* Progress header */}
        <div className="rounded-lg bg-terracotta p-4 text-white">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <Backpack className="w-5 h-5" />
              <h2 className="font-bold">Chuẩn bị cho chuyến đi</h2>
            </div>
            <button
              onClick={() => setShowResetConfirm(true)}
              className="flex items-center gap-1 text-[11px] bg-white/20 hover:bg-white/30 text-white px-2 py-1 rounded-sm transition-colors shrink-0"
              title="Khôi phục danh sách mặc định"
            >
              <RotateCcw className="w-3 h-3" />
              Khôi phục
            </button>
          </div>
          <p className="text-white/80 text-[13px] mb-3">
            {checkedCount}/{totalItems} mục đã chuẩn bị
          </p>
          <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.5 }}
              className="h-full bg-white/60 rounded-full"
            />
          </div>
        </div>

        {/* Reset confirm */}
        <AnimatePresence>
          {showResetConfirm && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="rounded-sm border border-destructive/30 bg-destructive/5 p-3"
            >
              <p className="text-sm text-foreground mb-2">
                Khôi phục các mục mặc định đã xóa? Custom items sẽ giữ nguyên.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handleReset}
                  className="text-[13px] bg-terracotta text-white px-3 py-1.5 rounded-sm hover:bg-terracotta-dark"
                >
                  Khôi phục
                </button>
                <button
                  onClick={() => setShowResetConfirm(false)}
                  className="text-[13px] border border-border text-muted-foreground px-3 py-1.5 rounded-sm hover:bg-muted"
                >
                  Huỷ
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Suggestions based on itinerary */}
        <AnimatePresence>
          {suggestions.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="rounded-sm border border-sage/30 bg-sage/5 p-3 space-y-2"
            >
              <div className="flex items-center gap-2 mb-1">
                <Cloud className="w-4 h-4 text-sage" />
                <span className="text-[13px] font-semibold text-sage uppercase tracking-wide">
                  Đề xuất theo lịch trình
                </span>
              </div>
              {suggestions.slice(0, 3).map((sug) => (
                <div
                  key={sug.id}
                  className="flex items-center justify-between gap-2 bg-card rounded-sm p-2 border border-border"
                >
                  <span className="text-[13px] text-foreground flex-1">{sug.label}</span>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => dispatch({ type: "ACCEPT_SUGGESTION", item: sug })}
                      className="text-[11px] bg-sage text-white px-2 py-1 rounded-sm hover:bg-sage-dark transition-colors"
                    >
                      + Thêm
                    </button>
                    <button
                      onClick={() => dispatch({ type: "DISMISS_SUGGESTION", id: sug.id })}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Checklist by category */}
        {Object.entries(grouped).map(([category, items]) => (
          <div key={category}>
            <p className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              {category}
            </p>
            <div className="space-y-1.5">
              <AnimatePresence>
                {items.map((item) => {
                  const isChecked = state.checked.includes(item.id);
                  return (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 1 }}
                      exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                      transition={{ duration: 0.15 }}
                      className="group flex items-center gap-3 p-2.5 rounded-sm border bg-card hover:bg-muted/40 transition-all text-left shadow-sm"
                    >
                      <button
                        onClick={() => dispatch({ type: "TOGGLE", id: item.id })}
                        className={`w-5 h-5 rounded-sm border-2 flex items-center justify-center shrink-0 transition-colors ${
                          isChecked
                            ? "bg-terracotta border-terracotta"
                            : "border-clay/40"
                        }`}
                      >
                        {isChecked && (
                          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </button>
                      <span
                        className={`text-sm flex-1 ${
                          isChecked ? "line-through text-muted-foreground" : "text-foreground"
                        }`}
                        onClick={() => dispatch({ type: "TOGGLE", id: item.id })}
                      >
                        {item.label}
                        {item.isCustom && (
                          <span className="ml-1.5 text-[11px] text-terracotta/70 font-normal">tuỳ chỉnh</span>
                        )}
                      </span>
                      <button
                        onClick={() =>
                          item.isCustom
                            ? dispatch({ type: "REMOVE_CUSTOM", id: item.id })
                            : dispatch({ type: "REMOVE_DEFAULT", id: item.id })
                        }
                        className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all shrink-0"
                        title="Xoá khỏi danh sách"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
              <AddItemInput
                onAdd={(label) =>
                  dispatch({
                    type: "ADD_CUSTOM",
                    item: { id: nanoid(), label, category, isCustom: true },
                  })
                }
              />
            </div>
          </div>
        ))}

        {/* Cultural notes */}
        <div className="rounded-sm border border-sand bg-sand/50 dark:bg-secondary dark:border-border p-4">
          <div className="flex items-center gap-2 mb-2">
            <Lightbulb className="w-4 h-4 text-terracotta" />
            <span className="text-[12px] font-semibold uppercase tracking-wider text-terracotta">
              Lưu ý văn hoá
            </span>
          </div>
          <ul className="space-y-1.5">
            {CULTURAL_NOTES.map((note, idx) => (
              <li key={idx} className="text-[13px] text-foreground">
                {note}
              </li>
            ))}
          </ul>
        </div>

        <div className="pb-4" />
      </div>
    </ScrollArea>
  );
}
