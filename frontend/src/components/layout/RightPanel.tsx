"use client";

import { useTravelStore } from "@/store/travel-store";
import { RightPanelTab } from "@/types/travel";
import { Backpack, CalendarDays, MapPin, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import ItineraryTimeline from "@/components/timeline/ItineraryTimeline";
import MapView from "@/components/map/MapView";
import BudgetChart from "@/components/budget/BudgetChart";
import ChecklistPanel from "@/components/timeline/ChecklistPanel";

const TABS: { id: RightPanelTab; label: string; icon: typeof CalendarDays }[] =
  [
    { id: "timeline", label: "Lịch trình", icon: CalendarDays },
    { id: "map", label: "Bản đồ", icon: MapPin },
    { id: "budget", label: "Ngân sách", icon: Wallet },
    { id: "checklist", label: "Chuẩn bị", icon: Backpack },
  ];

export default function RightPanel() {
  const { activeTab, setActiveTab } = useTravelStore();

  return (
    <div className="flex flex-col h-full">
      {/* Tab Bar */}
      <div className="flex border-b shrink-0 bg-background">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-1.5 px-4 py-3 text-[11px] font-bold border-b-2 transition-all flex-1 justify-center label-uppercase tracking-wider",
                  isActive
                    ? "border-terracotta text-terracotta bg-terracotta/5"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            );
        })}
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
