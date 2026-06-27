"use client";

import { useRef, useState, KeyboardEvent } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, StopCircle } from "lucide-react";
import ImageUploader from "@/components/upload/ImageUploader";
import ScanningOverlay from "@/components/chat/ScanningOverlay";
import QuickActionChips from "@/components/chat/QuickActionChips";
import { useTravelStore } from "@/store/travel-store";
import { cn } from "@/lib/utils";

interface Props {
  onSend: (text: string, image?: string) => void;
}

export default function ChatInput({ onSend }: Props) {
  const [text, setText] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isStreaming = useTravelStore((s) => s.isStreaming);

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed && !image) return;
    if (isStreaming) return;
    onSend(trimmed, image ?? undefined);
    setText("");
    setImage(null);
    textareaRef.current?.focus();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="p-3 border-t bg-background">
      <div className="mb-2">
        <QuickActionChips
          onSelect={(s) => {
            setText(s);
            textareaRef.current?.focus();
          }}
        />
      </div>

      {image && (
        <div className="mb-2 pl-1 relative">
          <ImageUploader
            image={image}
            onImage={setImage}
            onClear={() => setImage(null)}
          />
          <ScanningOverlay active={isStreaming} />
        </div>
      )}

      {/* AI Prompt Box (Joly UI): viền gradient xoay phát sáng khi focus */}
      <div className="relative overflow-hidden rounded-xl bg-border p-[1.5px]">
        <motion.div
          aria-hidden
          className="pointer-events-none absolute -inset-[100%]"
          style={{
            background:
              "conic-gradient(from 0deg, #D97757, #C9A961, #87A878, #5B8AA5, #D97757)",
          }}
          animate={{ rotate: 360, opacity: focused ? 1 : 0 }}
          transition={{
            rotate: { duration: 5, ease: "linear", repeat: Infinity },
            opacity: { duration: 0.35 },
          }}
        />

        <div className="relative flex items-end gap-2 rounded-[10px] bg-background p-1.5">
          <ImageUploader
            image={null}
            onImage={setImage}
            onClear={() => setImage(null)}
          />

          <Textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder="Hỏi về du lịch, lập kế hoạch chuyến đi... (Enter để gửi)"
            className={cn(
              "flex-1 min-h-[40px] max-h-36 resize-none border-0 bg-transparent text-sm py-2.5 shadow-none",
              "focus-visible:border-0 focus-visible:ring-0"
            )}
            disabled={isStreaming}
            rows={1}
          />

          <Button
            size="icon"
            onClick={handleSend}
            disabled={(!text.trim() && !image) || isStreaming}
            className={cn(
              "h-9 w-9 rounded-md shrink-0",
              isStreaming
                ? "bg-destructive hover:bg-red-600"
                : "bg-terracotta hover:bg-terracotta-dark"
            )}
          >
            {isStreaming ? (
              <StopCircle className="w-4 h-4" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
