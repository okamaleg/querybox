import { useState, useEffect, useRef } from "react";
import { Send, Database, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageBubble } from "./message-bubble";
import { StreamingIndicator } from "./streaming-indicator";
import { useChat } from "@/hooks/use-chat";
import { useAppState } from "@/hooks/use-app-state";

const SUGGESTED_QUERIES = [
  "Show me all tables",
  "What's the row count for each table?",
  "Describe the schema",
  "Show me a sample from the largest table",
];

interface ChatPanelProps {
  connectionId: string;
}

export function ChatPanel({ connectionId }: ChatPanelProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [input, setInput] = useState("");

  const { chatMessages, setChatMessages } = useAppState();
  const { messages, sendMessage, isLoading } = useChat(connectionId, chatMessages, setChatMessages);

  // Auto-scroll to bottom on new messages or streaming
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // Auto-resize textarea
  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  };

  const submitMessage = () => {
    if (!input.trim() || isLoading) return;
    sendMessage(input);
    setInput("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submitMessage();
    }
  };

  const handleSuggestedQuery = (query: string) => {
    sendMessage(query);
  };

  const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    submitMessage();
  };

  // No connection selected
  if (!connectionId) {
    return (
      <div className="flex h-full items-center justify-center bg-zinc-950">
        <div className="flex flex-col items-center gap-3 text-center px-6">
          <div className="rounded-full bg-zinc-800 p-4 border border-zinc-700">
            <Database className="size-8 text-zinc-500" />
          </div>
          <p className="text-zinc-400 font-medium">Select a connection first</p>
          <p className="text-xs text-zinc-600 max-w-[220px]">
            Choose a database connection from the sidebar to start chatting.
          </p>
        </div>
      </div>
    );
  }

  const isEmpty = messages.length === 0;

  return (
    <div className="flex flex-col h-full bg-zinc-950">
      {/* Message list */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="px-4 py-4 flex flex-col gap-4">
          {/* Welcome / empty state */}
          {isEmpty && (
            <div className="flex flex-col items-center gap-4 pt-12 pb-6 text-center">
              <div className="rounded-full bg-zinc-800 p-4 border border-zinc-700">
                <Sparkles className="size-8 text-zinc-400" />
              </div>
              <div>
                <h2 className="text-zinc-200 font-semibold text-base">Ask Querybox anything</h2>
                <p className="text-xs text-zinc-500 mt-1 max-w-[260px]">
                  Query your database using plain English. Try one of these to get started:
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-2 max-w-sm">
                {SUGGESTED_QUERIES.map((q) => (
                  <button
                    key={q}
                    onClick={() => handleSuggestedQuery(q)}
                    className="text-xs bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 hover:border-zinc-600 text-zinc-300 rounded-full px-3 py-1.5 transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Messages */}
          {messages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))}

          {/* Streaming indicator — show when loading and last message is still streaming */}
          {isLoading && messages[messages.length - 1]?.role === "assistant" &&
            !messages[messages.length - 1]?.content &&
            messages[messages.length - 1]?.toolCalls.length === 0 && (
            <div className="flex items-start">
              <div className="bg-zinc-800 border border-zinc-700 rounded-2xl rounded-bl-sm px-4 py-3">
                <StreamingIndicator />
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      {/* Input area */}
      <div className="shrink-0 border-t border-zinc-800 bg-zinc-900/80 backdrop-blur px-4 py-3">
        <form onSubmit={handleFormSubmit} className="flex items-end gap-2">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={handleTextareaChange}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your database..."
            rows={1}
            disabled={isLoading}
            className={cn(
              "flex-1 resize-none min-h-[40px] max-h-[200px] overflow-y-auto",
              "bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-500",
              "focus-visible:ring-zinc-600 rounded-xl text-sm",
              "disabled:opacity-50 disabled:cursor-not-allowed"
            )}
          />
          <Button
            type="submit"
            size="icon"
            disabled={!input.trim() || isLoading}
            className={cn(
              "shrink-0 size-10 rounded-xl",
              "bg-zinc-100 hover:bg-white text-zinc-900",
              "disabled:opacity-40 disabled:cursor-not-allowed",
              "transition-all"
            )}
          >
            <Send className="size-4" />
            <span className="sr-only">Send</span>
          </Button>
        </form>
        <p className="text-[10px] text-zinc-600 mt-1.5 text-center select-none">
          Press Enter to send · Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}
