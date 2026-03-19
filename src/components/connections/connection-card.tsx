import { useState } from "react";
import { Database, Loader2, Check, X, Trash2, Plug } from "lucide-react";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type DbType = "postgresql" | "mysql" | "sqlite" | "mongodb";

interface ConnectionCardProps {
  id: string;
  name: string;
  type: DbType;
  created_at: string;
  onTest: (id: string) => Promise<void>;
  onDelete: (id: string) => void;
  onSelect: (id: string) => void;
}

const TYPE_CONFIG: Record<DbType, { label: string; color: string; badgeClass: string }> = {
  postgresql: {
    label: "PostgreSQL",
    color: "text-blue-400",
    badgeClass: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  },
  mysql: {
    label: "MySQL",
    color: "text-orange-400",
    badgeClass: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  },
  sqlite: {
    label: "SQLite",
    color: "text-green-400",
    badgeClass: "bg-green-500/15 text-green-400 border-green-500/30",
  },
  mongodb: {
    label: "MongoDB",
    color: "text-emerald-400",
    badgeClass: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  },
};

type TestState = "idle" | "testing" | "success" | "error";

export function ConnectionCard({
  id,
  name,
  type,
  created_at,
  onTest,
  onDelete,
  onSelect,
}: ConnectionCardProps) {
  const [testState, setTestState] = useState<TestState>("idle");
  const config = TYPE_CONFIG[type];

  const formattedDate = new Date(created_at).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  async function handleTest() {
    setTestState("testing");
    try {
      await onTest(id);
      setTestState("success");
    } catch {
      setTestState("error");
    }
    setTimeout(() => setTestState("idle"), 3000);
  }

  const testIcon =
    testState === "testing" ? (
      <Loader2 className="h-3.5 w-3.5 animate-spin" />
    ) : testState === "success" ? (
      <Check className="h-3.5 w-3.5 text-green-400" />
    ) : testState === "error" ? (
      <X className="h-3.5 w-3.5 text-red-400" />
    ) : null;

  return (
    <Card className="group bg-zinc-900 border-zinc-800 hover:border-zinc-600 transition-all duration-200 hover:shadow-lg hover:shadow-black/30">
      <CardContent className="pt-5 pb-3 px-5">
        <div className="flex items-start gap-3">
          <div
            className={cn(
              "mt-0.5 flex-shrink-0 rounded-md p-2 bg-zinc-800 border border-zinc-700",
              config.color
            )}
          >
            <Database className="h-5 w-5" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-zinc-100 text-sm truncate">{name}</h3>
              <Badge
                variant="outline"
                className={cn("text-[11px] px-1.5 py-0 h-5 border", config.badgeClass)}
              >
                {config.label}
              </Badge>
            </div>
            <p className="text-xs text-zinc-500 mt-1">Added {formattedDate}</p>
          </div>
        </div>
      </CardContent>

      <CardFooter className="px-5 pb-4 pt-1 flex gap-2">
        <Button
          size="sm"
          className="flex-1 h-8 text-xs bg-zinc-100 text-zinc-900 hover:bg-white"
          onClick={() => onSelect(id)}
        >
          <Plug className="h-3.5 w-3.5 mr-1.5" />
          Connect
        </Button>

        <Button
          size="sm"
          variant="outline"
          className="h-8 text-xs border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 min-w-[68px]"
          onClick={handleTest}
          disabled={testState === "testing"}
        >
          {testIcon && <span className="mr-1.5">{testIcon}</span>}
          {testState === "idle" && "Test"}
          {testState === "testing" && "Testing"}
          {testState === "success" && "OK"}
          {testState === "error" && "Failed"}
        </Button>

        <Button
          size="sm"
          variant="ghost"
          className="h-8 w-8 p-0 text-zinc-500 hover:text-red-400 hover:bg-red-500/10"
          onClick={() => onDelete(id)}
        >
          <Trash2 className="h-3.5 w-3.5" />
          <span className="sr-only">Delete connection</span>
        </Button>
      </CardFooter>
    </Card>
  );
}
