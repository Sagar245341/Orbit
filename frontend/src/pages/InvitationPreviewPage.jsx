import { useEffect, useState } from "react";
import { Hash, Link2, LockKeyhole, Users } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { getApiError } from "../services/api";
import { roomService } from "../services/roomService";

export function InvitationPreviewPage() {
  const { inviteCode } = useParams();
  const { user } = useAuth();
  const { notify } = useToast();
  const navigate = useNavigate();
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    roomService.previewInvitation(inviteCode)
      .then((result) => { if (active) setPreview(result); })
      .catch((requestError) => { if (active) setError(getApiError(requestError)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [inviteCode]);

  const returnTo = `/invite/${encodeURIComponent(inviteCode)}`;
  const accept = async () => {
    if (!user) {
      navigate(`/login?returnTo=${encodeURIComponent(returnTo)}`);
      return;
    }
    setAccepting(true);
    try {
      const result = await roomService.acceptInvitation(inviteCode);
      notify(result.already_member ? "You’re already a member of this room." : "You joined the room.", "success");
      navigate(`/?roomId=${result.room_id}`, { replace: true });
    } catch (requestError) {
      setError(getApiError(requestError));
      notify(getApiError(requestError), "error");
    } finally {
      setAccepting(false);
    }
  };

  return (
    <main className="invite-page">
      <div className="invite-glow invite-glow-one" /><div className="invite-glow invite-glow-two" />
      <Link to="/login" className="brand-lockup invite-brand"><span className="brand-mark"><span /></span><span className="brand-name">orbit<span>.</span></span></Link>
      <section className="invite-card">
        {loading ? <div className="community-loading">Checking your invitation…</div> : error ? (
          <div className="invite-unavailable">
            <span className="invite-icon"><Link2 size={25} /></span>
            <h1>Invitation unavailable</h1>
            <p>{error}</p>
            <Link to={user ? "/discover" : "/login"} className="button-outline">{user ? "Discover public rooms" : "Go to sign in"}</Link>
          </div>
        ) : preview && (
          <>
            <span className="invite-eyebrow">You’ve been invited to join</span>
            <span className="invite-room-icon">{preview.room.icon_url ? <img src={preview.room.icon_url} alt="" /> : <Hash size={34} />}</span>
            <h1>{preview.room.name}</h1>
            <p className="invite-description">{preview.room.description || "A place for people to connect and share ideas."}</p>
            <div className="invite-room-meta">
              <span><Users size={16} /> {preview.room.member_count} {preview.room.member_count === 1 ? "member" : "members"}</span>
              {preview.room.category && <span>{preview.room.category}</span>}
              {preview.room.room_type === "private" && <span><LockKeyhole size={14} /> Private</span>}
            </div>
            <p className="invite-from">Invitation from <strong>{preview.inviter_username}</strong></p>
            <button type="button" className="button-primary invite-accept-button" onClick={accept} disabled={accepting}>
              {accepting ? <><span className="button-spinner" /> Joining…</> : user ? "Accept invitation & join room" : "Sign in to accept invitation"}
            </button>
            {!user && <p className="invite-auth-links">New to Orbit? <Link to={`/register?returnTo=${encodeURIComponent(returnTo)}`}>Create an account</Link></p>}
          </>
        )}
      </section>
      <p className="invite-footer"><Users size={14} /> Join a community and pick up the conversation.</p>
    </main>
  );
}
