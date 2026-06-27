"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { apiClient } from "@/lib/api-client";
import { cn } from "@/lib/utils";

/** Hồ sơ sở thích tường minh — nạp vào Planner để cá nhân hóa lịch trình (không train model). */
interface Preferences {
  interests: string[];
  pace: "relaxed" | "balanced" | "packed" | null;
  budget_level: "budget" | "moderate" | "luxury" | null;
  food: string;
  avoid: string;
  notes: string;
}

const EMPTY: Preferences = {
  interests: [],
  pace: null,
  budget_level: null,
  food: "",
  avoid: "",
  notes: "",
};

const INTEREST_OPTIONS = [
  "Ẩm thực",
  "Văn hoá - lịch sử",
  "Thiên nhiên",
  "Biển",
  "Núi",
  "Vui chơi giải trí",
  "Mua sắm",
  "Nghỉ dưỡng",
  "Chụp ảnh",
  "Mạo hiểm",
  "Đời sống về đêm",
  "Gia đình - trẻ em",
];

const PACE_OPTIONS: { value: Preferences["pace"]; label: string }[] = [
  { value: "relaxed", label: "Thong thả" },
  { value: "balanced", label: "Cân bằng" },
  { value: "packed", label: "Dày đặc" },
];

const BUDGET_OPTIONS: { value: Preferences["budget_level"]; label: string }[] = [
  { value: "budget", label: "Tiết kiệm" },
  { value: "moderate", label: "Vừa phải" },
  { value: "luxury", label: "Cao cấp" },
];

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function PreferencesDialog({ open, onClose }: Props) {
  const [prefs, setPrefs] = useState<Preferences>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Nạp hồ sơ hiện tại mỗi lần mở
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    apiClient
      .get("/api/v1/users/me/preferences")
      .then((r) => (r.ok ? r.json() : {}))
      .then((data) => {
        if (!cancelled) setPrefs({ ...EMPTY, ...(data || {}) });
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const toggleInterest = (it: string) =>
    setPrefs((p) => ({
      ...p,
      interests: p.interests.includes(it)
        ? p.interests.filter((x) => x !== it)
        : [...p.interests, it],
    }));

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiClient.put("/api/v1/users/me/preferences", prefs);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
          >
            <div className="bg-background border border-border rounded-lg shadow-wf w-full max-w-lg max-h-[90vh] overflow-y-auto pointer-events-auto relative">
              <button
                onClick={onClose}
                className="absolute top-3 right-3 z-10 w-8 h-8 rounded-md bg-card border border-border flex items-center justify-center hover:bg-muted transition-colors"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="p-5 space-y-5">
                {/* Header */}
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-md bg-terracotta/10 flex items-center justify-center">
                    <Heart className="w-5 h-5 text-terracotta" />
                  </div>
                  <div>
                    <h2 className="font-bold text-base text-foreground">Sở thích du lịch</h2>
                    <p className="text-xs text-muted-foreground">
                      Compasso dùng để cá nhân hóa mọi lịch trình của bạn
                    </p>
                  </div>
                </div>

                {loading ? (
                  <div className="flex items-center justify-center py-10 text-muted-foreground">
                    <Loader2 className="w-5 h-5 animate-spin" />
                  </div>
                ) : (
                  <>
                    {/* Sở thích (chips) */}
                    <div className="space-y-2">
                      <p className="text-sm font-semibold text-foreground">Bạn thích gì?</p>
                      <div className="flex flex-wrap gap-1.5">
                        {INTEREST_OPTIONS.map((it) => {
                          const active = prefs.interests.includes(it);
                          return (
                            <button
                              key={it}
                              type="button"
                              onClick={() => toggleInterest(it)}
                              className={cn(
                                "px-2.5 py-1 rounded-full text-xs border transition-colors",
                                active
                                  ? "bg-terracotta text-white border-terracotta"
                                  : "bg-muted/40 text-muted-foreground border-border hover:border-terracotta/50"
                              )}
                            >
                              {it}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Nhịp đi */}
                    <Segmented
                      label="Nhịp độ chuyến đi"
                      options={PACE_OPTIONS}
                      value={prefs.pace}
                      onChange={(v) => setPrefs((p) => ({ ...p, pace: v }))}
                    />

                    {/* Mức chi tiêu */}
                    <Segmented
                      label="Mức chi tiêu ưa thích"
                      options={BUDGET_OPTIONS}
                      value={prefs.budget_level}
                      onChange={(v) => setPrefs((p) => ({ ...p, budget_level: v }))}
                    />

                    {/* Ẩm thực */}
                    <div className="space-y-1.5">
                      <p className="text-sm font-semibold text-foreground">Ẩm thực ưa thích</p>
                      <input
                        type="text"
                        value={prefs.food}
                        onChange={(e) => setPrefs((p) => ({ ...p, food: e.target.value }))}
                        placeholder="vd: hải sản, đồ chay, đặc sản địa phương, không cay…"
                        className="w-full h-9 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring placeholder:text-muted-foreground"
                      />
                    </div>

                    {/* Cần tránh */}
                    <div className="space-y-1.5">
                      <p className="text-sm font-semibold text-foreground">Cần tránh</p>
                      <input
                        type="text"
                        value={prefs.avoid}
                        onChange={(e) => setPrefs((p) => ({ ...p, avoid: e.target.value }))}
                        placeholder="vd: leo núi, nơi quá đông, đi bộ nhiều…"
                        className="w-full h-9 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring placeholder:text-muted-foreground"
                      />
                    </div>

                    {/* Ghi chú */}
                    <div className="space-y-1.5">
                      <p className="text-sm font-semibold text-foreground">Ghi chú thêm</p>
                      <Textarea
                        value={prefs.notes}
                        onChange={(e) => setPrefs((p) => ({ ...p, notes: e.target.value }))}
                        placeholder="Bất cứ điều gì bạn muốn Compasso lưu ý…"
                        className="text-sm"
                      />
                    </div>

                    {/* Actions */}
                    <div className="flex justify-end gap-2 pt-1">
                      <Button variant="outline" size="lg" onClick={onClose} disabled={saving}>
                        Hủy
                      </Button>
                      <Button
                        size="lg"
                        onClick={handleSave}
                        disabled={saving}
                        className="bg-terracotta hover:bg-terracotta-dark text-white"
                      >
                        {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                        Lưu sở thích
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function Segmented<T extends string | null>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-sm font-semibold text-foreground">{label}</p>
      <div className="flex gap-1.5">
        {options.map((o) => {
          const active = value === o.value;
          return (
            <button
              key={String(o.value)}
              type="button"
              onClick={() => onChange(active ? (null as T) : o.value)}
              className={cn(
                "flex-1 h-9 rounded-lg text-sm border transition-colors",
                active
                  ? "bg-terracotta text-white border-terracotta"
                  : "bg-muted/40 text-muted-foreground border-border hover:border-terracotta/50"
              )}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
