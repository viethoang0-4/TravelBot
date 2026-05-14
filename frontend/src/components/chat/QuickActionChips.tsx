"use client";

/**
 * Chips động — hiển thị các action gợi ý dựa trên ngữ cảnh hiện tại.
 * Khi chưa có itinerary → câu hỏi mở.
 * Khi có itinerary → action chỉnh sửa.
 */
import { motion, AnimatePresence } from "framer-motion";
import { useActiveItinerary } from "@/store/travel-store";
import { getQuickActions } from "@/lib/quick-actions";

interface Props {
  onSelect: (prompt: string) => void;
}

export default function QuickActionChips({ onSelect }: Props) {
  const itinerary = useActiveItinerary();
  const actions = getQuickActions(itinerary);

  return (
    <div className="flex flex-wrap gap-1.5">
      <AnimatePresence mode="popLayout">
        {actions.map((action) => (
          <motion.button
            key={action.label}
            layout
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.2 }}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            onClick={() => onSelect(action.prompt)}
            className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-sm border border-terracotta/20 text-terracotta bg-terracotta/5 hover:bg-terracotta/10 hover:border-terracotta/40 transition-all"
          >
            <span>{action.icon}</span>
            <span className="font-medium">{action.label}</span>
          </motion.button>
        ))}
      </AnimatePresence>
    </div>
  );
}
