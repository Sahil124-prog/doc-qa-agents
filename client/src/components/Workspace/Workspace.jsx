import { useState } from "react";
import { motion } from "motion/react";
import { useDocuments } from "../../hooks/useDocuments.js";
import Brand from "../Brand/Brand.jsx";
import Shelf from "../Shelf/Shelf.jsx";
import Desk from "../Desk/Desk.jsx";
import "./Workspace.css";

export default function Workspace({ user, onLogout }) {
  const { documents, loading, uploading, uploadError, upload } = useDocuments();

  // Which document questions are limited to ("" = all documents)
  const [scopeId, setScopeId] = useState("");

  const readyDocuments = documents.filter((doc) => doc.status === "ready");

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
        <Shelf
          documents={documents}
          loading={loading}
          uploading={uploading}
          uploadError={uploadError}
          onUpload={upload}
          scopeId={scopeId}
          onSelect={setScopeId}
        />
        <Desk
          readyDocuments={readyDocuments}
          scopeId={scopeId}
          onScopeChange={setScopeId}
        />
      </main>
    </div>
  );
}
