import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useAppState } from "@/hooks/use-app-state";
import { ConnectionForm } from "@/components/connections/connection-form";
import { Button } from "@/components/ui/button";

export default function ConnectionsNewPage() {
  const navigate = useNavigate();
  const { refreshConnections, setActiveConnectionId } = useAppState();

  async function handleSave(connection: { id?: string }) {
    await refreshConnections();
    if (connection?.id) {
      setActiveConnectionId(connection.id);
    }
    navigate("/connections");
  }

  return (
    <div className="p-6 max-w-xl mx-auto">
      <div className="mb-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/connections")}
          className="text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 gap-1.5 -ml-2 mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <h2 className="text-lg font-semibold text-zinc-100">New Connection</h2>
        <p className="text-sm text-zinc-500 mt-0.5">
          Connect to a database to start chatting.
        </p>
      </div>

      <ConnectionForm onSave={handleSave} />
    </div>
  );
}
