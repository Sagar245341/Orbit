export function createChannelSocket(channelId: number, token: string): WebSocket {
  const configuredBase = import.meta.env.VITE_WS_BASE_URL?.replace(/\/$/, "");
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const base = configuredBase || `${protocol}//${window.location.host}`;
  const url = `${base}/ws/channels/${channelId}?token=${encodeURIComponent(token)}`;
  return new WebSocket(url);
}
