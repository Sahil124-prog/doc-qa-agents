import { useEffect, useState } from "react";
import { api } from "../../api.js";
import "./ChatList.css";

// "Today, 3:14 PM", "Yesterday, 9:00 AM", then "16 Oct" (and the year if it's not this year)
function chatTime(iso) {
  const date = new Date(iso);
  const now = new Date();
  const time = date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);

  if (date.toDateString() === now.toDateString()) return `Today, ${time}`;
  if (date.toDateString() === yesterday.toDateString()) return `Yesterday, ${time}`;

  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    ...(date.getFullYear() !== now.getFullYear() && { year: "numeric" }),
  });
}

export default function ChatList({ activeId, version, onOpen, onNewChat }) {
  const [chats, setChats] = useState([]);
  const [confirmingId, setConfirmingId] = useState(null);

  // Reload the list on mount and whenever the Workspace bumps "version"
  useEffect(() => {
    let ignore = false;
    api("/conversations")
      .then(({ conversations }) => {
        if (!ignore) setChats(conversations);
      })
      .catch(() => {});
    return () => {
      ignore = true;
    };
  }, [version]);

  // Same two-click delete as the document folders: first click asks, second deletes
  async function handleDelete(id) {
    if (confirmingId !== id) {
      setConfirmingId(id);
      return;
    }
    setConfirmingId(null);
    try {
      await api(`/conversations/${id}`, { method: "DELETE" });
      setChats((current) => current.filter((c) => c._id !== id));
      if (id === activeId) onNewChat(); // the open chat is gone, start fresh
    } catch {
      // keep it in the list if the server said no
    }
  }

  return (
    <section className="chats">
      <div className="chats-head">
        <h2 className="chats-title">Chats</h2>
        <button type="button" className="chats-new" onClick={onNewChat}>
          + New chat
        </button>
      </div>

      {chats.length === 0 && (
        <p className="chats-empty">Your conversations will show up here.</p>
      )}

      <ul className="chats-list">
        {chats.map((chat) => (
          <li
            key={chat._id}
            className={`chats-item ${chat._id === activeId ? "is-active" : ""}`}
          >
            <button
              type="button"
              className="chats-open"
              onClick={() => onOpen(chat)}
              aria-current={chat._id === activeId ? "true" : undefined}
            >
              <span className="chats-name">{chat.title}</span>
              <span className="chats-date">{chatTime(chat.updatedAt)}</span>
            </button>
            <button
              type="button"
              className={`chats-delete ${confirmingId === chat._id ? "is-confirming" : ""}`}
              onClick={() => handleDelete(chat._id)}
              onBlur={() => setConfirmingId(null)}
              aria-label={`Delete chat ${chat.title}`}
            >
              {confirmingId === chat._id ? "Delete?" : "×"}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
