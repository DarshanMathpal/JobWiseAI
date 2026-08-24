// Central API base URL.
//
// Set VITE_API_BASE_URL in your environment (e.g. Vercel project settings)
// to point the frontend at your deployed backend (Render/Railway/etc).
// Falls back to localhost for local development only.
const rawBaseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

// Strip any trailing slash so callers can safely do `${API_BASE_URL}/api/...`
export const API_BASE_URL = rawBaseUrl.replace(/\/+$/, "");
