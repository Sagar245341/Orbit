import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Menu } from "lucide-react";
import { Sidebar } from "./Sidebar";
import { ServerRail } from "./ServerRail";
import { CreateRoomModal } from "./CreateRoomModal";
import { useTheme } from "../context/ThemeContext";
import { useToast } from "../context/ToastContext";
import { roomService } from "../services/roomService";
import { getApiError } from "../services/api";

export function RoomBrowserLayout({ children }) {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const { notify } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;
    roomService.list()
      .then((result) => { if (active) setRooms(result); })
      .catch((error) => { if (active) notify(getApiError(error), "error"); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [notify]);

  const handleCreated = (room) => {
    setCreateOpen(false);
    setRooms((current) => [room, ...current.filter((item) => item.id !== room.id)]);
    navigate(`/?roomId=${room.id}`);
  };

  return (
    <main className="chat-app-shell">
      <ServerRail
        rooms={rooms}
        onSelectRoom={(room) => navigate(`/?roomId=${room.id}`)}
        onCreateRoom={() => setCreateOpen(true)}
        isLoading={loading}
      />
      <Sidebar
        rooms={rooms}
        onSelectRoom={(room) => navigate(`/?roomId=${room.id}`)}
        onCreateRoom={() => setCreateOpen(true)}
        onSettings={toggleTheme}
        theme={theme}
        isLoading={loading}
        mobileOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
      />
      <section className="community-main">
        <header className="community-topbar">
          <button type="button" className="mobile-menu-button" onClick={() => setMobileOpen(true)} aria-label="Open room navigation"><Menu size={18} /></button>
          <span className="workspace-pill"><span className="workspace-dot" /> Orbit communities</span>
        </header>
        {children}
      </section>
      <CreateRoomModal open={createOpen} onClose={() => setCreateOpen(false)} onCreated={handleCreated} />
    </main>
  );
}
