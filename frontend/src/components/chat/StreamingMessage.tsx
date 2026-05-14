"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Compass, Loader2, Search } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface Props {
  text: string;
  status: string;
}

export default function StreamingMessage({ text, status }: Props) {
  const displayText = text.replace(/```json\n[\s\S]*?\n```/g, "").trim();

  return (
    <div className="flex gap-3 px-4 py-3">
      <Avatar className="w-8 h-8 shrink-0 mt-0.5">
        <AvatarFallback className="bg-terracotta text-white text-xs">
          <Compass className="w-4 h-4" />
        </AvatarFallback>
      </Avatar>

      <div className="flex flex-col gap-1.5 max-w-[85%] items-start">
        {status && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground bg-terracotta/5 border border-terracotta/20 rounded-sm px-3 py-1 font-medium italic">
            {status.includes("tìm") ? (
              <Search className="w-3 h-3 animate-pulse text-terracotta" />
            ) : (
              <Loader2 className="w-3 h-3 animate-spin text-terracotta" />
            )}
            <span>{status}</span>
          </div>
        )}

        {displayText && (
          <div className="bg-background border border-border rounded-lg rounded-tl-sm px-4 py-2.5 text-sm leading-relaxed shadow-sm">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                p: ({ children }) => <p className="mb-1 last:mb-0">{children}</p>,
                strong: ({ children }) => (
                  <strong className="font-bold">{children}</strong>
                ),
              }}
            >
              {displayText}
            </ReactMarkdown>
            <span className="inline-block w-1.5 h-4 bg-terracotta ml-0.5 animate-pulse rounded-sm align-middle" />
          </div>
        )}
      </div>
    </div>
  );
}
