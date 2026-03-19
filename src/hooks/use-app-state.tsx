import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";

interface Connection {
  id: string;
  name: string;
  type: "postgresql" | "mysql" | "sqlite" | "mongodb";
  created_at: string;
  updated_at: string;
}

interface Settings {
  has_api_key: boolean;
  safety_mode: boolean;
  theme: string;
}

interface AppState {
  connections: Connection[];
  activeConnectionId: string | null;
  settings: Settings;
  isLoading: boolean;
  setActiveConnectionId: (id: string | null) => void;
  refreshConnections: () => Promise<void>;
  refreshSettings: () => Promise<void>;
  updateSettings: (updates: Record<string, unknown>) => Promise<void>;
}

const AppStateContext = createContext<AppState | null>(null);

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [activeConnectionId, setActiveConnectionId] = useState<string | null>(
    null
  );
  const [settings, setSettings] = useState<Settings>({
    has_api_key: false,
    safety_mode: true,
    theme: "dark",
  });
  const [isLoading, setIsLoading] = useState(true);

  const refreshConnections = useCallback(async () => {
    try {
      const res = await fetch("/api/connections");
      const data = await res.json();
      setConnections(data);
    } catch (e) {
      console.error("Failed to fetch connections:", e);
    }
  }, []);

  const refreshSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/settings");
      const data = await res.json();
      setSettings(data);
    } catch (e) {
      console.error("Failed to fetch settings:", e);
    }
  }, []);

  const updateSettings = useCallback(
    async (updates: Record<string, unknown>) => {
      try {
        const res = await fetch("/api/settings", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updates),
        });
        const data = await res.json();
        setSettings(data);
      } catch (e) {
        console.error("Failed to update settings:", e);
      }
    },
    []
  );

  useEffect(() => {
    Promise.all([refreshConnections(), refreshSettings()]).finally(() =>
      setIsLoading(false)
    );
  }, [refreshConnections, refreshSettings]);

  return (
    <AppStateContext.Provider
      value={{
        connections,
        activeConnectionId,
        settings,
        isLoading,
        setActiveConnectionId,
        refreshConnections,
        refreshSettings,
        updateSettings,
      }}
    >
      {children}
    </AppStateContext.Provider>
  );
}

export function useAppState() {
  const ctx = useContext(AppStateContext);
  if (!ctx) {
    throw new Error("useAppState must be used within AppStateProvider");
  }
  return ctx;
}
