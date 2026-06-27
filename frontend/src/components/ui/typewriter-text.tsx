"use client";

import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";

interface TypewriterTextProps {
  /** Một chuỗi (gõ 1 lần) hoặc mảng chuỗi (gõ → xoá → vòng lặp) */
  text: string | string[];
  className?: string;
  /** ms cho mỗi ký tự khi gõ */
  typingSpeed?: number;
  /** ms cho mỗi ký tự khi xoá */
  deletingSpeed?: number;
  /** ms dừng lại sau khi gõ xong một câu (chỉ áp dụng khi có nhiều câu) */
  pauseDuration?: number;
  showCursor?: boolean;
  cursorClassName?: string;
}

/**
 * Hiệu ứng gõ chữ (Joly UI "Typewriter").
 * - 1 chuỗi: gõ một lần rồi giữ nguyên (con trỏ vẫn nhấp nháy).
 * - Mảng chuỗi: gõ → dừng → xoá → câu kế tiếp, lặp vô hạn.
 */
export function TypewriterText({
  text,
  className,
  typingSpeed = 45,
  deletingSpeed = 25,
  pauseDuration = 1600,
  showCursor = true,
  cursorClassName,
}: TypewriterTextProps) {
  const phrases = useMemo(() => (Array.isArray(text) ? text : [text]), [text]);
  const [index, setIndex] = useState(0);
  const [display, setDisplay] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const current = phrases[index % phrases.length];

    // Gõ xong & chỉ có 1 câu → dừng hẳn, không xoá
    if (!deleting && display === current && phrases.length === 1) return;

    let timer: ReturnType<typeof setTimeout>;

    if (!deleting && display === current) {
      timer = setTimeout(() => setDeleting(true), pauseDuration);
    } else if (deleting && display === "") {
      // Chuyển sang câu kế tiếp (đặt trong timeout để không setState đồng bộ trong effect)
      timer = setTimeout(() => {
        setDeleting(false);
        setIndex((i) => (i + 1) % phrases.length);
      }, 400);
    } else {
      const next = deleting
        ? current.slice(0, display.length - 1)
        : current.slice(0, display.length + 1);
      timer = setTimeout(() => setDisplay(next), deleting ? deletingSpeed : typingSpeed);
    }

    return () => clearTimeout(timer);
  }, [display, deleting, index, phrases, typingSpeed, deletingSpeed, pauseDuration]);

  return (
    <span className={className}>
      {display}
      {showCursor && (
        <span
          aria-hidden
          className={cn(
            "ml-0.5 inline-block h-[1em] w-[2px] -translate-y-[1px] animate-pulse bg-current align-middle",
            cursorClassName
          )}
        />
      )}
    </span>
  );
}
