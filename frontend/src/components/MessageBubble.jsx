import { motion } from "framer-motion";
import { formatTime } from "../utils/formatDate";

export function MessageBubble({ message, mine, showSender }) {
  return (
    <motion.article
      className={`message-row ${mine ? "message-row-mine" : ""}`}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
    >
      {!mine && <span className="message-avatar">{(message.sender_username || "U").slice(0, 1).toUpperCase()}</span>}
      <div className="message-body">
        {showSender && <div className="message-sender">{message.sender_username || "Member"} <time>{formatTime(message.created_at)}</time></div>}
        <div className={`message-bubble ${mine ? "message-bubble-mine" : ""}`}>{message.content}</div>
        {!showSender && <time className="message-time">{formatTime(message.created_at)}</time>}
      </div>
    </motion.article>
  );
}
