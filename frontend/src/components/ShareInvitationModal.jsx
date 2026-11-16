import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Copy, Share2, X } from "lucide-react";
import { useToast } from "../context/ToastContext";

export function ShareInvitationModal({ invitation, onClose }) {
  const [copied, setCopied] = useState(false);
  const { notify } = useToast();
  if (!invitation) return null;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(invitation.invite_url);
      setCopied(true);
      notify("Invitation link copied.", "success");
    } catch {
      notify("Could not copy the invitation link. Copy it from the field instead.", "error");
    }
  };

  const shareLink = async () => {
    if (!navigator.share) return copyLink();
    try {
      await navigator.share({ title: "Join my Orbit room", url: invitation.invite_url });
    } catch (error) {
      if (error?.name !== "AbortError") notify("Could not share this invitation.", "error");
    }
  };

  return (
    <AnimatePresence>
      <motion.div className="modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
        <motion.section className="create-modal share-modal" role="dialog" aria-modal="true" aria-labelledby="share-invite-title" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}>
          <div className="modal-top">
            <div className="modal-icon"><Share2 size={20} /></div>
            <button type="button" className="icon-button modal-close" onClick={onClose} aria-label="Close dialog"><X size={18} /></button>
          </div>
          <h2 id="share-invite-title">Share an invitation</h2>
          <p className="modal-description">Anyone with this link can join while it remains active.</p>
          <label className="field-label" htmlFor="invite-link">Invitation link</label>
          <input id="invite-link" readOnly value={invitation.invite_url} onFocus={(event) => event.target.select()} />
          <div className="modal-actions">
            <button type="button" className="button-outline" onClick={shareLink}><Share2 size={15} /> Share</button>
            <button type="button" className="button-primary" onClick={copyLink}>{copied ? <Check size={15} /> : <Copy size={15} />}{copied ? "Copied" : "Copy link"}</button>
          </div>
        </motion.section>
      </motion.div>
    </AnimatePresence>
  );
}
