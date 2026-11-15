import { useState } from "react";
import { LogOut, Moon, Sun, ChevronUp } from "lucide-react";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";

function initials(name = "You") {
  return name.slice(0, 2).toUpperCase();
}

export function UserProfile() {
  const [open, setOpen] = useState(false);
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const username = user?.username || "Member";

  const handleLogout = () => {
    if (window.confirm("Log out of Orbit on this device?")) logout();
  };

  return (
    <div className="profile-wrap">
      {open && (
        <div className="profile-menu" role="menu">
          <div className="profile-menu-heading">
            <span className="avatar avatar-small">{initials(username)}</span>
            <span><strong>{username}</strong><small>{user?.email}</small></span>
          </div>
          <button role="menuitem" onClick={() => { toggleTheme(); setOpen(false); }}>
            {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
            Switch to {theme === "dark" ? "light" : "dark"} theme
          </button>
          <button role="menuitem" className="danger-menu-item" onClick={handleLogout}>
            <LogOut size={16} /> Log out
          </button>
        </div>
      )}
      <button className={`profile-trigger ${open ? "profile-trigger-open" : ""}`} onClick={() => setOpen((value) => !value)} aria-expanded={open}>
        <span className="avatar">{initials(username)}</span>
        <span className="profile-copy"><strong>{username}</strong><small>My account</small></span>
        <ChevronUp className={`profile-chevron ${open ? "" : "profile-chevron-down"}`} size={15} />
      </button>
    </div>
  );
}
