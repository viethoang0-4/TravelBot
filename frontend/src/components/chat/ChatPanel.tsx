"use client";

import { useEffect, useRef } from "react";
import { useTravelStore } from "@/store/travel-store";
import ChatMessage from "./ChatMessage";
import ChatInput from "./ChatInput";
import StreamingMessage from "./StreamingMessage";
import ClarifyCard from "./ClarifyCard";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TypewriterText } from "@/components/ui/typewriter-text";
import { Compass } from "lucide-react";
import {
  ChatMessage as ChatMessageType,
  ClarifyPayload,
  Itinerary,
  StreamEvent,
} from "@/types/travel";
import { nanoid } from "@/lib/utils";
import { getSession } from "next-auth/react";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

/** Heuristic: phát hiện ý định lập kế hoạch để bật skeleton */
function detectPlanIntent(text: string): boolean {
  const t = text.toLowerCase();
  return /lập kế hoạch|lịch trình|du lịch|đi (chơi|du lịch)|kế hoạch|tour|\d+\s*(ngày|đêm|n\d)/.test(
    t
  );
}

export default function ChatPanel() {
  const {
    messages,
    isStreaming,
    streamingText,
    streamingStatus,
    pendingClarify,
    addMessage,
    updateLastAssistantMessage,
    addDraft,
    updateDraftItinerary,
    startPlanning,
    stopPlanning,
    setIsStreaming,
    setStreamingText,
    setStreamingStatus,
    setPendingClarify,
    persistActiveConversation,
  } = useTravelStore();

  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingText]);

  const handleSend = async (text: string, image?: string) => {
    if (isStreaming) {
      abortRef.current?.abort();
      return;
    }

    // Người dùng gửi tin mới → bỏ bộ câu hỏi làm rõ đang chờ (nếu có)
    setPendingClarify(null);

    const userMsg: ChatMessageType = {
      id: nanoid(),
      role: "user",
      content: text || (image ? "Phân tích ảnh này giúp tôi" : ""),
      timestamp: new Date(),
      image,
    };
    addMessage(userMsg);

    const allMessages = [...messages, userMsg].map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const willPlan = detectPlanIntent(userMsg.content);

    setIsStreaming(true);
    setStreamingText("");
    setStreamingStatus("Compasso đang suy nghĩ...");
    if (willPlan) startPlanning();

    const assistantMsg: ChatMessageType = {
      id: nanoid(),
      role: "assistant",
      content: "",
      timestamp: new Date(),
    };
    addMessage(assistantMsg);

    abortRef.current = new AbortController();

    // Lịch trình đang xem (nếu có) → backend có thể SỬA tại chỗ thay vì tạo mới
    const st = useTravelStore.getState();
    const currentItinerary =
      st.drafts.find((d) => d.draft_id === st.activeDraftId)?.itinerary ?? null;

    try {
      // Gọi THẲNG FastAPI (bỏ proxy /api/chat của Vercel → tránh trần thời lượng hàm
      // serverless ~60s cho lần sinh lịch trình dài). JWT lấy từ session NextAuth.
      const session = await getSession();
      const token = session?.backendToken;
      const res = await fetch(`${BACKEND}/api/v1/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          messages: allMessages,
          image,
          current_itinerary: currentItinerary,
        }),
        signal: abortRef.current.signal,
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let fullText = "";
      let itinerary: Itinerary | null = null;
      let clarify: ClarifyPayload | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6)) as StreamEvent;

            if (event.type === "thinking" || event.type === "searching") {
              setStreamingStatus(event.content);
            } else if (event.type === "text") {
              fullText += event.content;
              setStreamingText(fullText);
              setStreamingStatus("");
            } else if (event.type === "itinerary") {
              itinerary = event.content;
            } else if (event.type === "questions") {
              // Agent cần thêm thông tin → hiện thẻ câu hỏi, bỏ skeleton
              clarify = event.content;
              fullText = event.content.intro;
              setStreamingText(fullText);
              setStreamingStatus("");
              if (willPlan) stopPlanning();
            } else if (event.type === "error") {
              fullText = `⚠️ Lỗi từ Gemini: ${event.content}`;
              setStreamingText(fullText);
            } else if (event.type === "done") {
              break;
            }
          } catch {
            // skip malformed event
          }
        }
      }

      const displayText = fullText.replace(/```json\n[\s\S]*?\n```/g, "").trim();
      updateLastAssistantMessage(fullText);

      if (clarify) {
        setPendingClarify(clarify);
      }

      if (itinerary) {
        // Sửa tại chỗ nếu id trùng lịch trình đã có; ngược lại tạo draft mới
        const exists = useTravelStore
          .getState()
          .drafts.some((d) => d.draft_id === itinerary.itinerary_id);
        if (exists) {
          updateDraftItinerary(itinerary.itinerary_id, itinerary);
        } else {
          addDraft(itinerary);
        }
        const updatedMsg: ChatMessageType = {
          id: nanoid(),
          role: "assistant",
          content: displayText || fullText,
          timestamp: new Date(),
          itinerary,
        };
        useTravelStore.setState((s) => {
          const msgs = [...s.messages];
          msgs[msgs.length - 1] = updatedMsg;
          return { messages: msgs };
        });
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        updateLastAssistantMessage("_(Đã dừng)_");
      } else {
        const msg = err instanceof Error ? err.message : String(err);
        updateLastAssistantMessage(`⚠️ Lỗi: ${msg}`);
      }
    } finally {
      setIsStreaming(false);
      setStreamingText("");
      setStreamingStatus("");
      if (willPlan) stopPlanning();
      // Lưu lịch sử trò chuyện của lịch trình đang active lên backend (giữ context qua reload)
      persistActiveConversation();
    }
  };

  const isEmpty = messages.length === 0;

  return (
    <div className="flex flex-col h-full">
      <ScrollArea className="flex-1 overflow-hidden">
        <div className="pb-2">
          {isEmpty && (
            <div className="flex flex-col items-center justify-center h-full py-16 px-6 text-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-terracotta/10 flex items-center justify-center">
                <Compass className="w-8 h-8 text-terracotta" />
              </div>
              <div>
                <h2 className="font-semibold text-lg">
                  <TypewriterText
                    text="Xin chào! Tôi là Compasso"
                    cursorClassName="bg-terracotta"
                  />
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Hãy cho tôi biết bạn muốn đi đâu, khi nào, và ngân sách của bạn. Tôi sẽ lập kế hoạch chi tiết cho bạn!
                </p>
              </div>
            </div>
          )}

          {messages.map((msg) => (
            <ChatMessage key={msg.id} message={msg} />
          ))}

          {isStreaming && (
            <StreamingMessage text={streamingText} status={streamingStatus} />
          )}

          {!isStreaming && pendingClarify && (
            <ClarifyCard payload={pendingClarify} onSubmit={(t) => handleSend(t)} />
          )}

          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      <ChatInput onSend={handleSend} />
    </div>
  );
}
