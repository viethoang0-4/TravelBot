"use client";

/**
 * Overlay hiệu ứng "scan" chạy qua ảnh khi user upload ảnh.
 * Dùng trong ImageUploader hoặc trong chat khi đang xử lý ảnh.
 */
import { motion } from "framer-motion";

interface Props {
  /** Hiển thị overlay hay không */
  active: boolean;
  /** Bo góc theo container */
  rounded?: string;
}

export default function ScanningOverlay({ active, rounded = "rounded-sm" }: Props) {
  if (!active) return null;
  return (
    <div className={`absolute inset-0 overflow-hidden pointer-events-none ${rounded}`}>
      {/* Tint overlay */}
      <div className="absolute inset-0 bg-terracotta/10" />

      {/* Scanning line */}
      <motion.div
        className="absolute left-0 right-0 h-[3px] bg-gradient-to-r from-transparent via-terracotta to-transparent shadow-[0_0_20px_rgba(217,119,87,0.8)]"
        initial={{ top: 0 }}
        animate={{ top: ["0%", "100%", "0%"] }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Corner brackets */}
      <div className="absolute top-1 left-1 w-3 h-3 border-t-2 border-l-2 border-terracotta" />
      <div className="absolute top-1 right-1 w-3 h-3 border-t-2 border-r-2 border-terracotta" />
      <div className="absolute bottom-1 left-1 w-3 h-3 border-b-2 border-l-2 border-terracotta" />
      <div className="absolute bottom-1 right-1 w-3 h-3 border-b-2 border-r-2 border-terracotta" />
    </div>
  );
}
