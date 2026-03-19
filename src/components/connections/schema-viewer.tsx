"use client";

import { useState, useMemo } from "react";
import {
  ChevronRight,
  ChevronDown,
  Key,
  ArrowRight,
  Table2,
  Search,
  Hash,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface Column {
  name: string;
  type: string;
  is_primary_key: boolean;
  nullable: boolean;
}

interface ForeignKey {
  column: string;
  references_table: string;
  references_column: string;
}

interface Table {
  name: string;
  columns: Column[];
  foreign_keys: ForeignKey[];
  row_count?: number;
}

interface SchemaViewerProps {
  schema: { tables: Table[] };
}

function TypeBadge({ type }: { type: string }) {
  const upper = type.toUpperCase();
  const isNumeric = /^(INT|BIGINT|SMALLINT|NUMERIC|DECIMAL|FLOAT|DOUBLE|REAL|SERIAL)/.test(upper);
  const isText = /^(VARCHAR|TEXT|CHAR|UUID|ENUM)/.test(upper);
  const isDate = /^(DATE|TIME|TIMESTAMP|INTERVAL)/.test(upper);
  const isBool = /^(BOOL|BOOLEAN)/.test(upper);

  return (
    <span
      className={cn(
        "text-[10px] font-mono px-1.5 py-0.5 rounded border",
        isNumeric && "bg-purple-500/10 text-purple-400 border-purple-500/20",
        isText && "bg-blue-500/10 text-blue-400 border-blue-500/20",
        isDate && "bg-amber-500/10 text-amber-400 border-amber-500/20",
        isBool && "bg-green-500/10 text-green-400 border-green-500/20",
        !isNumeric && !isText && !isDate && !isBool &&
          "bg-zinc-700/60 text-zinc-400 border-zinc-700"
      )}
    >
      {type}
    </span>
  );
}

function ColumnRow({ column, foreignKeys }: { column: Column; foreignKeys: ForeignKey[] }) {
  const fk = foreignKeys.find((fk) => fk.column === column.name);

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-zinc-800/60 group">
      {/* PK indicator */}
      <div className="w-4 flex-shrink-0 flex items-center justify-center">
        {column.is_primary_key ? (
          <Key className="h-3 w-3 text-amber-400" />
        ) : fk ? (
          <ArrowRight className="h-3 w-3 text-blue-400" />
        ) : (
          <span className="h-3 w-3 block" />
        )}
      </div>

      <span
        className={cn(
          "text-sm flex-1 truncate",
          column.is_primary_key ? "text-amber-300 font-medium" : "text-zinc-300"
        )}
      >
        {column.name}
        {column.nullable && (
          <span className="text-zinc-600 text-xs ml-1">?</span>
        )}
      </span>

      <TypeBadge type={column.type} />

      {fk && (
        <span className="text-[10px] text-blue-400/70 opacity-0 group-hover:opacity-100 transition-opacity truncate max-w-[120px]">
          → {fk.references_table}.{fk.references_column}
        </span>
      )}
    </div>
  );
}

function TableRow({ table }: { table: Table }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-lg border border-zinc-800 overflow-hidden">
      {/* Table header */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2.5 bg-zinc-900 hover:bg-zinc-800/70 transition-colors text-left"
      >
        <span className="flex-shrink-0 text-zinc-500">
          {open ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </span>

        <Table2 className="h-4 w-4 text-zinc-400 flex-shrink-0" />

        <span className="font-medium text-sm text-zinc-100 flex-1 truncate">{table.name}</span>

        <div className="flex items-center gap-2 flex-shrink-0">
          {table.row_count !== undefined && (
            <span className="flex items-center gap-1 text-[11px] text-zinc-500">
              <Hash className="h-3 w-3" />
              {table.row_count.toLocaleString()}
            </span>
          )}
          <Badge
            variant="outline"
            className="text-[10px] h-5 px-1.5 border-zinc-700 text-zinc-500"
          >
            {table.columns.length} cols
          </Badge>
        </div>
      </button>

      {/* Columns */}
      {open && (
        <div className="bg-zinc-950/50 px-2 py-1.5 space-y-0.5 border-t border-zinc-800">
          {table.columns.map((col) => (
            <ColumnRow key={col.name} column={col} foreignKeys={table.foreign_keys} />
          ))}

          {table.foreign_keys.length > 0 && (
            <div className="mt-2 pt-2 border-t border-zinc-800/60 px-3">
              <p className="text-[11px] text-zinc-600 mb-1.5 uppercase tracking-wider">
                Foreign Keys
              </p>
              {table.foreign_keys.map((fk, i) => (
                <div key={i} className="flex items-center gap-1.5 text-[11px] text-zinc-500 py-0.5">
                  <span className="text-blue-400 font-mono">{fk.column}</span>
                  <ArrowRight className="h-3 w-3 text-zinc-600 flex-shrink-0" />
                  <span className="font-mono">
                    {fk.references_table}
                    <span className="text-zinc-600">.</span>
                    {fk.references_column}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function SchemaViewer({ schema }: SchemaViewerProps) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return schema.tables;
    return schema.tables.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.columns.some((c) => c.name.toLowerCase().includes(q))
    );
  }, [schema.tables, search]);

  return (
    <div className="flex flex-col h-full gap-3">
      {/* Search */}
      <div className="relative flex-shrink-0">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500 pointer-events-none" />
        <Input
          placeholder="Filter tables or columns…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 bg-zinc-900 border-zinc-700 text-zinc-100 placeholder:text-zinc-600 focus-visible:ring-zinc-500 h-9"
        />
      </div>

      {/* Stats bar */}
      <div className="flex items-center gap-3 text-xs text-zinc-500 flex-shrink-0">
        <span>
          {filtered.length} {filtered.length === 1 ? "table" : "tables"}
          {search && ` of ${schema.tables.length}`}
        </span>
        <span>·</span>
        <span>
          {schema.tables.reduce((sum, t) => sum + t.columns.length, 0)} total columns
        </span>
      </div>

      {/* Table list */}
      <div className="flex-1 overflow-y-auto space-y-2 min-h-0 pr-1">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Search className="h-8 w-8 text-zinc-700 mb-3" />
            <p className="text-sm text-zinc-500">No tables match "{search}"</p>
          </div>
        ) : (
          filtered.map((table) => <TableRow key={table.name} table={table} />)
        )}
      </div>
    </div>
  );
}
