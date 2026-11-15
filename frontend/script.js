const API = "/api";
let token = localStorage.getItem("chat_token");
let currentUser = null;
let currentRoom = null;
let socket = null;
let authMode = "login";

const $ = (id) => document.getElementById(id);
const authPanel = $("authPanel");
const chatPanel = $("chatPanel");

function toast(message) {
  const el = $("toast");
  el.textContent = message;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 2600);
}

async function api(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (options.body) headers["Content-Type"] = "application/json";
  const response = await fetch(`${API}${path}`, { ...options, headers });
  const data = response.status === 204 ? null : await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = data?.detail;
    let message;
    if (typeof detail === "string") {
      message = detail;
    } else if (Array.isArray(detail)) {
      message = detail.map((item) => {
        if (typeof item === "string") return item;
        if (!item || typeof item !== "object") return String(item);
        const location = Array.isArray(item.loc)
          ? item.loc.filter((part) => part !== "body").join(".")
          : "";
        const text = typeof item.msg === "string" ? item.msg : JSON.stringify(item);
        return location ? `${location}: ${text}` : text;
      }).join("; ");
    } else if (detail && typeof detail === "object") {
      message = detail.message || detail.msg || JSON.stringify(detail);
    }
    throw new Error(message || `Request failed (${response.status})`);
  }
  return data;
}

function setAuthMode(mode) {
  authMode = mode;
  $("usernameLabel").classList.toggle("hidden", mode !== "register");
  $("authSubmit").textContent = mode === "login" ? "Login" : "Create account";
  $("showLogin").classList.toggle("active", mode === "login");
  $("showRegister").classList.toggle("active", mode === "register");
  $("password").autocomplete = mode === "login" ? "current-password" : "new-password";
  $("authMessage").textContent = "";
}

$("showLogin").addEventListener("click", () => setAuthMode("login"));
$("showRegister").addEventListener("click", () => setAuthMode("register"));

$("authForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  $("authMessage").textContent = "Please wait...";
  try {
    if (authMode === "register") {
      await api("/auth/register", {
        method: "POST",
        body: JSON.stringify({
          username: $("username").value.trim(),
          email: $("email").value.trim(),
          password: $("password").value
        })
      });
      setAuthMode("login");
      $("authMessage").textContent = "Account created. You can now log in.";
      return;
    }
    const result = await api("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: $("email").value.trim(), password: $("password").value })
    });
    token = result.access_token;
    localStorage.setItem("chat_token", token);
    await showChat();
  } catch (error) {
    $("authMessage").textContent = error.message;
  }
});

async function showChat() {
  try {
    currentUser = await api("/auth/me");
    authPanel.classList.add("hidden");
    chatPanel.classList.remove("hidden");
    $("logoutBtn").classList.remove("hidden");
    await loadRooms();
  } catch (error) {
    logout(false);
    $("authMessage").textContent = error.message;
  }
}

function logout(showMessage = true) {
  if (socket) socket.close();
  socket = null;
  token = null;
  currentUser = null;
  currentRoom = null;
  localStorage.removeItem("chat_token");
  chatPanel.classList.add("hidden");
  authPanel.classList.remove("hidden");
  $("logoutBtn").classList.add("hidden");
  $("messages").innerHTML = '<p class="empty">Choose or create a room to start chatting.</p>';
  $("messageInput").disabled = true;
  $("sendBtn").disabled = true;
  if (showMessage) toast("Logged out");
}
$("logoutBtn").addEventListener("click", () => logout());

async function loadRooms() {
  const rooms = await api("/rooms");
  const list = $("roomList");
  list.innerHTML = "";
  if (!rooms.length) {
    list.innerHTML = '<p class="status">No rooms yet. Create one!</p>';
    return;
  }
  rooms.forEach(room => {
    const button = document.createElement("button");
    button.className = `room-button ${currentRoom?.id === room.id ? "selected" : ""}`;
    button.textContent = `# ${room.name}`;
    button.addEventListener("click", () => enterRoom(room));
    list.appendChild(button);
  });
}

$("createRoomForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const room = await api("/rooms", {
      method: "POST",
      body: JSON.stringify({ name: $("roomName").value.trim() })
    });
    $("roomName").value = "";
    await loadRooms();
    await enterRoom(room);
  } catch (error) { toast(error.message); }
});

async function enterRoom(room) {
  try {
    if (socket) socket.close();
    await api(`/rooms/${room.id}/join`, { method: "POST" });
    currentRoom = room;
    $("currentRoomName").textContent = `# ${room.name}`;
    $("messages").innerHTML = "";
    await loadRooms();
    const history = await api(`/rooms/${room.id}/messages?limit=50`);
    history.forEach(addMessage);
    connectWebSocket(room.id);
  } catch (error) { toast(error.message); }
}

function connectWebSocket(roomId) {
  const protocol = location.protocol === "https:" ? "wss" : "ws";
  socket = new WebSocket(`${protocol}://${location.host}/ws/rooms/${roomId}?token=${encodeURIComponent(token)}`);
  $("connectionStatus").textContent = "Connecting...";
  socket.onopen = () => {
    $("connectionStatus").textContent = "Connected";
    $("messageInput").disabled = false;
    $("sendBtn").disabled = false;
    $("messageInput").focus();
  };
  socket.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.type === "error") toast(data.detail);
    else if (data.type === "message") addMessage(data);
  };
  socket.onclose = () => {
    $("connectionStatus").textContent = "Disconnected";
    $("messageInput").disabled = true;
    $("sendBtn").disabled = true;
  };
  socket.onerror = () => { $("connectionStatus").textContent = "Connection error"; };
}

function addMessage(message) {
  const empty = $("messages").querySelector(".empty");
  if (empty) empty.remove();
  const item = document.createElement("div");
  item.className = `message ${message.sender_id === currentUser.id ? "mine" : ""}`;
  const meta = document.createElement("span");
  meta.className = "meta";
  const date = message.created_at ? new Date(message.created_at) : new Date();
  meta.textContent = `${message.sender_username || "User"} · ${date.toLocaleTimeString([], {hour: "2-digit", minute: "2-digit"})}`;
  const content = document.createElement("div");
  content.className = "content";
  content.textContent = message.content;
  item.append(meta, content);
  $("messages").appendChild(item);
  $("messages").scrollTop = $("messages").scrollHeight;
}

$("messageForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const content = $("messageInput").value.trim();
  if (!content || !socket || socket.readyState !== WebSocket.OPEN) return;
  socket.send(JSON.stringify({ content }));
  $("messageInput").value = "";
});

const oauthResult = new URLSearchParams(location.hash.slice(1));
const oauthToken = oauthResult.get("access_token");
const oauthError = oauthResult.get("oauth_error");
if (oauthResult.has("access_token") || oauthResult.has("oauth_error")) {
  history.replaceState(null, "", `${location.pathname}${location.search}`);
}
if (oauthToken) {
  token = oauthToken;
  localStorage.setItem("chat_token", token);
}
if (oauthError) {
  const messages = {
    google_not_configured: "Google sign-in is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env.",
    google_signin_failed: "Google sign-in failed or was cancelled. Please try again.",
    google_email_unverified: "Google must provide a verified email address to sign in.",
    google_account_conflict: "This Google account could not be linked to a user account."
  };
  $("authMessage").textContent = messages[oauthError] || "Google sign-in failed. Please try again.";
}
if (token) showChat();
