import { useAppState } from "@/hooks/use-app-state";
import { ChatPanel } from "@/components/chat/chat-panel";

export default function ChatPage() {
  const { activeConnectionId } = useAppState();

  return (
    <div className="h-full">
      <ChatPanel connectionId={activeConnectionId ?? ""} />
    </div>
  );
}
