"use client";

import { useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Itinerary } from "@/types/travel";
import { Button } from "@/components/ui/button";
import {
  CalendarPlus,
  CheckCircle2,
  FileImage,
  FileText,
  Leaf,
  MapPin,
  Share2,
  Sparkles,
  Wallet,
  X,
  XCircle,
} from "lucide-react";
import {
  exportElementAsImage,
  exportElementAsPdf,
  exportItineraryAsICS,
  shareItinerary,
} from "@/lib/export";
import { useTravelStore } from "@/store/travel-store";

interface Props {
  open: boolean;
  itinerary: Itinerary;
  draftId: string;
  onClose: () => void;
}

function formatVND(amount: number): string {
  if (amount >= 1000000) return `${(amount / 1000000).toFixed(1)} triệu VND`;
  return `${(amount / 1000).toFixed(0)}k VND`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default function SummaryDashboard({ open, itinerary, draftId, onClose }: Props) {
  const dashboardRef = useRef<HTMLDivElement>(null);
  const confirmDraft = useTravelStore((s) => s.confirmDraft);
  const unconfirmDraft = useTravelStore((s) => s.unconfirmDraft);
  const isConfirmed = useTravelStore(
    (s) => s.drafts.find((d) => d.draft_id === draftId)?.status === "confirmed"
  );

  const allActivities = itinerary.days.flatMap((d) => d.activities);
  const highlights = [...allActivities]
    .sort((a, b) => (b.cost_estimate || 0) - (a.cost_estimate || 0))
    .slice(0, 3);

  const handleConfirmAndShare = () => {
    confirmDraft(draftId);
  };

  const handleUnconfirm = () => {
    unconfirmDraft(draftId);
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
            <div className="bg-background border border-border rounded-lg shadow-wf w-full max-w-2xl max-h-[90vh] overflow-y-auto pointer-events-auto relative">
              <button
                onClick={onClose}
                className="absolute top-3 right-3 z-10 w-8 h-8 rounded-md bg-card border border-border flex items-center justify-center hover:bg-muted transition-colors"
              >
                <X className="w-4 h-4" />
              </button>

              <div ref={dashboardRef} className="bg-background rounded-t-lg">
                {/* Glass header (same pattern as ItineraryTimeline) */}
                <div className="relative overflow-hidden rounded-t-lg">
                  <div className="absolute inset-0 bg-gradient-to-br from-terracotta/80 to-terracotta-dark/90" />
                  <div className="relative p-6">
                    <div className="flex items-center gap-2 mb-1 text-white/80 text-xs font-semibold uppercase tracking-wider">
                      <Sparkles className="w-3.5 h-3.5" />
                      Tóm tắt chuyến đi
                    </div>
                    <h2 className="text-2xl font-bold text-white">{itinerary.title}</h2>
                    <div className="flex items-center gap-1.5 text-white/80 text-sm mt-1">
                      <MapPin className="w-3.5 h-3.5" />
                      <span>{itinerary.destination}</span>
                    </div>
                    <p className="text-white/70 text-xs mt-1">
                      {formatDate(itinerary.start_date)} → {formatDate(itinerary.end_date)}
                    </p>
                  </div>
                </div>

                <div className="p-6 space-y-5">
                  {/* Stats grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <StatBox icon={<Wallet className="w-4 h-4" />} label="Tổng chi phí" value={formatVND(itinerary.budget.total_estimated)} color="terracotta" />
                    <StatBox icon={<CalendarPlus className="w-4 h-4" />} label="Số ngày" value={`${itinerary.days.length} ngày`} color="sage" />
                    <StatBox icon={<CheckCircle2 className="w-4 h-4" />} label="Hoạt động" value={`${allActivities.length}`} color="transport" />
                    <StatBox icon={<Sparkles className="w-4 h-4" />} label="Điểm ẩn" value={`${itinerary.hidden_gems.length}`} color="fun" />
                  </div>

                  {/* Budget breakdown bars */}
                  <div className="rounded-sm border border-border bg-card p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                      Phân bổ ngân sách
                    </p>
                    <div className="space-y-2">
                      {Object.entries(itinerary.budget.breakdown).map(([key, value]) => {
                        const total = itinerary.budget.total_estimated || 1;
                        const pct = Math.round((value / total) * 100);
                        const labels: Record<string, string> = {
                          accommodation: "🏨 Lưu trú",
                          transport: "🚗 Di chuyển",
                          food: "🍜 Ăn uống",
                          activities: "🎢 Hoạt động",
                          misc: "📦 Khác",
                        };
                        return (
                          <div key={key}>
                            <div className="flex justify-between text-xs mb-0.5 text-foreground">
                              <span>{labels[key] || key}</span>
                              <span className="text-muted-foreground">
                                {formatVND(value)} ({pct}%)
                              </span>
                            </div>
                            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${pct}%` }}
                                transition={{ duration: 0.6, ease: "easeOut" }}
                                className="h-full bg-terracotta rounded-full"
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Dấu chân carbon — quãng đường THẬT (Goong) + chặng liên tỉnh; hệ số DEFRA 2023 */}
                  {itinerary.carbon && (
                    <div className="rounded-sm border border-sage/30 bg-sage/5 p-4">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-sage flex items-center gap-1.5">
                          <Leaf className="w-3.5 h-3.5" />
                          Dấu chân carbon
                        </p>
                        <span className="text-lg font-bold text-sage">
                          ~{itinerary.carbon.total_kg} kg CO₂
                        </span>
                      </div>

                      {itinerary.carbon.modes && (
                        <div className="space-y-1.5 text-xs">
                          <p className="text-muted-foreground">
                            Di chuyển nội vùng (quãng đường thật):{" "}
                            {itinerary.carbon.local_km} km
                          </p>
                          <div className="grid grid-cols-2 gap-2">
                            <div className="rounded-sm bg-card border border-border p-2 flex items-center justify-between">
                              <span>🚗 Ô tô</span>
                              <span className="font-semibold">
                                {itinerary.carbon.modes.car.local_kg} kg
                              </span>
                            </div>
                            <div className="rounded-sm bg-card border border-border p-2 flex items-center justify-between">
                              <span>🏍️ Xe máy</span>
                              <span className="font-semibold">
                                {itinerary.carbon.modes.motorbike.local_kg} kg
                              </span>
                            </div>
                          </div>
                        </div>
                      )}

                      {itinerary.carbon.intercity && (
                        <div className="mt-2 flex items-center justify-between rounded-sm bg-card border border-border p-2 text-xs">
                          <span>
                            {itinerary.carbon.intercity.mode === "flight" ? "✈️" : "🚌"}{" "}
                            Liên tỉnh ({itinerary.carbon.intercity.label}, khứ hồi{" "}
                            {itinerary.carbon.intercity.distance_km} km ·{" "}
                            {itinerary.carbon.intercity.passengers} người)
                          </span>
                          <span className="font-semibold shrink-0 ml-2">
                            {itinerary.carbon.intercity.kg} kg
                          </span>
                        </div>
                      )}

                      {itinerary.carbon.by_day && itinerary.carbon.by_day.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {itinerary.carbon.by_day.map((d) => (
                            <span
                              key={d.day}
                              className="text-[10px] px-1.5 py-0.5 rounded-sm bg-card border border-border text-muted-foreground"
                            >
                              Ngày {d.day}: {d.km} km · {d.kg} kg
                            </span>
                          ))}
                        </div>
                      )}

                      {itinerary.carbon.source && (
                        <p className="mt-2 text-[10px] italic text-muted-foreground/70">
                          Hệ số phát thải: {itinerary.carbon.source}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Highlights */}
                  {highlights.length > 0 && (
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                        ✨ Điểm nhấn của chuyến đi
                      </p>
                      <div className="space-y-2">
                        {highlights.map((act, idx) => (
                          <div key={act.id} className="flex items-start gap-3 p-3 rounded-sm border border-border bg-card">
                            <div className="w-7 h-7 rounded-md bg-terracotta text-white flex items-center justify-center font-bold text-xs shrink-0">
                              {idx + 1}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm text-foreground">{act.title}</p>
                              <p className="text-xs text-muted-foreground line-clamp-1">
                                {act.location.name}
                              </p>
                            </div>
                            <span className="text-xs text-terracotta font-semibold shrink-0">
                              {formatVND(act.cost_estimate)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Action buttons */}
              <div className="border-t border-border p-4 bg-muted/30 rounded-b-lg space-y-2">
                {isConfirmed ? (
                  <div className="flex items-center gap-2">
                    <div className="flex-1 flex items-center justify-center gap-2 h-9 rounded-md bg-sage/10 text-sage text-sm font-semibold border border-sage/30">
                      <CheckCircle2 className="w-4 h-4" />
                      Đã chốt
                    </div>
                    <Button
                      onClick={handleUnconfirm}
                      variant="outline"
                      className="border-border hover:border-destructive hover:text-destructive"
                    >
                      <XCircle className="w-4 h-4 mr-1.5" />
                      Hủy chốt
                    </Button>
                  </div>
                ) : (
                  <Button
                    onClick={handleConfirmAndShare}
                    className="w-full bg-terracotta hover:bg-terracotta-dark text-white"
                  >
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Chốt hành trình này
                  </Button>
                )}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <Button variant="outline" size="sm" onClick={() => exportItineraryAsICS(itinerary)} className="border-border hover:border-terracotta hover:text-terracotta">
                    <CalendarPlus className="w-3.5 h-3.5 mr-1" />
                    Lịch
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => shareItinerary(itinerary)} className="border-border hover:border-terracotta hover:text-terracotta">
                    <Share2 className="w-3.5 h-3.5 mr-1" />
                    Chia sẻ
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => exportElementAsPdf(dashboardRef.current, itinerary.title)} className="border-border hover:border-terracotta hover:text-terracotta">
                    <FileText className="w-3.5 h-3.5 mr-1" />
                    PDF
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => exportElementAsImage(dashboardRef.current, itinerary.title)} className="border-border hover:border-terracotta hover:text-terracotta">
                    <FileImage className="w-3.5 h-3.5 mr-1" />
                    Ảnh
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function StatBox({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: "terracotta" | "sage" | "transport" | "fun";
}) {
  const colors = {
    terracotta: "bg-terracotta/5 text-terracotta border-terracotta/20",
    sage: "bg-sage/5 text-sage border-sage/20",
    transport: "bg-acc-transport/5 text-acc-transport border-acc-transport/20",
    fun: "bg-acc-fun/5 text-acc-fun border-acc-fun/20",
  };
  return (
    <div className={`rounded-sm border p-3 ${colors[color]}`}>
      <div className="flex items-center gap-1.5 text-xs font-medium opacity-80">
        {icon}
        {label}
      </div>
      <div className="font-bold text-sm mt-1">{value}</div>
    </div>
  );
}
