import { useMemo, useState } from "react";
import { Hash, Plus, Search, Settings2, X } from "lucide-react";
import { motion } from "framer-motion";
import { UserProfile } from "./UserProfile";

export function Sidebar({ rooms, activeRoom, pendingRoom, onSelectRoom, onCreateRoom, onSettings, theme, isLoading, mobileOpen, onClose }) {
  const [query, setQuery] = useState("");
  const filteredRooms = useMemo(
    () => rooms.filter((room) => room.name.toLowerCase().includes(query.trim().toLowerCase())),
    [rooms, query]
  );

  return (
    <>
      {mobileOpen && <button className="mobile-backdrop" onClick={onClose} aria-label="Close room navigation" />}
      <motion.aside
        className={`sidebar ${mobileOpen ? "sidebar-mobile-open" : ""}`}
        initial={false}
        animate={{ x: mobileOpen ? 0 : 0 }}
        transition={{ duration: 0.2 }}
      >
        <div className="sidebar-brand">
          <div className="brand-lockup">
            <span className="brand-mark"><span /></span>
            <span className="brand-name">orbit<span>.</span></span>
          </div>
          <button className="icon-button sidebar-close" onClick={onClose} aria-label="Close navigation"><X size={18} /></button>
          <span className="workspace-pill"><span className="workspace-dot" /> Workspace</span>
        </div>

        <div className="sidebar-section-heading">
          <span>YOUR ROOMS</span>
          <button className="icon-button tiny-icon-button" onClick={onCreateRoom} aria-label="Create a room" title="Create a room">
            <Plus size={16} />
          </button>
        </div>
        <label className="room-search">
          <Search size={15} aria-hidden="true" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find a room" aria-label="Search rooms" />
          {query && <button type="button" onClick={() => setQuery("")} aria-label="Clear room search"><X size={13} /></button>}
        </label>

        <nav className="room-navigation" aria-label="Chat rooms">
          {isLoading ? (
            <div className="room-skeletons" aria-label="Loading rooms">
              {[0, 1, 2].map((item) => <span className="room-skeleton" key={item} />)}
            </div>
          ) : filteredRooms.length ? (
            filteredRooms.map((room) => {
              const selected = (activeRoom?.id ?? pendingRoom?.id) === room.id;
              return (
                <button
                  type="button"
                  className={`room-link ${selected ? "room-link-active" : ""}`}
                  key={room.id}
                  onClick={() => onSelectRoom(room)}
                  aria-current={selected ? "page" : undefined}
                >
                  <Hash size={17} className="room-hash" />
                  <span className="room-name">{room.name}</span>
                  {selected && <motion.span className="room-selection" layoutId="room-selection" />}
                </button>
              );
            })
          ) : (
            <div className="sidebar-empty">
              <span>{query ? "No rooms match your search." : "No rooms yet."}</span>
              {!query && <button onClick={onCreateRoom}>Create your first room <Plus size={13} /></button>}
            </div>
          )}
        </nav>

        <div className="sidebar-bottom">
          <button type="button" className="sidebar-note" onClick={onSettings} aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}>
            <span className="sidebar-note-icon"><Settings2 size={16} /></span>
            <span><strong>Settings</strong><small>Switch to {theme === "dark" ? "light" : "dark"} theme</small></span>
          </button>
          <UserProfile />
        </div>
      </motion.aside>
    </>
  );
}
