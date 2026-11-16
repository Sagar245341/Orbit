import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Copy, Link2, Plus, X } from "lucide-react";
import { roomService } from "../services/roomService";
import { getApiError } from "../services/api";
import { useToast } from "../context/ToastContext";

function isUsable(invitation) {
  return invitation.is_active &&
    (!invitation.expires_at || new Date(invitation.expires_at) > new Date()) &&
    (invitation.max_uses === null || invitation.used_count < invitation.max_uses);
}

export function InvitationSettingsModal({ roomId, open, onClose, onShare }) {
  const [invitations, setInvitations] = useState([]);
  const [expiration, setExpiration] = useState("never");
  const [maxUses, setMaxUses] = useState("");
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const { notify } = useToast();

  useEffect(() => {
    if (!open) return undefined;
    let active = true;
    setLoading(true);
    roomService.invitations(roomId)
      .then((result) => { if (active) setInvitations(result); })
      .catch((error) => { if (active) notify(getApiError(error), "error"); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [open, roomId, notify]);

  const create = async (event) => {
    event.preventDefault();
    setCreating(true);
    try {
      const invitation = await roomService.createInvitation(roomId, {
        expiration,
        max_uses: maxUses ? Number(maxUses) : null,
      });
      setInvitations((current) => [invitation, ...current]);
      onShare(invitation);
    } catch (error) {
      notify(getApiError(error), "error");
    } finally {
      setCreating(false);
    }
  };

  const revoke = async (invitation) => {
    try {
      await roomService.revokeInvitation(invitation.id);
      setInvitations((current) => current.map((item) => item.id === invitation.id ? { ...item, is_active: false } : item));
      notify("Invitation revoked.", "success");
    } catch (error) {
      notify(getApiError(error), "error");
    }
  };

  const copy = async (invitation) => {
    try {
      await navigator.clipboard.writeText(invitation.invite_url);
      notify("Invitation link copied.", "success");
    } catch {
      notify("Could not copy the invitation link.", "error");
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
          <motion.section className="create-modal invitation-settings-modal" role="dialog" aria-modal="true" aria-labelledby="invitation-settings-title" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}>
            <div className="modal-top">
              <div className="modal-icon"><Link2 size={20} /></div>
              <button type="button" className="icon-button modal-close" onClick={onClose} aria-label="Close dialog"><X size={18} /></button>
            </div>
            <h2 id="invitation-settings-title">Room invitations</h2>
            <p className="modal-description">Create links and manage access to this room.</p>
            <form className="invite-create-form" onSubmit={create}>
              <label className="field-label" htmlFor="invite-expiry">Expires</label>
              <select id="invite-expiry" value={expiration} onChange={(event) => setExpiration(event.target.value)}>
                <option value="never">Never</option><option value="1h">In 1 hour</option><option value="24h">In 24 hours</option><option value="7d">In 7 days</option>
              </select>
              <label className="field-label" htmlFor="invite-uses">Maximum uses</label>
              <select id="invite-uses" value={maxUses} onChange={(event) => setMaxUses(event.target.value)}>
                <option value="">Unlimited</option><option value="1">1 use</option><option value="5">5 uses</option><option value="10">10 uses</option>
              </select>
              <button type="submit" className="button-primary" disabled={creating}>{creating ? "Creating…" : <><Plus size={15} /> Create invitation</>}</button>
            </form>
            <div className="invite-list-heading"><span>Existing links</span>{loading && <span>Loading…</span>}</div>
            <ul className="invite-list">
              {invitations.map((invitation) => (
                <li key={invitation.id}>
                  <div className="invite-list-copy">
                    <strong>{isUsable(invitation) ? "Active link" : invitation.is_active ? "Expired or used up" : "Revoked"}</strong>
                    <span>{invitation.used_count}{invitation.max_uses === null ? " uses" : ` / ${invitation.max_uses} uses`} · {invitation.expires_at ? new Date(invitation.expires_at).toLocaleString() : "Never expires"}</span>
                  </div>
                  <div className="invite-list-actions">
                    {isUsable(invitation) && <button type="button" className="icon-button" onClick={() => onShare(invitation)} aria-label="Share invitation"><Link2 size={15} /></button>}
                    {isUsable(invitation) && <button type="button" className="icon-button" onClick={() => copy(invitation)} aria-label="Copy invitation link"><Copy size={15} /></button>}
                    {invitation.is_active && <button type="button" className="text-button text-button-danger" onClick={() => revoke(invitation)}>Revoke</button>}
                  </div>
                </li>
              ))}
              {!loading && invitations.length === 0 && <li className="community-muted">No invitation links yet.</li>}
            </ul>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
