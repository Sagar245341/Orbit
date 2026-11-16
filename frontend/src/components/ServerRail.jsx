import { Compass, Hash, Home, Plus } from "lucide-react";
import { Link, useLocation } from "react-router-dom";

export function ServerRail({ rooms, activeRoom, onSelectRoom, onCreateRoom, isLoading }) {
  const location = useLocation();
  const discoverActive = location.pathname === "/discover" || location.pathname.startsWith("/rooms/");

  return (
    <aside className="server-rail" aria-label="Orbit navigation">
      <Link to="/" className="server-rail-brand" aria-label="Orbit home" title="Orbit home">
        <span className="brand-mark brand-mark-small"><span /></span>
      </Link>
      <span className="server-rail-divider" />
      <nav className="server-rail-primary" aria-label="Main navigation">
        <Link to="/" className={`server-rail-link ${location.pathname === "/" ? "server-rail-link-active" : ""}`} aria-label="My rooms" title="My rooms">
          <Home size={19} />
        </Link>
        <Link to="/discover" className={`server-rail-link ${discoverActive ? "server-rail-link-active" : ""}`} aria-label="Discover rooms" title="Discover rooms">
          <Compass size={19} />
        </Link>
      </nav>
      <span className="server-rail-divider" />
      <nav className="server-rail-rooms" aria-label="Room shortcuts">
        {isLoading
          ? [0, 1, 2].map((item) => <span className="server-rail-skeleton" key={item} />)
          : rooms.slice(0, 24).map((room) => {
            const selected = activeRoom?.id === room.id && location.pathname === "/";
            return (
              <button
                type="button"
                key={room.id}
                className={`server-rail-room ${selected ? "server-rail-room-active" : ""}`}
                title={room.name}
                aria-label={`Open ${room.name}`}
                aria-current={selected ? "page" : undefined}
                onClick={() => onSelectRoom(room)}
              >
                {room.icon_url ? <img src={room.icon_url} alt="" /> : <Hash size={20} />}
              </button>
            );
          })}
        <button type="button" className="server-rail-room server-rail-create" onClick={onCreateRoom} aria-label="Create a room" title="Create a room">
          <Plus size={20} />
        </button>
      </nav>
    </aside>
  );
}
