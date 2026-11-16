import { Hash, Info, Menu, Plus } from "lucide-react";
import { ConnectionStatus } from "./ConnectionStatus";

export function ChatHeader({ room, channel, status, onMenu, onCreateRoom }) {
  return (
    <header className="chat-header">
      <button className="icon-button mobile-menu-button" onClick={onMenu} aria-label="Open room navigation"><Menu size={19} /></button>
      {room ? (
        <div className="chat-room-title">
          <span className="header-room-icon"><Hash size={18} /></span>
          <div className="chat-room-copy">
            <h1>{channel ? `# ${channel.name}` : room.name}</h1>
            <p><span className="room-description-dot" /> {channel?.topic || room.name}</p>
          </div>
        </div>
      ) : (
        <div className="chat-room-title">
          <span className="header-room-icon"><Info size={18} /></span>
          <div className="chat-room-copy">
            <h1>Your conversations</h1>
            <p>Choose a room and pick up where you left off</p>
          </div>
        </div>
      )}
      <div className="header-actions">
        {room && <ConnectionStatus status={status} />}
        <button className="button-outline header-create-button" onClick={onCreateRoom}><Plus size={15} /> <span>New room</span></button>
      </div>
    </header>
  );
}
