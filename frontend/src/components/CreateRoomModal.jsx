import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Hash, X } from "lucide-react";
import { roomService } from "../services/roomService";
import { getApiError } from "../services/api";
import { useToast } from "../context/ToastContext";

export function CreateRoomModal({ open, onClose, onCreated }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [iconUrl, setIconUrl] = useState("");
  const [roomType, setRoomType] = useState("public");
  const [category, setCategory] = useState("");
  const [maxMembers, setMaxMembers] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef(null);
  const { notify } = useToast();

  useEffect(() => {
    if (!open) return undefined;
    inputRef.current?.focus();
    const handleKeyDown = (event) => {
      if (event.key === "Escape" && !submitting) onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose, submitting]);

  const close = () => {
    setName("");
    setDescription("");
    setIconUrl("");
    setRoomType("public");
    setCategory("");
    setMaxMembers("");
    onClose();
  };

  const submit = async (event) => {
    event.preventDefault();
    const roomName = name.trim();
    if (roomName.length < 2) {
      notify("Room names need at least 2 characters.", "error");
      return;
    }
    setSubmitting(true);
    try {
      const room = await roomService.create({
        name: roomName,
        description: description.trim(),
        icon_url: iconUrl.trim() || null,
        room_type: roomType,
        category: category.trim() || null,
        max_members: maxMembers ? Number(maxMembers) : null,
      });
      notify(`“${room.name}” is ready.`, "success");
      setName("");
      setDescription("");
      setIconUrl("");
      setRoomType("public");
      setCategory("");
      setMaxMembers("");
      onCreated(room);
    } catch (error) {
      notify(getApiError(error), "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(event) => {
          if (event.target === event.currentTarget && !submitting) close();
        }}>
          <motion.section
            className="create-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-room-title"
            initial={{ opacity: 0, y: 14, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.18 }}
          >
            <div className="modal-top">
              <div className="modal-icon"><Hash size={20} /></div>
              <button type="button" className="icon-button modal-close" onClick={close} disabled={submitting} aria-label="Close dialog"><X size={18} /></button>
            </div>
            <h2 id="create-room-title">Create a room</h2>
            <p className="modal-description">Give your next great conversation a home.</p>
            <form onSubmit={submit}>
              <label className="field-label" htmlFor="room-name">Room name</label>
              <div className="room-name-input">
                <Hash size={16} />
                <input
                  ref={inputRef}
                  id="room-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="e.g. product-team"
                  minLength={2}
                  maxLength={80}
                  required
                />
              </div>
              <span className="field-hint">Choose a name that’s easy for your team to find.</span>
              <label className="field-label" htmlFor="room-description">Description</label>
              <textarea id="room-description" value={description} onChange={(event) => setDescription(event.target.value)} maxLength={1000} placeholder="What will your community talk about?" />
              <label className="field-label" htmlFor="room-icon">Icon image URL <span className="optional-label">optional</span></label>
              <input id="room-icon" value={iconUrl} onChange={(event) => setIconUrl(event.target.value)} maxLength={500} placeholder="https://example.com/icon.png" />
              <div className="form-grid-two">
                <div>
                  <label className="field-label" htmlFor="room-type">Room type</label>
                  <select id="room-type" value={roomType} onChange={(event) => setRoomType(event.target.value)}>
                    <option value="public">Public — discoverable</option>
                    <option value="private">Private — invitation only</option>
                  </select>
                </div>
                <div>
                  <label className="field-label" htmlFor="room-category">Category <span className="optional-label">optional</span></label>
                  <input id="room-category" value={category} onChange={(event) => setCategory(event.target.value)} maxLength={60} placeholder="Technology" />
                </div>
              </div>
              <label className="field-label" htmlFor="room-limit">Maximum members <span className="optional-label">optional</span></label>
              <input id="room-limit" type="number" min="1" max="10000" value={maxMembers} onChange={(event) => setMaxMembers(event.target.value)} placeholder="No limit" />
              <div className="modal-actions">
                <button type="button" className="button-outline" onClick={close} disabled={submitting}>Cancel</button>
                <button type="submit" className="button-primary" disabled={submitting || name.trim().length < 2}>
                  {submitting ? <><span className="button-spinner" /> Creating…</> : "Create room"}
                </button>
              </div>
            </form>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
