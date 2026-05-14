"use client";

import { useRef, useState, KeyboardEvent } from "react";
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

      <div className="flex items-end gap-2">
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
          placeholder="Hỏi về du lịch, lập kế hoạch chuyến đi... (Enter để gửi)"
          className={cn(
            "flex-1 min-h-[40px] max-h-36 resize-none text-sm py-2.5 rounded-sm",
            "focus-visible:ring-terracotta"
          )}
          disabled={isStreaming}
          rows={1}
        />

        <Button
          size="icon"
          onClick={handleSend}
          disabled={(!text.trim() && !image) || isStreaming}
          className={cn(
            "h-9 w-9 rounded-sm shrink-0",
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
  );
}
