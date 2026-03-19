import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AppStateProvider } from "@/hooks/use-app-state";
import AppLayout from "@/app-layout";
import ConnectionsPage from "@/pages/connections";
import ConnectionsNewPage from "@/pages/connections-new";
import ChatPage from "@/pages/chat";
import SettingsPage from "@/pages/settings";

export default function App() {
  return (
    <AppStateProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<Navigate to="/connections" replace />} />
            <Route path="/connections" element={<ConnectionsPage />} />
            <Route path="/connections/new" element={<ConnectionsNewPage />} />
            <Route path="/chat" element={<ChatPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AppStateProvider>
  );
}
