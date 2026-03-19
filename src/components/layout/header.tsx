import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface HeaderProps {
  title: string;
  connected?: boolean;
  activeConnectionName?: string;
  safetyMode?: boolean;
  className?: string;
}

export function Header({
  title,
  connected = false,
  activeConnectionName,
  safetyMode = false,
  className,
}: HeaderProps) {
  return (
    <header
      className={cn(
        "flex h-11 shrink-0 items-center border-b border-zinc-800 bg-zinc-950 px-4",
        // Left padding to clear macOS traffic-light buttons (approx 72px)
        "pl-[72px]",
        className
      )}
      style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
    >
      {/* Page title */}
      <h1 className="text-sm font-semibold text-zinc-100">{title}</h1>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Right-side indicators — no-drag so they stay interactive */}
      <div
        className="flex items-center gap-3"
        style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
      >
        {/* Safety / read-only badge */}
        {safetyMode && (
          <Badge
            variant="outline"
            className="border-amber-600/60 bg-amber-950/40 px-2 py-0.5 text-[11px] font-medium text-amber-400"
          >
            Read Only
          </Badge>
        )}

        {/* Connection status */}
        <div className="flex items-center gap-1.5">
          {/* Status dot */}
          <span
            className={cn(
              "size-2 rounded-full",
              connected
                ? "bg-emerald-500 shadow-[0_0_6px_1px_rgba(16,185,129,0.5)]"
                : "bg-red-500/80"
            )}
          />

          {/* Connection name or generic label */}
          <span className="text-xs text-zinc-400">
            {connected && activeConnectionName
              ? activeConnectionName
              : connected
              ? "Connected"
              : "Disconnected"}
          </span>
        </div>
      </div>
    </header>
  );
}
