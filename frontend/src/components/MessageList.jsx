import { useEffect, useRef } from "react";
import { MessageCircle, Sparkles } from "lucide-react";
import { MessageBubble } from "./MessageBubble";
import { formatDay } from "../utils/formatDate";

function isSameDay(first, second) {
  const left = new Date(first);
  const right = new Date(second);
  return left.getFullYear() === right.getFullYear()
    && left.getMonth() === right.getMonth()
    && left.getDate() === right.getDate();
}

export function MessageList({ messages, currentUserId, loading, room }) {
  const bottomRef = useRef(null);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, loading]);

  if (!room) {
    return (
      <div className="welcome-state">
        <div className="welcome-illustration">
          <span className="welcome-orbit welcome-orbit-one" />
          <span className="welcome-orbit welcome-orbit-two" />
          <span className="welcome-chat-icon"><MessageCircle size={27} /></span>
          <span className="welcome-sparkle"><Sparkles size={16} /></span>
        </div>
        <span className="eyebrow">WELCOME TO ORBIT</span>
        <h2>Make room for good ideas.</h2>
        <p>Pick a room from the sidebar to catch up, or create one and bring everyone in.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="messages-loading" role="status" aria-label="Loading message history">
        {[0, 1, 2, 3].map((item) => <div className={`message-loading-line message-loading-${item}`} key={item} />)}
      </div>
    );
  }

  return (
    <div className="message-list" aria-label={`Messages in ${room.name}`}>
      {messages.length === 0 ? (
        <div className="room-empty-state">
          <div className="empty-room-icon"><MessageCircle size={23} /></div>
          <h2>It’s quiet in here.</h2>
          <p>Be the first to say hello in <strong>#{room.name}</strong>.</p>
        </div>
      ) : (
        <>
          <div className="history-start"><span /> You’re all caught up <span /></div>
          {messages.map((message, index) => {
            const previous = messages[index - 1];
            const dayChanged = !previous || !isSameDay(previous.created_at, message.created_at);
            const grouped = previous
              && previous.sender_id === message.sender_id
              && !dayChanged
              && new Date(message.created_at) - new Date(previous.created_at) < 5 * 60 * 1000;
            return (
              <div key={message.id}>
                {dayChanged && <div className="date-divider"><span>{formatDay(message.created_at)}</span></div>}
                <MessageBubble message={message} mine={message.sender_id === currentUserId} showSender={!grouped} />
              </div>
            );
          })}
        </>
      )}
      <div ref={bottomRef} />
    </div>
  );
}
