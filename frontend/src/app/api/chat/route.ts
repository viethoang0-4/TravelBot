/**
 * Thin proxy to the FastAPI backend.
 * Reads Auth.js session to forward the backend JWT.
 * Falls back to direct Gemini call if backend is unavailable.
 */
import { GoogleGenerativeAI, Part } from "@google/generative-ai";
import { SYSTEM_PROMPT, VISION_PROMPT } from "@/lib/gemini-prompts";
import { NextRequest } from "next/server";
import { auth } from "@/auth";

const BACKEND_URL = process.env.BACKEND_URL || "";

export async function POST(request: NextRequest) {
  const body = await request.json();

  // ── Proxy to FastAPI backend when available ───────────────────────────
  if (BACKEND_URL) {
    try {
      const session = await auth();
      const backendToken = session?.backendToken;

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (backendToken) {
        headers["Authorization"] = `Bearer ${backendToken}`;
      }

      const upstream = await fetch(`${BACKEND_URL}/api/v1/chat`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });

      if (!upstream.ok) {
        const errText = await upstream.text();
        console.error("[api/chat proxy] upstream error", upstream.status, errText);
        return Response.json({ error: errText }, { status: upstream.status });
      }

      return new Response(upstream.body, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
        },
      });
    } catch (err) {
      console.error("[api/chat proxy] fetch failed, falling back to direct Gemini", err);
    }
  }

  // ── Fallback: call Gemini directly (no backend running) ──────────────
  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
    const { messages, image } = body as {
      messages: Array<{ role: "user" | "assistant"; content: string }>;
      image?: string;
    };

    const model = genAI.getGenerativeModel({
      model: process.env.GEMINI_MODEL || "gemini-2.5-flash-preview-04-17",
      systemInstruction: SYSTEM_PROMPT,
    });

    const history = messages
      .slice(0, -1)
      .filter((m) => m.content.trim().length > 0)
      .map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }] as Part[],
      }));

    const chat = model.startChat({ history });
    const lastMessage = messages[messages.length - 1];

    let parts: Part[];
    if (image) {
      const base64Data = image.replace(/^data:image\/\w+;base64,/, "");
      const mimeType = (image.match(/^data:(image\/\w+);/)?.[1] ?? "image/jpeg") as string;
      parts = [
        { text: VISION_PROMPT + "\n\n" + (lastMessage.content || "Phân tích ảnh này giúp tôi.") },
        { inlineData: { mimeType, data: base64Data } },
      ];
    } else {
      parts = [{ text: lastMessage.content }];
    }

    const stream = await chat.sendMessageStream(parts);

    const encoder = new TextEncoder();
    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          let fullText = "";
          for await (const chunk of stream.stream) {
            const text = chunk.text();
            fullText += text;
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: "text", content: text })}\n\n`)
            );
          }

          const jsonMatch = fullText.match(/```json\n([\s\S]*?)\n```/);
          if (jsonMatch) {
            try {
              const itinerary = JSON.parse(jsonMatch[1]);
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ type: "itinerary", content: itinerary })}\n\n`
                )
              );
            } catch {
              // malformed JSON
            }
          }

          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "done" })}\n\n`));
          controller.close();
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : "Unknown error";
          console.error("[chat/stream fallback]", errorMsg);
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "error", content: errorMsg })}\n\n`)
          );
          controller.close();
        }
      },
    });

    return new Response(readableStream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return Response.json({ error: message }, { status: 500 });
  }
}
