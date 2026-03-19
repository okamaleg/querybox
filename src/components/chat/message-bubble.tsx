import { cn } from "@/lib/utils";
import { SqlResultTable } from "./sql-result-table";
import type { ChatMessage, ToolCall } from "@/hooks/use-chat";

interface MessageBubbleProps {
  message: ChatMessage;
}

// ---------------------------------------------------------------------------
// Minimal markdown renderer — bold, inline code, fenced code blocks, lists
// ---------------------------------------------------------------------------
function renderMarkdown(text: string): React.ReactNode[] {
  const lines = text.split("\n");
  const nodes: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block
    if (line.startsWith("```")) {
      const lang = line.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      nodes.push(
        <pre
          key={i}
          className="my-2 rounded-md bg-zinc-950 border border-zinc-700 px-3 py-2 overflow-x-auto"
        >
          <code
            className={cn(
              "text-xs font-mono text-emerald-300",
              lang === "sql" && "text-blue-300"
            )}
          >
            {codeLines.join("\n")}
          </code>
        </pre>
      );
      i++; // skip closing ```
      continue;
    }

    // Unordered list item
    if (/^[-*]\s/.test(line)) {
      const items: React.ReactNode[] = [];
      while (i < lines.length && /^[-*]\s/.test(lines[i])) {
        items.push(
          <li key={i} className="ml-4 list-disc">
            {renderInline(lines[i].replace(/^[-*]\s/, ""))}
          </li>
        );
        i++;
      }
      nodes.push(
        <ul key={`ul-${i}`} className="my-1 space-y-0.5">
          {items}
        </ul>
      );
      continue;
    }

    // Ordered list item
    if (/^\d+\.\s/.test(line)) {
      const items: React.ReactNode[] = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        items.push(
          <li key={i} className="ml-4 list-decimal">
            {renderInline(lines[i].replace(/^\d+\.\s/, ""))}
          </li>
        );
        i++;
      }
      nodes.push(
        <ol key={`ol-${i}`} className="my-1 space-y-0.5">
          {items}
        </ol>
      );
      continue;
    }

    // Heading
    if (/^#{1,3}\s/.test(line)) {
      const level = line.match(/^(#+)/)?.[1].length ?? 1;
      const content = line.replace(/^#+\s/, "");
      nodes.push(
        <p
          key={i}
          className={cn(
            "font-semibold mt-3 mb-1",
            level === 1 && "text-base",
            level === 2 && "text-sm",
            level === 3 && "text-xs uppercase tracking-wide text-zinc-400"
          )}
        >
          {renderInline(content)}
        </p>
      );
      i++;
      continue;
    }

    // Blank line
    if (line.trim() === "") {
      nodes.push(<div key={i} className="h-1.5" />);
      i++;
      continue;
    }

    // Regular paragraph
    nodes.push(
      <p key={i} className="leading-relaxed">
        {renderInline(line)}
      </p>
    );
    i++;
  }

  return nodes;
}

function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i} className="font-semibold text-zinc-100">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code key={i} className="font-mono text-xs bg-zinc-800 text-emerald-300 px-1 py-0.5 rounded">
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
}

// ---------------------------------------------------------------------------
// Tool call renderer
// ---------------------------------------------------------------------------
function ToolCallResult({ toolCall }: { toolCall: ToolCall }) {
  if (!toolCall.result) {
    return (
      <div className="text-xs text-zinc-500 italic px-1 py-0.5">
        Running {toolCall.name}...
      </div>
    );
  }

  const result = toolCall.result;

  if (!result.success) {
    return (
      <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-md px-3 py-2">
        {result.error || "Tool call failed"}
      </div>
    );
  }

  if (toolCall.name === "run_query" || toolCall.name === "run_sql_query" || toolCall.name === "get_table_sample") {
    return (
      <SqlResultTable
        sql={(result.query as string) ?? (toolCall.input?.query as string) ?? ""}
        explanation={(result.explanation as string) ?? (toolCall.input?.explanation as string) ?? ""}
        columns={(result.columns as string[]) ?? []}
        rows={(result.rows as Record<string, unknown>[]) ?? []}
        executionTime={result.execution_time_ms as number | undefined}
        rowCount={(result.row_count as number) ?? 0}
        success={(result.success as boolean) ?? true}
        error={result.error as string | undefined}
        truncated={result.truncated as boolean | undefined}
      />
    );
  }

  if (toolCall.name === "explain_query") {
    return (
      <SqlResultTable
        sql={(toolCall.input?.query as string) ?? ""}
        explanation="Query execution plan"
        columns={["Plan"]}
        rows={
          Array.isArray(result.plan)
            ? (result.plan as Record<string, unknown>[])
            : []
        }
        success={(result.success as boolean) ?? true}
        error={result.error as string | undefined}
      />
    );
  }

  // Generic fallback
  return (
    <pre className="text-xs font-mono text-zinc-400 bg-zinc-950 rounded px-3 py-2 border border-zinc-700 overflow-x-auto">
      {JSON.stringify(result, null, 2)}
    </pre>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user";

  return (
    <div className={cn("flex flex-col gap-1 w-full", isUser ? "items-end" : "items-start")}>
      <span className="text-[10px] font-medium text-zinc-500 px-1 select-none">
        {isUser ? "You" : "Querybox"}
      </span>

      {message.content && (
        <div
          className={cn(
            "rounded-2xl px-4 py-2.5 max-w-[85%] text-sm leading-relaxed",
            isUser
              ? "bg-zinc-100 text-zinc-900 rounded-br-sm"
              : "bg-zinc-800 text-zinc-200 rounded-bl-sm border border-zinc-700"
          )}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : (
            <div className="flex flex-col gap-0.5">
              {renderMarkdown(message.content)}
            </div>
          )}
        </div>
      )}

      {/* Tool results rendered outside the bubble for full width */}
      {message.toolCalls.length > 0 && (
        <div className="w-full max-w-full flex flex-col gap-2 mt-1">
          {message.toolCalls.map((tc, idx) => (
            <ToolCallResult key={`${tc.name}-${idx}`} toolCall={tc} />
          ))}
        </div>
      )}
    </div>
  );
}
