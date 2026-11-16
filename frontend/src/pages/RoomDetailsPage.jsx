import { useEffect, useState } from "react";
import { ArrowLeft, ArrowUpRight, Hash, LockKeyhole, MessageCircle, Share2, Users } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { InvitationSettingsModal } from "../components/InvitationSettingsModal";
import { RoomBrowserLayout } from "../components/RoomBrowserLayout";
import { RoomMembersList } from "../components/RoomMembersList";
import { ShareInvitationModal } from "../components/ShareInvitationModal";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { getApiError } from "../services/api";
import { roomService } from "../services/roomService";

export function RoomDetailsPage() {
  const { roomId } = useParams();
  const { user } = useAuth();
  const { notify } = useToast();
  const navigate = useNavigate();
  const [room, setRoom] = useState(null);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [membersLoading, setMembersLoading] = useState(false);
  const [joining, setJoining] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [shareInvitation, setShareInvitation] = useState(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    roomService.details(roomId)
      .then(async (details) => {
        if (!active) return;
        setRoom(details);
        if (details.is_member) {
          setMembersLoading(true);
          const roomMembers = await roomService.members(roomId);
          if (active) setMembers(roomMembers);
        }
      })
      .catch((error) => { if (active) notify(getApiError(error), "error"); })
      .finally(() => {
        if (active) {
          setLoading(false);
          setMembersLoading(false);
        }
      });
    return () => { active = false; };
  }, [roomId, notify]);

  const join = async () => {
    setJoining(true);
    try {
      await roomService.join(roomId);
      navigate(`/?roomId=${roomId}`);
    } catch (error) {
      notify(getApiError(error), "error");
    } finally {
      setJoining(false);
    }
  };

  const canManageInvitations = members.some(
    (member) => member.id === user?.id && ["owner", "moderator"].includes(member.role)
  );

  return (
    <RoomBrowserLayout>
      <div className="community-page room-details-page">
        <Link className="back-link" to="/discover"><ArrowLeft size={15} /> Back to discover</Link>
        {loading ? <div className="community-loading">Loading room details…</div> : room ? (
          <>
            <section className="room-hero-panel">
              <span className="room-hero-icon">{room.icon_url ? <img src={room.icon_url} alt="" /> : <Hash size={32} />}</span>
              <div className="room-hero-content">
                <span className={`room-visibility ${room.room_type}`} >{room.room_type === "public" ? <Users size={13} /> : <LockKeyhole size={13} />}{room.room_type}</span>
                <h1>{room.name}</h1>
                <p>{room.description || "A place for people to connect and share ideas."}</p>
                <div className="room-hero-meta">
                  <span><Users size={15} /> {room.member_count} {room.member_count === 1 ? "member" : "members"}</span>
                  {room.category && <span className="room-category-pill">{room.category}</span>}
                  <span>Owner <strong>{room.owner_username}</strong></span>
                </div>
              </div>
              <div className="room-hero-actions">
                {room.is_member ? (
                  <button type="button" className="button-primary" onClick={() => navigate(`/?roomId=${room.id}`)}><MessageCircle size={16} /> Open chat</button>
                ) : room.room_type === "public" ? (
                  <button type="button" className="button-primary" onClick={join} disabled={joining || (room.max_members !== null && room.member_count >= room.max_members)}>{joining ? "Joining…" : room.max_members !== null && room.member_count >= room.max_members ? "Room is full" : "Join room"} <ArrowUpRight size={15} /></button>
                ) : <span className="community-muted">Private rooms are invitation only.</span>}
                {canManageInvitations && <button type="button" className="button-outline" onClick={() => setSettingsOpen(true)}><Share2 size={15} /> Share invitation</button>}
              </div>
            </section>
            <div className="room-details-grid">
              <section className="room-panel room-about-panel">
                <h2>About this room</h2>
                <p>{room.description || "No description has been added yet."}</p>
                <div className="room-about-facts"><span>Created by <strong>{room.owner_username}</strong></span><span>{room.room_type === "public" ? "Anyone can discover and join" : "Invitation required to join"}</span></div>
              </section>
              {room.is_member && <RoomMembersList members={members} loading={membersLoading} />}
            </div>
          </>
        ) : <div className="discover-empty"><strong>Room unavailable</strong><span>It may have been removed or you may not have access.</span></div>}
      </div>
      {canManageInvitations && <InvitationSettingsModal roomId={roomId} open={settingsOpen} onClose={() => setSettingsOpen(false)} onShare={setShareInvitation} />}
      <ShareInvitationModal invitation={shareInvitation} onClose={() => setShareInvitation(null)} />
    </RoomBrowserLayout>
  );
}
