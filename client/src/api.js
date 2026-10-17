const TOKEN_KEY = "folio_token";
const USER_KEY = "folio_user";

// ---------- Session (token + user) stored in the browser ----------

export function saveSession({ token, user }) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function getSavedUser() {
  const token = localStorage.getItem(TOKEN_KEY);
  const user = localStorage.getItem(USER_KEY);
  return token && user ? JSON.parse(user) : null;
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

// ---------- One function for every request to our API ----------

export async function api(path, { method = "GET", body, formData } = {}) {
  const headers = {};

  const token = localStorage.getItem(TOKEN_KEY);
  if (token) headers.Authorization = `Bearer ${token}`;

  let requestBody;
  if (formData) {
    requestBody = formData; // the browser sets the multipart Content-Type itself
  } else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    requestBody = JSON.stringify(body);
  }

  const BASE_URL = import.meta.env.VITE_API_URL ?? "";
  const response = await fetch(`${BASE_URL}/api${path}`, {
    method,
    headers,
    body: requestBody,
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    // Token expired or invalid (but not a failed login attempt): tell the app to log out
    if (response.status === 401 && !path.startsWith("/auth/")) {
      window.dispatchEvent(new Event("auth:expired"));
    }
    const error = new Error(
      data.message || `Request failed (${response.status})`,
    );
    error.status = response.status;
    throw error;
  }

  return data;
}

// ---------- Feature 8: streaming answers (Server-Sent Events) ----------

// Reads "event: x\ndata: {...}\n\n" messages from a fetch response.
// Network chunks don't respect message boundaries, so we buffer until "\n\n".
async function readEventStream(response, onEvent) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true }); // stream: true keeps half characters

    let boundary;
    while ((boundary = buffer.indexOf("\n\n")) !== -1) {
      const raw = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);

      let event = "message";
      let data = "";
      for (const line of raw.split("\n")) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        else if (line.startsWith("data:")) data += line.slice(5).trim();
      }
      if (data) onEvent(event, JSON.parse(data));
    }
  }
}

// POSTs a question and streams the agent's work back.
// Calls onStep(text) for every agent step, resolves with the final answer.
export async function apiStream(path, { body, onStep, onToken, onReset } = {}) {
  const headers = { "Content-Type": "application/json" };
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) headers.Authorization = `Bearer ${token}`;

  const BASE_URL = import.meta.env.VITE_API_URL ?? "";
  const response = await fetch(`${BASE_URL}/api${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  // Errors before the stream starts (400, 401, rate limit) are still normal JSON
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    if (response.status === 401)
      window.dispatchEvent(new Event("auth:expired"));
    const error = new Error(
      data.message || `Request failed (${response.status})`,
    );
    error.status = response.status;
    throw error;
  }

  let result;
    await readEventStream(response, (event, data) => {
      if (event === "step") onStep?.(data.text);
      else if (event === "token") onToken?.(data.text);
      else if (event === "reset") onReset?.();
      else if (event === "done") result = data;
      else if (event === "error") throw new Error(data.message);
    });

  if (!result) throw new Error("The answer stopped halfway. Please try again.");
  return result;
}
