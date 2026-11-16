import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Hash, X } from "lucide-react";
import { useToast } from "../context/ToastContext";
import { getApiError } from "../services/api";
import { roomService } from "../services/roomService";

export function ChannelModal({ open, roomId, channel, onClose, onSaved }) {
  const [name, setName] = useState("");
  const [topic, setTopic] = useState("");
  const [category, setCategory] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { notify } = useToast();

  useEffect(() => {
    if (!open) return;
    setName(channel?.name || "");
    setTopic(channel?.topic || "");
    setCategory(channel?.category || "");
  }, [open, channel]);

  useEffect(() => {
    if (!open) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === "Escape" && !submitting) onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose, submitting]);

  const submit = async (event) => {
    event.preventDefault();
    if (!roomId || !name.trim()) return;
    setSubmitting(true);
    try {
      const input = {
        name: name.trim(),
        topic: topic.trim(),
        category: category.trim() || null,
      };
      const saved = channel
        ? await roomService.updateChannel(channel.id, input)
        : await roomService.createChannel(roomId, input);
      notify(channel ? "Channel updated." : "Channel created.", "success");
      onSaved(saved);
    } catch (error) {
      notify(getApiError(error), "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !submitting) onClose();
          }}
        >
          <motion.section
            className="create-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="channel-modal-title"
            initial={{ opacity: 0, y: 14, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.18 }}
          >
            <div className="modal-top">
              <div className="modal-icon"><Hash size={20} /></div>
              <button type="button" className="icon-button modal-close" onClick={onClose} disabled={submitting} aria-label="Close dialog">
                <X size={18} />
              </button>
            </div>
            <h2 id="channel-modal-title">{channel ? "Edit channel" : "Create a channel"}</h2>
            <p className="modal-description">Give conversations a clear place to happen.</p>
            <form onSubmit={submit}>
              <label className="field-label" htmlFor="channel-name">Channel name</label>
              <div className="room-name-input">
                <Hash size={16} />
                <input
                  id="channel-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="e.g. announcements"
                  maxLength={80}
                  required
                />
              </div>
              <label className="field-label" htmlFor="channel-topic">Topic</label>
              <textarea id="channel-topic" value={topic} onChange={(event) => setTopic(event.target.value)} maxLength={500} placeholder="What is this channel for?" />
              <label className="field-label" htmlFor="channel-category">Category <span className="optional-label">optional</span></label>
              <input id="channel-category" value={category} onChange={(event) => setCategory(event.target.value)} maxLength={60} placeholder="Community" />
              <div className="modal-actions">
                <button type="button" className="button-outline" onClick={onClose} disabled={submitting}>Cancel</button>
                <button type="submit" className="button-primary" disabled={submitting || !name.trim()}>
                  {submitting ? <><span className="button-spinner" /> Saving…</> : channel ? "Save changes" : "Create channel"}
                </button>
              </div>
            </form>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
