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

  const response = await fetch(`/api${path}`, {
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
