"use client";

import { useState } from "react";
import {
  useTravelStore,
  useActiveItinerary,
  useActiveDraft,
} from "@/store/travel-store";
import ActivityCard from "./ActivityCard";
import SkeletonItinerary from "./SkeletonItinerary";
import SummaryDashboard from "./SummaryDashboard";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import {
  CalendarDays,
  MapPin,
  Wallet,
  Compass,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import { mockItinerary } from "@/lib/mock-data";
import { isActivityLocked } from "@/lib/activity-lock";
import { useResolvedImage } from "@/lib/use-pexels-image";
import { Activity, DayPlan } from "@/types/travel";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { motion } from "framer-motion";

function formatVND(amount: number): string {
  if (amount >= 1000000) return `${(amount / 1000000).toFixed(1)} triệu VND`;
  return `${(amount / 1000).toFixed(0)}k VND`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default function ItineraryTimeline() {
  const isPlanning = useTravelStore((s) => s.isPlanning);
  const itinerary = useActiveItinerary();
  const draft = useActiveDraft();
  const addDraft = useTravelStore((s) => s.addDraft);
  const updateDraftItinerary = useTravelStore((s) => s.updateDraftItinerary);

  const [summaryOpen, setSummaryOpen] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  // Ảnh hero theo điểm đến (có xác thực; không khớp → ảnh phong cảnh vùng → null)
  const heroSrc = useResolvedImage(
    itinerary?.destination ?? null,
    itinerary?.destination ?? "",
    "activity",
    itinerary?.destination ?? "hero"
  );

  if (isPlanning && !itinerary) {
    return <SkeletonItinerary />;
  }

  if (!itinerary || !draft) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 p-8 text-center">
        <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center">
          <CalendarDays className="w-8 h-8 text-muted-foreground" />
        </div>
        <div>
          <p className="font-medium text-foreground">Chưa có lịch trình</p>
          <p className="text-sm text-muted-foreground mt-1">
            Hỏi TravelBot để tạo lịch trình du lịch của bạn
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => addDraft(mockItinerary)}
          className="text-xs border-border hover:border-terracotta hover:text-terracotta"
        >
          Xem lịch trình mẫu
        </Button>
      </div>
    );
  }

  const totalDays = itinerary.days.length;
  const isConfirmed = draft.status === "confirmed";

  const handleDragEnd = (event: DragEndEvent, dayIdx: number) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const day = itinerary.days[dayIdx];
    const oldIdx = day.activities.findIndex((a) => a.id === active.id);
    const newIdx = day.activities.findIndex((a) => a.id === over.id);
    if (oldIdx === -1 || newIdx === -1) return;

    let newActivities = arrayMove(day.activities, oldIdx, newIdx);

    // Chặn nếu thao tác làm xê dịch bất kỳ ô cố định nào (vd: kéo 1 ô vượt qua
    // ô "xuất phát"/"kết thúc"). Ô cố định phải giữ nguyên vị trí.
    const lockedDisplaced = day.activities.some((act, oldI) => {
      if (!isActivityLocked(act)) return false;
      return newActivities.findIndex((a) => a.id === act.id) !== oldI;
    });
    if (lockedDisplaced) return;

    const originalTimeSlots = day.activities.map((a) => a.time);
    newActivities = newActivities.map((act, index) => ({
      ...act,
      time: originalTimeSlots[index],
    }));

    const newDays: DayPlan[] = itinerary.days.map((d, idx) =>
      idx === dayIdx ? { ...d, activities: newActivities } : d
    );

    updateDraftItinerary(draft.draft_id, { ...itinerary, days: newDays });
  };

  return (
    <div className="relative h-full">
      <ScrollArea className="h-full">
        <div className="p-4 pb-24 space-y-4">

          {/* === Glass card header === */}
          <div className="rounded-lg overflow-hidden shadow-sm border border-border relative">
            {/* Gradient nền (luôn có) + ảnh điểm đến Pexels phủ lên nếu lấy được */}
            <div className="absolute inset-0 bg-gradient-to-br from-terracotta/30 via-terracotta/10 to-sage/20" />
            {heroSrc && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={heroSrc}
                alt={itinerary.destination}
                className="absolute inset-0 w-full h-full object-cover blur-[2px] brightness-90 scale-105"
                loading="lazy"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            )}
            {/* Glass overlay */}
            <div className="relative bg-card/80 dark:bg-card/85 backdrop-blur-md p-4">
              <div className="flex items-start justify-between gap-2">
                <h2 className="font-bold text-base leading-tight text-foreground">
                  {itinerary.title}
                </h2>
                {isConfirmed && (
                  <Badge className="bg-sage/15 text-sage border-sage/30 text-[10px] rounded-sm shrink-0">
                    <CheckCircle2 className="w-2.5 h-2.5 mr-0.5" />
                    Đã chốt
                  </Badge>
                )}
              </div>

              <div className="flex items-center gap-1.5 mt-1.5 text-muted-foreground text-xs">
                <MapPin className="w-3.5 h-3.5 text-terracotta shrink-0" />
                <span>{itinerary.destination}</span>
              </div>

              {/* Badges row — flex-wrap to prevent overflow */}
              <div className="flex flex-wrap items-center gap-2 mt-3">
                <Badge className="bg-terracotta/10 text-terracotta border-terracotta/20 text-xs rounded-sm">
                  {totalDays} ngày
                </Badge>
                <div className="flex items-center gap-1 text-muted-foreground text-xs">
                  <CalendarDays className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    {formatDate(itinerary.start_date)} →{" "}
                    {formatDate(itinerary.end_date)}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1.5 mt-2 text-sm font-semibold text-foreground">
                <Wallet className="w-4 h-4 text-terracotta" />
                <span>~{formatVND(itinerary.budget.total_estimated)}</span>
              </div>

              {itinerary.summary && (
                <p className="text-muted-foreground text-xs mt-2 leading-relaxed">
                  {itinerary.summary}
                </p>
              )}
            </div>
          </div>

          {/* Days with drag-drop per day */}
          {itinerary.days.map((day, dayIdx) => (
            <div key={day.day} className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-7 h-7 rounded-md bg-terracotta text-white text-xs font-bold shrink-0">
                  {day.day}
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-sm text-foreground">{day.theme}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(day.date)}
                  </p>
                </div>
              </div>

              <div className="ml-3.5 pl-5 border-l-2 border-dashed border-clay/30 space-y-3">
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={(e) => handleDragEnd(e, dayIdx)}
                >
                  <SortableContext
                    items={day.activities.map((a: Activity) => a.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {day.activities.map((activity) => (
                      <ActivityCard
                        key={activity.id}
                        activity={activity}
                        sortable
                        region={itinerary.destination}
                      />
                    ))}
                  </SortableContext>
                </DndContext>
              </div>
            </div>
          ))}

          {/* Hidden gems */}
          {itinerary.hidden_gems.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Compass className="w-4 h-4 text-sage" />
                <span className="font-semibold text-sm text-foreground">Điểm Ẩn Đề Xuất</span>
                <Badge className="text-xs bg-sage/10 text-sage border-sage/20 rounded-sm">
                  {itinerary.hidden_gems.length} địa điểm
                </Badge>
              </div>
              <div className="space-y-2">
                {itinerary.hidden_gems.map((gem) => (
                  <div
                    key={gem.id}
                    className="rounded-sm border border-sage/20 bg-sage/5 p-3"
                  >
                    <div className="flex items-start justify-between">
                      <p className="font-semibold text-sm text-foreground">{gem.name}</p>
                      <Badge
                        variant="outline"
                        className="text-[10px] px-1.5 shrink-0 ml-2 text-sage border-sage/30 rounded-sm"
                      >
                        {Math.round(gem.confidence_score * 100)}%
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {gem.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Floating Confirm button */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="absolute bottom-4 right-4 z-10"
      >
        <Button
          onClick={() => setSummaryOpen(true)}
          className="shadow-wf bg-terracotta hover:bg-terracotta-dark text-white border-0 h-11 px-5 rounded-md"
        >
          <Sparkles className="w-4 h-4 mr-2" />
          {isConfirmed ? "Xem tóm tắt" : "Chốt hành trình này"}
        </Button>
      </motion.div>

      <SummaryDashboard
        open={summaryOpen}
        itinerary={itinerary}
        draftId={draft.draft_id}
        onClose={() => setSummaryOpen(false)}
      />
    </div>
  );
}
