import { useRef, useState } from "react";
import { ArrowUp, CornerDownLeft, Smile } from "lucide-react";

export function MessageInput({ connected, onSend }) {
  const [value, setValue] = useState("");
  const [sending, setSending] = useState(false);
  const inputRef = useRef(null);
  const canSend = connected && value.trim().length > 0 && !sending;

  const submit = (event) => {
    event?.preventDefault();
    const content = value.trim();
    if (!content || !connected || sending) return;
    setSending(true);
    if (onSend(content)) {
      setValue("");
      inputRef.current?.focus();
    }
    window.setTimeout(() => setSending(false), 180);
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  };

  return (
    <div className="composer-wrap">
      <form className={`composer ${!connected ? "composer-disabled" : ""}`} onSubmit={submit}>
        <textarea
          ref={inputRef}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={connected ? "Write something thoughtful…" : "Connect to the room to send a message"}
          aria-label="Write a message"
          maxLength={2000}
          rows={1}
          disabled={!connected}
        />
        <div className="composer-tools">
          <button type="button" className="composer-tool" disabled title="Emoji support is not available yet" aria-label="Emoji (not available)">
            <Smile size={17} />
          </button>
          <span className={`character-count ${value.length > 1900 ? "character-count-near-limit" : ""}`}>{value.length}/2000</span>
          <button className="send-button" type="submit" disabled={!canSend} aria-label="Send message" title="Send message">
            <ArrowUp size={17} />
          </button>
        </div>
      </form>
      <div className="composer-hint"><span><kbd>Enter</kbd> to send</span><span><kbd>Shift</kbd> + <kbd>Enter</kbd> for a new line</span><span className="hint-right"><CornerDownLeft size={12} /> Keep it kind</span></div>
    </div>
  );
}
