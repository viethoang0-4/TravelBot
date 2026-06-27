"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export interface TabItem {
  id: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
}

interface VercelTabsProps {
  tabs: TabItem[];
  activeId: string;
  onChange: (id: string) => void;
  className?: string;
}

/**
 * Tab bar kiểu Vercel (Joly UI): pill nền trượt theo con trỏ hover +
 * thanh gạch chân trượt mượt dưới tab đang active (dùng framer-motion layoutId).
 */
export function VercelTabs({ tabs, activeId, onChange, className }: VercelTabsProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  return (
    <div
      className={cn("relative flex items-center gap-1 p-1", className)}
      onMouseLeave={() => setHoveredId(null)}
    >
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeId === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            onMouseEnter={() => setHoveredId(tab.id)}
            className={cn(
              "relative z-10 flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-2.5 text-[11px] font-bold uppercase tracking-wider transition-colors duration-200",
              isActive
                ? "text-terracotta"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {hoveredId === tab.id && !isActive && (
              <motion.span
                layoutId="tab-hover-pill"
                className="absolute inset-0 -z-10 rounded-md bg-muted"
                transition={{ type: "spring", stiffness: 400, damping: 34 }}
              />
            )}
            {Icon && <Icon className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline">{tab.label}</span>
            {isActive && (
              <motion.span
                layoutId="tab-active-underline"
                className="absolute inset-x-2 -bottom-px h-[2px] rounded-full bg-terracotta"
                transition={{ type: "spring", stiffness: 400, damping: 34 }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
