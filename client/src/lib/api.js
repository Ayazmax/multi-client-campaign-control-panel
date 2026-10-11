// Panel requests. Site list, clone, save, and publish go to routes/campaigns.js.
// Adding a language and importing a file go to routes/languages.js.
const apiUrl = import.meta.env.VITE_API_URL || "";

async function request(path, options = {}) {
  const response = await fetch(`${apiUrl}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });
  if (response.status === 204) return null;
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(body?.error || "The request failed.");
    error.status = response.status;
    error.conflict = body?.conflict || null;
    throw error;
  }
  return body;
}

export function fetchHealth() {
  return request("/health");
}

export function fetchMe() {
  return request("/api/auth/me").catch((error) => {
    if (error.status === 401) return null;
    throw error;
  });
}

export function login(email, password) {
  return request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function logout() {
  return request("/api/auth/logout", { method: "POST" });
}

export function fetchPanelSites() {
  return request("/api/panel/sites");
}

export function fetchBulk(item) {
  const query = item ? `?item=${encodeURIComponent(item)}` : "";
  return request(`/api/panel/bulk${query}`);
}

export function applyBulk(body) {
  return request("/api/panel/bulk", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function fetchPanelSite(slug) {
  return request(`/api/panel/sites/${slug}`);
}

export function fetchPublicSite(slug) {
  return request(`/api/public/sites/${slug}`);
}

export function cloneSite(slug, name) {
  return request(`/api/panel/sites/${slug}/clone`, {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

export function saveSite(slug, body) {
  return request(`/api/panel/sites/${slug}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function publishSite(slug, language) {
  return request(`/api/panel/sites/${slug}/publish`, {
    method: "POST",
    body: JSON.stringify(language ? { language } : {}),
  });
}

export function addSiteLanguage(slug, code) {
  return request(`/api/panel/sites/${slug}/languages`, {
    method: "POST",
    body: JSON.stringify({ code }),
  });
}

export function importTranslation(slug, body) {
  return request(`/api/panel/sites/${slug}/translations`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}
