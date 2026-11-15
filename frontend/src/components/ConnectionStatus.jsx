import { Radio } from "lucide-react";

const labels = {
  connected: "Live",
  connecting: "Connecting",
  reconnecting: "Reconnecting",
  disconnected: "Offline"
};

export function ConnectionStatus({ status }) {
  return (
    <span className={`connection-badge connection-${status}`} role="status" aria-label={`Connection ${labels[status] || "offline"}`}>
      <span className="connection-dot"><Radio size={11} /></span>
      <span>{labels[status] || labels.disconnected}</span>
    </span>
  );
}
