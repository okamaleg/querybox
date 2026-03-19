import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAppState } from "@/hooks/use-app-state";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";

const PAGE_TITLES: Record<string, string> = {
  "/chat": "Chat",
  "/connections": "Connections",
  "/connections/new": "New Connection",
  "/settings": "Settings",
};

export default function AppLayout() {
  const { connections, activeConnectionId, setActiveConnectionId, settings } = useAppState();
  const { pathname } = useLocation();
  const navigate = useNavigate();

  const title = PAGE_TITLES[pathname] ?? "Querybox";

  const activeConnection = connections.find((c) => c.id === activeConnectionId);

  function handleSelectConnection(id: string) {
    setActiveConnectionId(id);
    navigate("/chat");
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-zinc-950">
      <Sidebar
        connections={connections}
        activeConnectionId={activeConnectionId}
        onSelectConnection={handleSelectConnection}
      />
      <div className="flex flex-1 flex-col min-w-0">
        <Header
          title={title}
          connected={!!activeConnectionId}
          activeConnectionName={activeConnection?.name}
          safetyMode={settings.safety_mode}
        />
        <main className="flex-1 min-h-0 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
