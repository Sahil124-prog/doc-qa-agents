import { useEffect, useState } from "react";
import { api } from "../../api.js";
import "./ChatList.css";

// "Today", "Yesterday", or a short date like "18 Oct"
function shortDate(iso) {
  const day = new Date(iso).toDateString();
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (day === today.toDateString()) return "Today";
  if (day === yesterday.toDateString()) return "Yesterday";
  return new Date(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
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
              <span className="chats-date">{shortDate(chat.updatedAt)}</span>
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
