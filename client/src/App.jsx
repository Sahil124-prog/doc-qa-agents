import { useEffect, useState } from "react";
import { clearSession, getSavedUser, saveSession } from "./api.js";
import Background from "./components/Background/Background.jsx";
import AuthScreen from "./components/AuthScreen/AuthScreen.jsx";
import Workspace from "./components/Workspace/Workspace.jsx";

export default function App() {
  // Start logged in if a session was saved earlier
  const [user, setUser] = useState(getSavedUser);

  // api.js fires "auth:expired" when the server says our token is no longer valid
  useEffect(() => {
    function handleExpired() {
      clearSession();
      setUser(null);
    }
    window.addEventListener("auth:expired", handleExpired);
    return () => window.removeEventListener("auth:expired", handleExpired);
  }, []);

  function handleAuth(session) {
    saveSession(session);
    setUser(session.user);
  }

  function handleLogout() {
    clearSession();
    setUser(null);
  }

  return (
    <>
      <Background />
      {user ? (
        <Workspace user={user} onLogout={handleLogout} />
      ) : (
        <AuthScreen onAuth={handleAuth} />
      )}
    </>
  );
}
