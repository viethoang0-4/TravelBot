"use client";

import { useEffect } from "react";
import dynamic from "next/dynamic";
import { useTravelStore, useActiveItinerary } from "@/store/travel-store";
import { MapPin } from "lucide-react";

// Goong JS (WebGL) đụng `window` → chỉ tải phía client (ssr:false phải nằm trong Client Component)
const GoongMap = dynamic(() => import("@/components/map/GoongMap"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
      Đang tải bản đồ…
    </div>
  ),
});

function scrollTimelineTo(activityId: string) {
  const el = document.querySelector(`[data-activity-id="${activityId}"]`);
  if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
}

export default function MapView() {
  const itinerary = useActiveItinerary();
  const selectedActivityId = useTravelStore((s) => s.selectedActivityId);

  // Chọn marker trên bản đồ → cuộn timeline tới activity tương ứng
  useEffect(() => {
    if (selectedActivityId) scrollTimelineTo(selectedActivityId);
  }, [selectedActivityId]);

  if (!itinerary) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 p-8 text-center">
        <div className="w-16 h-16 rounded-sm bg-muted flex items-center justify-center">
          <MapPin className="w-8 h-8 text-muted-foreground" />
        </div>
        <p className="text-sm text-muted-foreground">Tạo lịch trình để xem bản đồ</p>
      </div>
    );
  }

  return (
    <div className="h-full">
      <GoongMap />
    </div>
  );
}
