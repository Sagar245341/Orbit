import { useEffect, useState } from "react";
import { Search, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { RoomBrowserLayout } from "../components/RoomBrowserLayout";
import { RoomCard } from "../components/RoomCard";
import { getApiError } from "../services/api";
import { roomService } from "../services/roomService";
import { useToast } from "../context/ToastContext";

export function DiscoverRoomsPage() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [results, setResults] = useState({ items: [], total: 0, page_size: 12 });
  const [loading, setLoading] = useState(true);
  const [joiningId, setJoiningId] = useState(null);
  const { notify } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    roomService.discover({ q: debouncedSearch, category: category.trim() || undefined, page })
      .then((data) => { if (active) setResults(data); })
      .catch((error) => { if (active) notify(getApiError(error), "error"); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [debouncedSearch, category, page, notify]);

  const join = async (room) => {
    setJoiningId(room.id);
    try {
      await roomService.join(room.id);
      navigate(`/?roomId=${room.id}`);
    } catch (error) {
      notify(getApiError(error), "error");
    } finally {
      setJoiningId(null);
    }
  };

  const pages = Math.max(1, Math.ceil(results.total / results.page_size));

  return (
    <RoomBrowserLayout>
      <div className="community-page discover-page">
        <div className="community-heading">
          <span className="community-kicker"><Sparkles size={14} /> Find your people</span>
          <h1>Discover rooms</h1>
          <p>Explore public communities and join conversations that interest you.</p>
        </div>
        <div className="discover-filters">
          <label className="discover-search"><Search size={17} /><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Search rooms, topics, or descriptions" aria-label="Search public rooms" /></label>
          <input className="category-filter" value={category} onChange={(event) => { setCategory(event.target.value); setPage(1); }} maxLength={60} placeholder="Filter by category" aria-label="Filter by category" />
        </div>
        <div className="discover-results-label">{loading ? "Searching public rooms…" : `${results.total} public ${results.total === 1 ? "room" : "rooms"}`}</div>
        {loading ? (
          <div className="room-card-grid" aria-label="Loading rooms">{[0, 1, 2, 3, 4, 5].map((item) => <div className="room-card-skeleton" key={item} />)}</div>
        ) : results.items.length ? (
          <>
            <div className="room-card-grid">{results.items.map((room) => <RoomCard key={room.id} room={room} onJoin={join} joining={joiningId === room.id} />)}</div>
            {pages > 1 && <div className="pagination-controls"><button className="button-outline" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</button><span>Page {page} of {pages}</span><button className="button-outline" disabled={page >= pages} onClick={() => setPage((value) => value + 1)}>Next</button></div>}
          </>
        ) : <div className="discover-empty"><Search size={24} /><strong>No public rooms found</strong><span>Try a different search or category.</span></div>}
      </div>
    </RoomBrowserLayout>
  );
}
