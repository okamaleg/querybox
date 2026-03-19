import { cn } from "@/lib/utils";

export function StreamingIndicator({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2 px-1", className)}>
      <div className="flex items-center gap-1">
        <span
          className="size-1.5 rounded-full bg-zinc-400 animate-bounce"
          style={{ animationDelay: "0ms", animationDuration: "1s" }}
        />
        <span
          className="size-1.5 rounded-full bg-zinc-400 animate-bounce"
          style={{ animationDelay: "200ms", animationDuration: "1s" }}
        />
        <span
          className="size-1.5 rounded-full bg-zinc-400 animate-bounce"
          style={{ animationDelay: "400ms", animationDuration: "1s" }}
        />
      </div>
      <span className="text-xs text-zinc-500 select-none">Querybox is thinking...</span>
    </div>
  );
}
