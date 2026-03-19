import { useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";
import { useAppState } from "@/hooks/use-app-state";
import { ConnectionCard } from "@/components/connections/connection-card";
import { Button } from "@/components/ui/button";

export default function ConnectionsPage() {
  const { connections, setActiveConnectionId, refreshConnections } = useAppState();
  const navigate = useNavigate();

  async function handleTest(id: string): Promise<void> {
    const res = await fetch(`/api/connections/${id}/test`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.success === false) {
      throw new Error(data.message ?? "Connection failed");
    }
  }

  async function handleDelete(id: string) {
    await fetch(`/api/connections/${id}`, { method: "DELETE" });
    await refreshConnections();
  }

  function handleSelect(id: string) {
    setActiveConnectionId(id);
    navigate("/chat");
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-zinc-100">Your Connections</h2>
          <p className="text-sm text-zinc-500 mt-0.5">
            {connections.length === 0
              ? "No connections yet. Add one to get started."
              : `${connections.length} connection${connections.length !== 1 ? "s" : ""}`}
          </p>
        </div>
        <Button
          onClick={() => navigate("/connections/new")}
          className="bg-zinc-100 text-zinc-900 hover:bg-white gap-2"
        >
          <Plus className="h-4 w-4" />
          New Connection
        </Button>
      </div>

      {connections.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <p className="text-zinc-500 text-sm">No connections yet.</p>
          <Button
            variant="outline"
            className="mt-4 border-zinc-700 text-zinc-300 hover:bg-zinc-800"
            onClick={() => navigate("/connections/new")}
          >
            Add your first connection
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {connections.map((conn) => (
            <ConnectionCard
              key={conn.id}
              id={conn.id}
              name={conn.name}
              type={conn.type}
              created_at={conn.created_at}
              onTest={handleTest}
              onDelete={handleDelete}
              onSelect={handleSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}
