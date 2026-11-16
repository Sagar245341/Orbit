import { useCallback, useEffect, useRef, useState } from "react";
import { MessageCircle, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ChannelModal } from "../components/ChannelModal";
import { ChatHeader } from "../components/ChatHeader";
import { CreateRoomModal } from "../components/CreateRoomModal";
import { MessageInput } from "../components/MessageInput";
import { MessageList } from "../components/MessageList";
import { ServerRail } from "../components/ServerRail";
import { Sidebar } from "../components/Sidebar";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { useToast } from "../context/ToastContext";
import { useWebSocket } from "../hooks/useWebSocket";
import { getApiError } from "../services/api";
import { roomService } from "../services/roomService";
import type { Channel, ChatMessage, Room } from "../types";

export function ChatDashboard() {
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const { notify } = useToast();
  const { theme, toggleTheme } = useTheme();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomsLoading, setRoomsLoading] = useState(true);
  const [activeRoom, setActiveRoom] = useState<Room | null>(null);
  const [pendingRoom, setPendingRoom] = useState<Room | null>(null);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [channelModalOpen, setChannelModalOpen] = useState(false);
  const [editingChannel, setEditingChannel] = useState<Channel | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const switchSequence = useRef(0);

  const addMessage = useCallback((message: ChatMessage) => {
    setMessages((current) => current.some((item) => item.id === message.id) ? current : [...current, message]);
  }, []);
  const showSocketError = useCallback((message: string) => notify(message, "error"), [notify]);
  const { status, send } = useWebSocket(activeChannel?.id, token, addMessage, showSocketError);

  const enterRoom = useCallback(async (room: Room) => {
    const sequence = ++switchSequence.current;
    setMobileOpen(false);
    setPendingRoom(room);
    setActiveRoom(null);
    setActiveChannel(null);
    setChannels([]);
    setMessages([]);
    setHistoryLoading(true);
    navigate(`/?roomId=${room.id}`, { replace: true });
    try {
      await roomService.join(room.id);
      const availableChannels = await roomService.channels(room.id);
      const firstChannel = availableChannels[0];
      if (!firstChannel) throw new Error("This room does not have an active channel.");
      const history = await roomService.channelMessages(firstChannel.id);
      if (sequence !== switchSequence.current) return;
      setChannels(availableChannels);
      setActiveChannel(firstChannel);
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
  }, [navigate, notify]);

  const selectChannel = async (channel: Channel) => {
    if (channel.id === activeChannel?.id) {
      setMobileOpen(false);
      return;
    }
    const sequence = ++switchSequence.current;
    setMobileOpen(false);
    setActiveChannel(null);
    setMessages([]);
    setHistoryLoading(true);
    try {
      const history = await roomService.channelMessages(channel.id);
      if (sequence !== switchSequence.current) return;
      setMessages(history);
      setActiveChannel(channel);
    } catch (error) {
      if (sequence === switchSequence.current) notify(getApiError(error), "error");
    } finally {
      if (sequence === switchSequence.current) setHistoryLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    roomService.list()
      .then((result) => {
        if (!active) return;
        setRooms(result);
        if (result.length) {
          const requestedId = new URLSearchParams(window.location.search).get("roomId");
          const requestedRoom = result.find((room) => String(room.id) === requestedId);
          void enterRoom(requestedRoom || result[0]);
        }
      })
      .catch((error: unknown) => {
        if (active) notify(getApiError(error), "error");
      })
      .finally(() => {
        if (active) setRoomsLoading(false);
      });
    return () => { active = false; };
  }, [enterRoom, notify]);

  const handleRoomCreated = async (room: Room) => {
    setCreateOpen(false);
    setRooms((current) => [room, ...current.filter((item) => item.id !== room.id)]);
    await enterRoom(room);
  };

  const handleChannelSaved = async (channel: Channel) => {
    const isNew = !editingChannel;
    setChannels((current) => {
      const updated = current.filter((item) => item.id !== channel.id);
      return [...updated, channel].sort((first, second) => first.position - second.position);
    });
    setEditingChannel(null);
    setChannelModalOpen(false);
    if (isNew) {
      await selectChannel(channel);
    } else if (activeChannel?.id === channel.id) {
      setActiveChannel(channel);
    }
  };

  const handleChannelArchived = async (channel: Channel) => {
    if (!window.confirm(`Archive #${channel.name}? Its message history will be retained.`)) return;
    try {
      await roomService.archiveChannel(channel.id);
      const remainingChannels = channels.filter((item) => item.id !== channel.id);
      setChannels(remainingChannels);
      if (activeChannel?.id === channel.id && remainingChannels[0]) {
        await selectChannel(remainingChannels[0]);
      }
      notify(`#${channel.name} was archived.`, "success");
    } catch (error) {
      notify(getApiError(error), "error");
    }
  };

  const openChannelModal = (channel: Channel | null = null) => {
    setEditingChannel(channel);
    setChannelModalOpen(true);
  };

  return (
    <main className="chat-app-shell">
      <ServerRail
        rooms={rooms}
        activeRoom={activeRoom || pendingRoom}
        onSelectRoom={enterRoom}
        onCreateRoom={() => setCreateOpen(true)}
        isLoading={roomsLoading}
      />
      <Sidebar
        rooms={rooms}
        activeRoom={activeRoom}
        pendingRoom={pendingRoom}
        onSelectRoom={enterRoom}
        channels={channels}
        activeChannel={activeChannel}
        onSelectChannel={selectChannel}
        onCreateChannel={() => openChannelModal()}
        onEditChannel={(channel: Channel) => openChannelModal(channel)}
        onArchiveChannel={handleChannelArchived}
        onCreateRoom={() => setCreateOpen(true)}
        onSettings={toggleTheme}
        theme={theme}
        isLoading={roomsLoading}
        mobileOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
      />
      <section className="chat-main">
        <ChatHeader
          room={activeRoom || pendingRoom}
          channel={activeChannel}
          status={status}
          onMenu={() => setMobileOpen(true)}
          onCreateRoom={() => setCreateOpen(true)}
        />
        <div className="chat-content">
          <MessageList
            messages={messages}
            currentUserId={user?.id}
            loading={historyLoading}
            room={activeChannel || activeRoom || pendingRoom}
          />
          <MessageInput connected={status === "connected" && Boolean(activeChannel)} onSend={send} />
        </div>
        <div className="chat-watermark" aria-hidden="true"><span><Sparkles size={13} /></span> A little more in sync</div>
      </section>
      <CreateRoomModal open={createOpen} onClose={() => setCreateOpen(false)} onCreated={handleRoomCreated} />
      <ChannelModal
        open={channelModalOpen}
        roomId={(activeRoom || pendingRoom)?.id}
        channel={editingChannel}
        onClose={() => { setChannelModalOpen(false); setEditingChannel(null); }}
        onSaved={handleChannelSaved}
      />
      <div className="chat-mobile-brand"><span className="brand-mark brand-mark-small"><span /></span><span>orbit</span></div>
      {rooms.length === 0 && !roomsLoading && <div className="sr-only" aria-live="polite">No rooms available. Create a room to begin.</div>}
      <span className="sr-only"><MessageCircle /> {rooms.length} available rooms</span>
    </main>
  );
}
