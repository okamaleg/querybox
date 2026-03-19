import { useState, useCallback, useRef } from "react";

export interface ToolCall {
  name: string;
  input: Record<string, unknown>;
  result?: {
    success: boolean;
    sql?: string;
    explanation?: string;
    columns?: string[];
    rows?: Record<string, unknown>[];
    row_count?: number;
    execution_time_ms?: number;
    error?: string;
    truncated?: boolean;
    plan?: Record<string, unknown>[];
    [key: string]: unknown;
  };
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolCalls: ToolCall[];
}

interface UseChatReturn {
  messages: ChatMessage[];
  sendMessage: (text: string) => Promise<void>;
  isLoading: boolean;
}

export function useChat(
  connectionId: string,
  externalMessages?: ChatMessage[],
  externalSetMessages?: React.Dispatch<React.SetStateAction<ChatMessage[]>>
): UseChatReturn {
  const [internalMessages, internalSetMessages] = useState<ChatMessage[]>([]);
  const messages = externalMessages ?? internalMessages;
  const setMessages = externalSetMessages ?? internalSetMessages;
  const [isLoading, setIsLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const messagesRef = useRef<ChatMessage[]>([]);
  messagesRef.current = messages;

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isLoading) return;

      const userMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: text,
        toolCalls: [],
      };

      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "",
        toolCalls: [],
      };

      setMessages((prev) => [...prev, userMessage, assistantMessage]);
      setIsLoading(true);

      abortRef.current = new AbortController();

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            connectionId,
            messages: [...messagesRef.current, userMessage]
              .filter((m) => m.content)
              .map((m) => ({
                role: m.role,
                content: m.content,
              })),
          }),
          signal: abortRef.current.signal,
        });

        if (!res.ok || !res.body) {
          throw new Error(`HTTP error ${res.status}`);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const raw = line.slice(6).trim();
            if (!raw) continue;

            let event: { type: string; [key: string]: unknown };
            try {
              event = JSON.parse(raw);
            } catch {
              continue;
            }

            if (event.type === "text") {
              setMessages((prev) => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last && last.role === "assistant") {
                  updated[updated.length - 1] = {
                    ...last,
                    content: last.content + (event.content as string),
                  };
                }
                return updated;
              });
            } else if (event.type === "tool_call") {
              const toolCall: ToolCall = {
                name: event.name as string,
                input: (event.input as Record<string, unknown>) ?? {},
              };
              setMessages((prev) => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last && last.role === "assistant") {
                  // Avoid duplicate tool calls with same name that have no input yet
                  const exists = last.toolCalls.some(
                    (tc) => tc.name === toolCall.name && !tc.result && Object.keys(tc.input).length === 0
                  );
                  if (!exists) {
                    updated[updated.length - 1] = {
                      ...last,
                      toolCalls: [...last.toolCalls, toolCall],
                    };
                  }
                }
                return updated;
              });
            } else if (event.type === "tool_input") {
              // Update the tool call's input now that we have the full args
              const toolName = event.name as string;
              setMessages((prev) => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last && last.role === "assistant") {
                  const toolCalls = last.toolCalls.map((tc) =>
                    tc.name === toolName && Object.keys(tc.input).length === 0
                      ? { ...tc, input: (event.input as Record<string, unknown>) ?? tc.input }
                      : tc
                  );
                  updated[updated.length - 1] = { ...last, toolCalls };
                }
                return updated;
              });
            } else if (event.type === "tool_result") {
              const toolName = event.name as string;
              setMessages((prev) => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last && last.role === "assistant") {
                  const toolCalls = last.toolCalls.map((tc) =>
                    tc.name === toolName && !tc.result
                      ? { ...tc, result: event.result as ToolCall["result"] }
                      : tc
                  );
                  updated[updated.length - 1] = { ...last, toolCalls };
                }
                return updated;
              });
            } else if (event.type === "error") {
              setMessages((prev) => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last && last.role === "assistant") {
                  updated[updated.length - 1] = {
                    ...last,
                    content: last.content || (event.message as string) || "An error occurred.",
                  };
                }
                return updated;
              });
            } else if (event.type === "done") {
              break;
            }
          }
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") return;
        console.error("Chat error:", err);
        setMessages((prev) => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last && last.role === "assistant" && !last.content) {
            updated[updated.length - 1] = {
              ...last,
              content: "Something went wrong. Please try again.",
            };
          }
          return updated;
        });
      } finally {
        setIsLoading(false);
        abortRef.current = null;
      }
    },
    [isLoading, connectionId]
  );

  return { messages, sendMessage, isLoading };
}
