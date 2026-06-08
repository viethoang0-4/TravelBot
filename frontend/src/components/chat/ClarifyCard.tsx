"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Send } from "lucide-react";
import { ClarifyPayload } from "@/types/travel";
import { useTravelStore } from "@/store/travel-store";
import { cn } from "@/lib/utils";

/** Nhãn tiếng Việt cho từng trường — dùng khi soạn câu trả lời gửi lại */
const FIELD_LABEL: Record<string, string> = {
  origin: "Nơi xuất phát",
  destination: "Điểm đến",
  start_date: "Ngày khởi hành",
  num_days: "Số ngày",
  budget_vnd: "Ngân sách",
  party_size: "Số người",
};

interface Props {
  payload: ClarifyPayload;
  /** Gửi câu trả lời đã gộp thành 1 tin nhắn người dùng */
  onSubmit: (text: string) => void;
}

export default function ClarifyCard({ payload, onSubmit }: Props) {
  const isStreaming = useTravelStore((s) => s.isStreaming);
  const [answers, setAnswers] = useState<Record<string, string>>({});

  // Reset khi nhận bộ câu hỏi mới
  useEffect(() => {
    setAnswers({});
  }, [payload]);

  const setAnswer = (field: string, value: string) =>
    setAnswers((a) => ({ ...a, [field]: value }));

  const allAnswered = payload.questions.every((q) => (answers[q.field] ?? "").trim());

  const handleSubmit = () => {
    if (!allAnswered || isStreaming) return;
    const text = payload.questions
      .map((q) => `${FIELD_LABEL[q.field] ?? q.field}: ${answers[q.field].trim()}`)
      .join(". ");
    onSubmit(text);
  };

  return (
    <div className="flex gap-3 px-4 py-1">
      {/* cột trống canh thẳng với avatar của bong bóng intro phía trên */}
      <div className="w-8 shrink-0" />

      <div className="flex flex-col gap-3 max-w-[90%] w-full items-start">
        {/* intro hiển thị ở bong bóng assistant phía trên (trong danh sách messages) */}
        <div className="w-full rounded-lg border border-terracotta/25 bg-terracotta/5 p-3 space-y-3">
          {payload.questions.map((q) => (
            <div key={q.field} className="space-y-1.5">
              <p className="text-sm font-medium text-foreground">{q.question}</p>

              {q.options.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {q.options.map((opt) => {
                    const active = answers[q.field] === opt;
                    return (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setAnswer(q.field, opt)}
                        className={cn(
                          "px-2.5 py-1 rounded-full text-xs border transition-colors",
                          active
                            ? "bg-terracotta text-white border-terracotta"
                            : "bg-background text-foreground border-border hover:border-terracotta/60"
                        )}
                      >
                        {opt}
                      </button>
                    );
                  })}
                </div>
              )}

              <input
                type="text"
                value={answers[q.field] ?? ""}
                onChange={(e) => setAnswer(q.field, e.target.value)}
                placeholder="Hoặc tự nhập..."
                className={cn(
                  "w-full text-sm rounded-sm border border-border bg-background px-2.5 py-1.5",
                  "focus:outline-none focus:ring-1 focus:ring-terracotta"
                )}
              />
            </div>
          ))}

          <Button
            onClick={handleSubmit}
            disabled={!allAnswered || isStreaming}
            className="w-full h-9 rounded-sm bg-terracotta hover:bg-terracotta-dark text-white"
          >
            <Send className="w-3.5 h-3.5 mr-1.5" />
            Gửi thông tin
          </Button>
        </div>
      </div>
    </div>
  );
}
