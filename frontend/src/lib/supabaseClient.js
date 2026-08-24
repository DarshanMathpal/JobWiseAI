import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const isSupabaseConfigured = Boolean(
  supabaseUrl && supabasePublishableKey
);

const STORAGE_KEY = "jobwise-auth-persistence";

const getPreference = () => {
  try {
    return localStorage.getItem(STORAGE_KEY) || "local";
  } catch {
    return "local";
  }
};

const authStorage = {
  getItem(key) {
    try {
      // Prefer a remembered session.
      const localValue = localStorage.getItem(key);
      if (localValue) return localValue;

      // Otherwise use a session-only login.
      return sessionStorage.getItem(key);
    } catch {
      return null;
    }
  },

  setItem(key, value) {
    try {
      if (getPreference() === "session") {
        localStorage.removeItem(key);
        sessionStorage.setItem(key, value);
      } else {
        sessionStorage.removeItem(key);
        localStorage.setItem(key, value);
      }
    } catch {
      // Ignore storage errors.
    }
  },

  removeItem(key) {
    try {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    } catch {
      // Ignore storage errors.
    }
  },
};

export const setAuthPersistence = (rememberMe) => {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      rememberMe ? "local" : "session"
    );
  } catch {
    // Ignore storage errors.
  }
};

export const clearAuthStorage = () => {
  try {
    // Supabase's default browser storage key is normally based on the
    // project's Supabase URL. Remove any auth-looking entries safely.
    const removeAuthKeys = (storage) => {
      for (let i = storage.length - 1; i >= 0; i -= 1) {
        const key = storage.key(i);

        if (key && key.startsWith("sb-")) {
          storage.removeItem(key);
        }
      }
    };

    removeAuthKeys(localStorage);
    removeAuthKeys(sessionStorage);
  } catch {
    // Ignore storage errors.
  }
};

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabasePublishableKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        storage: authStorage,
        detectSessionInUrl: true,
      },
    })
  : null;