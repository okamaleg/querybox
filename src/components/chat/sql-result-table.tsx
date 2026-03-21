import { useState } from "react";
import { ChevronDown, ChevronRight, Clock, Rows, AlertCircle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SqlResultProps {
  sql: string;
  explanation: string;
  columns?: string[];
  rows?: Record<string, unknown>[];
  executionTime?: number;
  rowCount?: number;
  success: boolean;
  error?: string;
  truncated?: boolean;
}

function formatCellValue(value: unknown): string {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export function SqlResultTable({
  sql,
  explanation,
  columns = [],
  rows = [],
  executionTime,
  rowCount,
  success,
  error,
  truncated,
}: SqlResultProps) {
  const [queryExpanded, setQueryExpanded] = useState(false);
  const ROWS_PER_PAGE = 50;
  const [visibleRows, setVisibleRows] = useState(ROWS_PER_PAGE);

  return (
    <div className="rounded-lg border border-zinc-700 bg-zinc-900 overflow-hidden text-sm w-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-700 bg-zinc-800/60">
        <div className="flex items-center gap-2">
          {success ? (
            <CheckCircle2 className="size-3.5 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="size-3.5 text-red-400 shrink-0" />
          )}
          <span className="text-xs font-medium text-zinc-300 truncate max-w-xs">
            {explanation}
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs text-zinc-500 shrink-0 ml-2">
          {executionTime !== undefined && (
            <span className="flex items-center gap-1">
              <Clock className="size-3" />
              {executionTime}ms
            </span>
          )}
          {rowCount !== undefined && (
            <span className="flex items-center gap-1">
              <Rows className="size-3" />
              {rowCount} row{rowCount !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      </div>

      {/* Collapsible SQL query */}
      <button
        className="flex items-center gap-1.5 w-full px-3 py-1.5 text-xs text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/40 transition-colors text-left"
        onClick={() => setQueryExpanded((v) => !v)}
      >
        {queryExpanded ? (
          <ChevronDown className="size-3 shrink-0" />
        ) : (
          <ChevronRight className="size-3 shrink-0" />
        )}
        <span className="font-mono text-zinc-400 truncate">{sql}</span>
      </button>

      {queryExpanded && (
        <div className="px-3 pb-2">
          <pre className="text-xs font-mono text-emerald-300 bg-zinc-950 rounded px-3 py-2 overflow-x-auto whitespace-pre-wrap break-all border border-zinc-700">
            {sql}
          </pre>
        </div>
      )}

      {/* Error state */}
      {!success && error && (
        <div className="px-3 py-3 border-t border-zinc-700">
          <div className="flex items-start gap-2 rounded-md bg-red-950/40 border border-red-800/50 px-3 py-2">
            <AlertCircle className="size-4 text-red-400 mt-0.5 shrink-0" />
            <p className="text-xs text-red-300 font-mono break-all">{error}</p>
          </div>
        </div>
      )}

      {/* Results table */}
      {success && columns.length > 0 && (
        <div className="border-t border-zinc-700 overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-zinc-800/80">
                {columns.map((col) => (
                  <th
                    key={col}
                    className="px-3 py-2 text-left font-medium text-zinc-400 whitespace-nowrap border-b border-zinc-700"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, visibleRows).map((row, i) => (
                <tr
                  key={i}
                  className={cn(
                    "border-b border-zinc-800 last:border-0",
                    i % 2 === 0 ? "bg-zinc-900" : "bg-zinc-800/30"
                  )}
                >
                  {columns.map((col) => (
                    <td
                      key={col}
                      className="px-3 py-1.5 font-mono text-zinc-300 whitespace-nowrap max-w-[240px] overflow-hidden text-ellipsis"
                      title={formatCellValue(row[col])}
                    >
                      {row[col] === null || row[col] === undefined ? (
                        <span className="text-zinc-600 italic">NULL</span>
                      ) : (
                        formatCellValue(row[col])
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>

          {rows.length > visibleRows && (
            <button
              onClick={() => setVisibleRows((v) => v + ROWS_PER_PAGE)}
              className="w-full px-3 py-2 text-xs text-zinc-400 hover:text-zinc-200 bg-zinc-800/40 hover:bg-zinc-800/60 border-t border-zinc-700 transition-colors"
            >
              Show more ({rows.length - visibleRows} remaining)
            </button>
          )}

          {truncated && (
            <div className="px-3 py-1.5 text-xs text-zinc-500 bg-zinc-800/40 border-t border-zinc-700">
              Showing first 200 rows — results were truncated.
            </div>
          )}

          {rows.length === 0 && (
            <div className="px-3 py-4 text-xs text-zinc-500 text-center">
              Query returned no rows.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
