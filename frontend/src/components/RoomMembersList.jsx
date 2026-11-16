import { Crown, Shield, Users } from "lucide-react";

export function RoomMembersList({ members, loading }) {
  return (
    <section className="room-panel">
      <div className="room-panel-heading"><h2>Members</h2><span><Users size={14} /> {loading ? "…" : members.length}</span></div>
      {loading ? <p className="community-muted">Loading members…</p> : (
        <ul className="room-members-list">
          {members.map((member) => (
            <li key={member.id}>
              <span className="member-avatar">{member.username.slice(0, 1).toUpperCase()}</span>
              <span className="member-name">{member.username}</span>
              {member.role === "owner" ? <span className="member-role"><Crown size={13} /> Owner</span> : member.role === "moderator" ? <span className="member-role"><Shield size={13} /> Moderator</span> : null}
            </li>
          ))}
          {!members.length && <li className="community-muted">No members found.</li>}
        </ul>
      )}
    </section>
  );
}
