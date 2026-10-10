const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:4000";

export async function fetchHealth() {
  const response = await fetch(`${apiUrl}/health`);
  const body = await response.json().catch(() => null);
  if (!body) {
    throw new Error("The API responded without a status payload.");
  }
  return body;
}
