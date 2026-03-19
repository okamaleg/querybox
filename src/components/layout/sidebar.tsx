import { Link, useLocation } from "react-router-dom";
import { Database, MessageSquare, Plus, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

interface Connection {
  id: string;
  name: string;
  type: "postgresql" | "mysql" | "sqlite" | "mongodb";
}

interface SidebarProps {
  connections?: Connection[];
  activeConnectionId?: string | null;
  onSelectConnection?: (id: string) => void;
}

const navItems = [
  { href: "/chat", label: "Chat", icon: MessageSquare },
  { href: "/connections", label: "Connections", icon: Database },
  { href: "/settings", label: "Settings", icon: Settings },
];

const DB_TYPE_LABELS: Record<string, string> = {
  postgresql: "PG",
  mysql: "MY",
  sqlite: "SQ",
  mongodb: "MG",
};

export function Sidebar({
  connections = [],
  activeConnectionId,
  onSelectConnection,
}: SidebarProps) {
  const { pathname } = useLocation();

  return (
    <aside className="flex h-full w-56 flex-col bg-zinc-950 border-r border-zinc-800">
      {/* App logo — top padding for macOS traffic lights */}
      <div
        className="flex items-center gap-2.5 px-3 pt-8 pb-4"
        style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
      >
        <Database className="size-5 shrink-0 text-indigo-400" />
        <span className="text-sm font-semibold tracking-wide text-zinc-100">
          Querybox
        </span>
      </div>

      {/* Primary nav */}
      <nav className="flex flex-col gap-0.5 px-2">
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              to={href}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-indigo-600/20 text-indigo-300"
                  : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
              )}
            >
              <Icon className="size-4 shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>

      <Separator className="my-3 bg-zinc-800" />

      {/* Saved connections */}
      <div className="flex items-center justify-between px-3 pb-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
          Connections
        </span>
      </div>

      <ScrollArea className="min-h-0 flex-1 px-2">
        <div className="flex flex-col gap-0.5 pb-2">
          {connections.map((conn) => {
            const isActive = conn.id === activeConnectionId;
            const typeLabel = DB_TYPE_LABELS[conn.type] ?? "DB";

            return (
              <button
                key={conn.id}
                onClick={() => onSelectConnection?.(conn.id)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-sm transition-colors text-left",
                  isActive
                    ? "bg-zinc-700 text-zinc-100"
                    : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                )}
              >
                <span
                  className={cn(
                    "inline-flex size-5 shrink-0 items-center justify-center rounded text-[9px] font-bold",
                    isActive
                      ? "bg-indigo-500 text-white"
                      : "bg-zinc-700 text-zinc-300"
                  )}
                >
                  {typeLabel}
                </span>
                <span className="truncate">{conn.name}</span>
              </button>
            );
          })}

          {connections.length === 0 && (
            <p className="px-2.5 py-2 text-xs text-zinc-600">
              No connections yet
            </p>
          )}
        </div>
      </ScrollArea>

      {/* New Connection button */}
      <div className="p-2">
        <Link to="/connections/new">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
          >
            <Plus className="size-4 shrink-0" />
            New Connection
          </Button>
        </Link>
      </div>
    </aside>
  );
}
