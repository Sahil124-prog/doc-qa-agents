import { useEffect, useState } from "react";
import { getOpenChat, saveOpenChat } from "../../api.js";

import { motion } from "motion/react";
import { useDocuments } from "../../hooks/useDocuments.js";
import Brand from "../Brand/Brand.jsx";
import Shelf from "../Shelf/Shelf.jsx";
import Desk from "../Desk/Desk.jsx";
import ChatList from "../ChatList/ChatList.jsx";

import "./Workspace.css";

export default function Workspace({ user, onLogout }) {
  const { documents, loading, uploading, error, upload, remove } =
    useDocuments();

  // Which document questions are limited to ("" = all documents)
  const [scopeId, setScopeId] = useState(() => getOpenChat().scopeId ?? "");

  // Which chat is open (null = a new, empty chat) and a counter that tells the list to reload
  const [chatId, setChatId] = useState(() => getOpenChat().chatId ?? null);

  const [chatsVersion, setChatsVersion] = useState(0);
  const refreshChats = () => setChatsVersion((v) => v + 1);

  // Feature 10: keep the open chat through a page refresh
  useEffect(() => {
    saveOpenChat({ chatId, scopeId });
  }, [chatId, scopeId]);

  const readyDocuments = documents.filter((doc) => doc.status === "ready");

  async function handleDelete(id) {
    const deleted = await remove(id);
    if (deleted && scopeId === id) {
      setScopeId("");
      setChatId(null); // its chats were deleted on the server too
    }
    if (deleted) refreshChats();
    return deleted;
  }

  // Picking another document (dropdown or folder) starts a new chat
  function changeScope(id) {
    setScopeId(id);
    setChatId(null);
  }

  // Opening an old chat also switches to the document it was about
  function openChat(chat) {
    setChatId(chat._id);
    setScopeId(chat.documentId ?? "");
  }

  // The first answer of a new chat created it on the server
  function handleChatStarted(id) {
    setChatId(id);
    refreshChats();
  }

  return (
    <div className="workspace">
      <motion.header
        className="workspace-header"
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Brand />
        <div className="workspace-user">
          <span className="workspace-avatar" aria-hidden="true">
            {user.name.charAt(0).toUpperCase()}
          </span>
          <span>{user.name}</span>
          <button className="btn-ghost" onClick={onLogout}>
            Log out
          </button>
        </div>
      </motion.header>

      <main className="workspace-main">
        <aside className="workspace-side">
          <Shelf
            documents={documents}
            loading={loading}
            uploading={uploading}
            error={error}
            onUpload={upload}
            onDelete={handleDelete}
            scopeId={scopeId}
            onSelect={changeScope}
          />
          <ChatList
            activeId={chatId}
            version={chatsVersion}
            onOpen={openChat}
            onNewChat={() => setChatId(null)}
          />
        </aside>
        <Desk
          readyDocuments={readyDocuments}
          scopeId={scopeId}
          onScopeChange={changeScope}
          chatId={chatId}
          onChatStarted={handleChatStarted}
          onChatActivity={refreshChats}
          onChatMissing={() => setChatId(null)}
        />
      </main>
    </div>
  );
}
