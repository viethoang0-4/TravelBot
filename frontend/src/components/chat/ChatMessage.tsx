"use client";

import { ChatMessage as ChatMessageType } from "@/types/travel";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Compass, User } from "lucide-react";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface Props {
  message: ChatMessageType;
}

export default function ChatMessage({ message }: Props) {
  const isUser = message.role === "user";

  // Strip JSON code block from display
  const displayContent = message.content
    .replace(/```json\n[\s\S]*?\n```/g, "")
    .trim();

  return (
    <div
      className={cn(
        "flex gap-3 px-4 py-3",
        isUser ? "flex-row-reverse" : "flex-row"
      )}
    >
      <Avatar className="w-8 h-8 shrink-0 mt-0.5">
        <AvatarFallback
          className={cn(
            "text-xs",
            isUser
              ? "bg-ink text-white"
              : "bg-terracotta text-white"
          )}
        >
          {isUser ? <User className="w-4 h-4" /> : <Compass className="w-4 h-4" />}
        </AvatarFallback>
      </Avatar>

      <div
        className={cn(
          "flex flex-col gap-1 max-w-[85%]",
          isUser ? "items-end" : "items-start"
        )}
      >
        {message.image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={message.image}
            alt="Uploaded"
            className="max-w-48 rounded-sm border object-cover shadow-sm"
          />
        )}

        {displayContent && (
          <div
            className={cn(
              "rounded-lg px-4 py-2.5 text-sm leading-relaxed shadow-sm",
              isUser
                ? "bg-terracotta text-white rounded-tr-sm"
                : "bg-card border border-border rounded-tl-sm text-foreground"
            )}
          >
            {isUser ? (
              <p className="whitespace-pre-wrap">{displayContent}</p>
            ) : (
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  p: ({ children }) => <p className="mb-1 last:mb-0">{children}</p>,
                  strong: ({ children }) => (
                    <strong className="font-bold">{children}</strong>
                  ),
                  ul: ({ children }) => (
                    <ul className="list-disc list-inside mb-1">{children}</ul>
                  ),
                  ol: ({ children }) => (
                    <ol className="list-decimal list-inside mb-1">{children}</ol>
                  ),
                  li: ({ children }) => <li className="mb-0.5">{children}</li>,
                  code: ({ children }) => (
                    <code className="bg-black/10 dark:bg-white/10 px-1 rounded text-xs">
                      {children}
                    </code>
                  ),
                }}
              >
                {displayContent}
              </ReactMarkdown>
            )}
          </div>
        )}

        {message.itinerary && (
          <div className="bg-terracotta/5 border border-terracotta/20 rounded-sm px-3 py-2 text-xs text-terracotta flex items-center gap-2 font-medium">
            <Compass className="w-3.5 h-3.5 shrink-0" />
            <span>
              Đã tạo lịch trình:{" "}
              <strong className="font-bold">{message.itinerary.title}</strong>
            </span>
          </div>
        )}

        <span className="text-[10px] text-muted-foreground px-1">
          {message.timestamp.toLocaleTimeString("vi-VN", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </div>
    </div>
  );
}
