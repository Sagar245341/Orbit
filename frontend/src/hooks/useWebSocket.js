import { useCallback, useEffect, useRef, useState } from "react";
import { createRoomSocket } from "../services/websocketService";

const MAX_RETRY_DELAY = 30000;

export function useWebSocket(roomId, token, onMessage, onServerError) {
  const socketRef = useRef(null);
  const callbacksRef = useRef({ onMessage, onServerError });
  const [status, setStatus] = useState("disconnected");

  useEffect(() => {
    callbacksRef.current = { onMessage, onServerError };
  }, [onMessage, onServerError]);

  useEffect(() => {
    if (!roomId || !token) {
      setStatus("disconnected");
      return undefined;
    }

    let disposed = false;
    let attempts = 0;
    let retryTimer;

    const connect = () => {
      if (disposed) return;
      setStatus(attempts === 0 ? "connecting" : "reconnecting");
      const socket = createRoomSocket(roomId, token);
      socketRef.current = socket;

      socket.onopen = () => {
        if (disposed) return socket.close();
        attempts = 0;
        setStatus("connected");
      };
      socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload?.type === "message") callbacksRef.current.onMessage?.(payload);
          else if (payload?.type === "error") callbacksRef.current.onServerError?.(payload.detail || "The server rejected that message.");
        } catch {
          callbacksRef.current.onServerError?.("The chat server sent an unreadable response.");
        }
      };
      socket.onerror = () => {
        if (!disposed) setStatus("reconnecting");
      };
      socket.onclose = (event) => {
        if (socketRef.current === socket) socketRef.current = null;
        if (disposed) return;
        if (event.code === 1008) {
          setStatus("disconnected");
          callbacksRef.current.onServerError?.(event.reason || "Your chat connection was not authorized.");
          return;
        }
        attempts += 1;
        setStatus("reconnecting");
        const delay = Math.min(1000 * (2 ** (attempts - 1)), MAX_RETRY_DELAY);
        retryTimer = window.setTimeout(connect, delay);
      };
    };

    connect();
    return () => {
      disposed = true;
      window.clearTimeout(retryTimer);
      const socket = socketRef.current;
      socketRef.current = null;
      if (socket && socket.readyState < WebSocket.CLOSING) socket.close(1000, "Room changed");
      setStatus("disconnected");
    };
  }, [roomId, token]);

  const send = useCallback((content) => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) return false;
    socket.send(JSON.stringify({ content }));
    return true;
  }, []);

  return { status, send };
}
