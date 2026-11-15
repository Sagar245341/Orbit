import { useCallback, useEffect, useRef, useState } from "react";
import { MessageCircle, Sparkles } from "lucide-react";
import { Sidebar } from "../components/Sidebar";
import { ChatHeader } from "../components/ChatHeader";
import { MessageList } from "../components/MessageList";
import { MessageInput } from "../components/MessageInput";
import { CreateRoomModal } from "../components/CreateRoomModal";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { useTheme } from "../context/ThemeContext";
import { useWebSocket } from "../hooks/useWebSocket";
import { roomService } from "../services/roomService";
import { getApiError } from "../services/api";

export function ChatDashboard() {
  const { user, token } = useAuth();
  const { notify } = useToast();
  const { theme, toggleTheme } = useTheme();
  const [rooms, setRooms] = useState([]);
  const [roomsLoading, setRoomsLoading] = useState(true);
  const [activeRoom, setActiveRoom] = useState(null);
  const [pendingRoom, setPendingRoom] = useState(null);
  const [messages, setMessages] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const switchSequence = useRef(0);

  const addMessage = useCallback((message) => {
    setMessages((current) => current.some((item) => item.id === message.id) ? current : [...current, message]);
  }, []);
  const showSocketError = useCallback((message) => notify(message, "error"), [notify]);
  const { status, send } = useWebSocket(activeRoom?.id, token, addMessage, showSocketError);

  const enterRoom = useCallback(async (room) => {
    const sequence = ++switchSequence.current;
    setMobileOpen(false);
    setPendingRoom(room);
    setActiveRoom(null);
    setMessages([]);
    setHistoryLoading(true);
    try {
      await roomService.join(room.id);
      const history = await roomService.messages(room.id);
      if (sequence !== switchSequence.current) return;
      setMessages(history);
      setActiveRoom(room);
    } catch (error) {
      if (sequence === switchSequence.current) notify(getApiError(error), "error");
    } finally {
      if (sequence === switchSequence.current) {
        setPendingRoom(null);
        setHistoryLoading(false);
      }
    }
  }, [notify]);

  useEffect(() => {
    let active = true;
    roomService.list()
      .then((result) => {
        if (!active) return;
        setRooms(result);
        if (result.length) enterRoom(result[0]);
      })
      .catch((error) => {
        if (active) notify(getApiError(error), "error");
      })
      .finally(() => {
        if (active) setRoomsLoading(false);
      });
    return () => { active = false; };
  }, [enterRoom, notify]);

  const handleRoomCreated = async (room) => {
    setCreateOpen(false);
    setRooms((current) => [room, ...current.filter((item) => item.id !== room.id)]);
    await enterRoom(room);
  };

  return (
    <main className="chat-app-shell">
      <Sidebar
        rooms={rooms}
        activeRoom={activeRoom}
        pendingRoom={pendingRoom}
        onSelectRoom={enterRoom}
        onCreateRoom={() => setCreateOpen(true)}
        onSettings={toggleTheme}
        theme={theme}
        isLoading={roomsLoading}
        mobileOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
      />
      <section className="chat-main">
        <ChatHeader room={activeRoom || pendingRoom} status={status} onMenu={() => setMobileOpen(true)} onCreateRoom={() => setCreateOpen(true)} />
        <div className="chat-content">
          <MessageList messages={messages} currentUserId={user?.id} loading={historyLoading} room={activeRoom || pendingRoom} />
          <MessageInput connected={status === "connected" && Boolean(activeRoom)} onSend={send} />
        </div>
        <div className="chat-watermark" aria-hidden="true"><span><Sparkles size={13} /></span> A little more in sync</div>
      </section>
      <CreateRoomModal open={createOpen} onClose={() => setCreateOpen(false)} onCreated={handleRoomCreated} />
      <div className="chat-mobile-brand"><span className="brand-mark brand-mark-small"><span /></span><span>orbit</span></div>
      {rooms.length === 0 && !roomsLoading && <div className="sr-only" aria-live="polite">No rooms available. Create a room to begin.</div>}
      <span className="sr-only"><MessageCircle /> {rooms.length} available rooms</span>
    </main>
  );
}
