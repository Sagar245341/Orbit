import { ArrowUpRight, Hash, Users } from "lucide-react";
import { Link } from "react-router-dom";

export function RoomCard({ room, onJoin, joining = false }) {
  return (
    <article className="room-card">
      <Link to={`/rooms/${room.id}`} className="room-card-main">
        <span className="room-card-icon">
          {room.icon_url ? <img src={room.icon_url} alt="" loading="lazy" /> : <Hash size={24} />}
        </span>
        <span className="room-card-title-row">
          <strong>{room.name}</strong>
          <ArrowUpRight size={15} />
        </span>
        <span className="room-card-description">{room.description || "A new space for people to connect and share ideas."}</span>
        <span className="room-card-meta">
          <span><Users size={14} /> {room.member_count} {room.member_count === 1 ? "member" : "members"}</span>
          {room.category && <span className="room-category-pill">{room.category}</span>}
        </span>
      </Link>
      {room.is_member ? (
        <Link className="button-outline room-card-action" to={`/?roomId=${room.id}`}>Open chat</Link>
      ) : (
        <button type="button" className="button-primary room-card-action" onClick={() => onJoin(room)} disabled={joining || (room.max_members !== null && room.member_count >= room.max_members)}>
          {joining ? "Joining…" : room.max_members !== null && room.member_count >= room.max_members ? "Full" : "Join room"}
        </button>
      )}
    </article>
  );
}
