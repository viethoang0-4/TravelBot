"use client";

import { useTravelStore, useActiveItinerary } from "@/store/travel-store";
import { MapPin, Navigation, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Activity } from "@/types/travel";
import { useEffect } from "react";
import { cn } from "@/lib/utils";

function getAllActivities(itinerary: NonNullable<ReturnType<typeof useActiveItinerary>>): Activity[] {
  return itinerary.days.flatMap((d) => d.activities);
}

const TYPE_COLORS: Record<string, string> = {
  transport: "#5B8AA5",
  accommodation: "#A87BA0",
  food: "#D97757",
  activity: "#C9A961",
  shopping: "#C77E8A",
  rest: "#87A878",
};

function scrollTimelineTo(activityId: string) {
  const el = document.querySelector(`[data-activity-id="${activityId}"]`);
  if (el) {
    el.scrollIntoView({ behavior: "smooth", block: "center" });
  }
}

export default function MapView() {
  const itinerary = useActiveItinerary();
  const selectedActivityId = useTravelStore((s) => s.selectedActivityId);
  const hoveredActivityId = useTravelStore((s) => s.hoveredActivityId);
  const setSelectedActivity = useTravelStore((s) => s.setSelectedActivity);
  const setHoveredActivity = useTravelStore((s) => s.setHoveredActivity);

  useEffect(() => {
    if (selectedActivityId) {
      scrollTimelineTo(selectedActivityId);
    }
  }, [selectedActivityId]);

  if (!itinerary) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 p-8 text-center">
        <div className="w-16 h-16 rounded-sm bg-muted flex items-center justify-center">
          <MapPin className="w-8 h-8 text-muted-foreground" />
        </div>
        <p className="text-sm text-muted-foreground">
          Tạo lịch trình để xem bản đồ
        </p>
      </div>
    );
  }

  const activities = getAllActivities(itinerary);
  const selectedActivity = activities.find((a) => a.id === selectedActivityId);

  const destQuery = encodeURIComponent(itinerary.destination);
  const embedUrl = `https://www.google.com/maps/embed/v1/place?key=${
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY || ""
  }&q=${destQuery}&zoom=12`;

  const hasGoogleMapsKey = !!process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;

  return (
    <div className="h-full flex flex-col">
      {hasGoogleMapsKey ? (
        <div className="flex-1 relative">
          <iframe
            src={embedUrl}
            width="100%"
            height="100%"
            style={{ border: 0 }}
            allowFullScreen
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
          {selectedActivity && (
            <div className="absolute bottom-4 left-4 right-4 bg-card border border-border rounded-lg p-3 shadow-md">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-sm text-foreground">{selectedActivity.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {selectedActivity.location.name}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
                  onClick={() => setSelectedActivity(null)}
                >
                  ×
                </Button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 overflow-auto p-4 space-y-3">
          <div className="border border-sand bg-sand/30 dark:bg-secondary dark:border-border rounded-sm p-3 text-xs text-foreground flex items-start gap-2">
            <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5 text-terracotta" />
            <span>
              Thêm <code className="bg-muted px-1 rounded">NEXT_PUBLIC_GOOGLE_MAPS_KEY</code> vào{" "}
              <code className="bg-muted px-1 rounded">.env.local</code> để hiển thị bản đồ tích hợp.
            </span>
          </div>

          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mt-2">
            Tất cả địa điểm
          </p>

          {itinerary.days.map((day) => (
            <div key={day.day} className="space-y-1.5">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground/60">
                Ngày {day.day} · {day.theme}
              </p>
              {day.activities.map((act) => {
                const isSelected = selectedActivityId === act.id;
                const isHovered = hoveredActivityId === act.id;
                return (
                  <div
                    key={act.id}
                    onClick={() => setSelectedActivity(isSelected ? null : act.id)}
                    onMouseEnter={() => setHoveredActivity(act.id)}
                    onMouseLeave={() => setHoveredActivity(null)}
                    className={cn(
                      "flex items-start gap-2.5 p-2.5 rounded-sm border cursor-pointer transition-all duration-150",
                      isSelected
                        ? "border-terracotta bg-terracotta/5 shadow-sm"
                        : isHovered
                        ? "border-terracotta/40 bg-terracotta/5 scale-[1.01]"
                        : "border-transparent hover:border-border hover:bg-muted/50"
                    )}
                  >
                    {/* Pulsing marker */}
                    <div className="relative shrink-0 mt-1.5">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: TYPE_COLORS[act.type] ?? "#8B7B6B" }}
                      />
                      {(isSelected || isHovered) && (
                        <div
                          className="absolute inset-0 rounded-full animate-ping opacity-60"
                          style={{ backgroundColor: TYPE_COLORS[act.type] ?? "#8B7B6B" }}
                        />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold truncate text-foreground">{act.title}</p>
                        {act.is_hidden_gem && (
                          <Badge className="text-[10px] px-1.5 py-0 h-4 bg-acc-food/10 text-acc-food border-acc-food/20 shrink-0 rounded-sm">
                            Ẩn
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {act.location.address || act.location.name}
                      </p>
                    </div>
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${act.location.lat},${act.location.lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-muted-foreground hover:text-terracotta shrink-0 mt-0.5"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                );
              })}
            </div>
          ))}

          <div className="pt-2">
            <a
              href={`https://www.google.com/maps/search/${destQuery}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-terracotta hover:underline font-semibold"
            >
              <Navigation className="w-4 h-4" />
              Mở {itinerary.destination} trên Google Maps
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
