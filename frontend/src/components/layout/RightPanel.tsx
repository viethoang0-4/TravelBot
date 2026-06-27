"use client";

import { useTravelStore } from "@/store/travel-store";
import { RightPanelTab } from "@/types/travel";
import { Backpack, CalendarDays, MapPin, Wallet } from "lucide-react";
import { VercelTabs, type TabItem } from "@/components/ui/vercel-tabs";
import ItineraryTimeline from "@/components/timeline/ItineraryTimeline";
import MapView from "@/components/map/MapView";
import BudgetChart from "@/components/budget/BudgetChart";
import ChecklistPanel from "@/components/timeline/ChecklistPanel";

const TABS: TabItem[] = [
  { id: "timeline", label: "Lịch trình", icon: CalendarDays },
  { id: "map", label: "Bản đồ", icon: MapPin },
  { id: "budget", label: "Ngân sách", icon: Wallet },
  { id: "checklist", label: "Chuẩn bị", icon: Backpack },
];

export default function RightPanel() {
  const { activeTab, setActiveTab } = useTravelStore();

  return (
    <div className="flex flex-col h-full">
      {/* Tab Bar (Vercel-style animated) */}
      <div className="relative shrink-0 border-b bg-background px-1">
        <VercelTabs
          tabs={TABS}
          activeId={activeTab}
          onChange={(id) => setActiveTab(id as RightPanelTab)}
        />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === "timeline" && <ItineraryTimeline />}
        {activeTab === "map" && <MapView />}
        {activeTab === "budget" && <BudgetChart />}
        {activeTab === "checklist" && <ChecklistPanel />}
      </div>
    </div>
  );
}
