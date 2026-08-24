import { useEffect, useRef, useState } from "react";
import "./App.css";
import JobDetails from "./JobDetails";
import ResumeUpload from "./ResumeUpload";
import JobAssistant from "./JobAssistant";
import { supabase, isSupabaseConfigured, setAuthPersistence, clearAuthStorage } from "./lib/supabaseClient";
import { API_BASE_URL } from "./lib/apiConfig";
import { FcGoogle } from "react-icons/fc";

const FILTER_CACHE_KEY = "ai-job-board-filter-options-v3";
const LOCATION_COUNTRIES_CACHE_KEY = "ai-job-board-location-countries-v1";
const SAVED_JOBS_KEY = "ai-job-board-saved-jobs-v1";
const JOBS_CACHE_KEY = "ai-job-board-jobs-cache-v1";

function loadSavedJobs() {
  try {
    const raw = localStorage.getItem(SAVED_JOBS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persistSavedJobs(jobs) {
  try {
    localStorage.setItem(SAVED_JOBS_KEY, JSON.stringify(jobs));
  } catch {
    // Saved jobs are best-effort browser storage.
  }
}

function loadCachedJobs() {
  try {
    const raw = localStorage.getItem(JOBS_CACHE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;

    if (!parsed || !Array.isArray(parsed.jobs)) {
      return { jobs: [], total: 0, overallTotal: 0 };
    }

    return parsed;
  } catch {
    return { jobs: [], total: 0, overallTotal: 0 };
  }
}

function saveCachedJobs(jobs, total, overallTotal) {
  try {
    localStorage.setItem(
      JOBS_CACHE_KEY,
      JSON.stringify({
        jobs,
        total,
        overallTotal,
        savedAt: Date.now(),
      })
    );
  } catch {
    // Cache is optional.
  }
}


let sharedCountries = null;
let sharedCountriesPromise = null;
const sharedStates = {};
const sharedCities = {};

function loadStoredCountries() {
  if (sharedCountries) return sharedCountries;
  try {
    const raw =localStorage.getItem(LOCATION_COUNTRIES_CACHE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (Array.isArray(parsed) && parsed.length) {
      sharedCountries = parsed;
      return parsed;
    }
  } catch {
    // Fall through to the API.
  }
  return null;
}

function saveStoredCountries(countries) {
  sharedCountries = countries;
  try {
    localStorage.setItem(LOCATION_COUNTRIES_CACHE_KEY, JSON.stringify(countries));
  } catch {
    // Cache is optional.
  }
}

async function getCountriesOnce() {
  const stored = loadStoredCountries();
  if (stored) return stored;
  if (sharedCountriesPromise) return sharedCountriesPromise;

  sharedCountriesPromise = fetch(`${API_BASE_URL}/api/locations/countries`)
    .then((response) => {
      if (!response.ok) throw new Error("Failed to load countries");
      return response.json();
    })
    .then((data) => {
      const countries = Array.isArray(data.countries) ? data.countries : [];
      saveStoredCountries(countries);
      return countries;
    })
    .finally(() => {
      sharedCountriesPromise = null;
    });

  return sharedCountriesPromise;
}

async function getStatesOnce(countryCode) {
  if (sharedStates[countryCode]) return sharedStates[countryCode];
  const response = await fetch(`${API_BASE_URL}/api/locations/${encodeURIComponent(countryCode)}/states`);
  if (!response.ok) throw new Error("Failed to load states");
  const data = await response.json();
  sharedStates[countryCode] = Array.isArray(data.states) ? data.states : [];
  return sharedStates[countryCode];
}

async function getCitiesOnce(countryCode, stateCode) {
  const key = `${countryCode}::${stateCode}`;
  if (sharedCities[key]) return sharedCities[key];
  const response = await fetch(`${API_BASE_URL}/api/locations/${encodeURIComponent(countryCode)}/states/${encodeURIComponent(stateCode)}/cities`);
  if (!response.ok) throw new Error("Failed to load cities");
  const data = await response.json();
  sharedCities[key] = Array.isArray(data.cities) ? data.cities : [];
  return sharedCities[key];
}

function uniqueOptions(values) {
  if (!Array.isArray(values)) return [];
  return [...new Map(values.filter((v) => typeof v === "string" && v.trim()).map((v) => [v.trim().toLowerCase(), v.trim()])).values()].sort((a, b) => a.localeCompare(b));
}

const COMMON_ROLES = [
  "Data Analyst",
  "Data Scientist",
  "Data Engineer",
  "Business Analyst",
  "Software Engineer",
  "Machine Learning Engineer",
  "Product Analyst",
  "Web Developer",
  "Full Stack Developer",
  "Frontend Developer",
  "Backend Developer",
];

function cleanRoleSuggestion(value) {
  if (typeof value !== "string") return "";
  let text = value.replace(/\s+/g, " ").trim();
  if (!text) return "";
  // Remove accidental metadata prefixes while preserving real titles such as .NET.
  text = text.replace(/^(?:[-:|]+\s*)+/, "");
  // Remove trailing experience metadata accidentally embedded in job titles.
  text = text.replace(/\s*\(\s*\d+\s*(?:years?|yrs?)\s*\)\s*$/i, "");
  return text.trim();
}

function buildRoleSuggestions(values, query = "") {
  const cleaned = uniqueOptions(
    (values || [])
      .map(cleanRoleSuggestion)
      .filter(Boolean)
  );

  const rawQuery = query.trim();
  const q = rawQuery.toLowerCase();

  // No search text: show clean predefined roles.
  if (!q) {
    return COMMON_ROLES.slice(0, 12);
  }

  // If the current value is already one of our predefined roles,
  // keep the dropdown clean when it is reopened.
  const selectedCommonRole = COMMON_ROLES.some(
    (role) => role.toLowerCase() === q
  );

  if (selectedCommonRole) {
    return COMMON_ROLES.slice(0, 12);
  }

  // User is typing a custom/search query:
  // show matching common roles + clean database roles.
  const matches = uniqueOptions([
    ...COMMON_ROLES.filter((role) =>
      role.toLowerCase().includes(q)
    ),

    ...cleaned.filter((role) => {
      const lower = role.toLowerCase();

      const looksLikeRole =
        /(analyst|scientist|engineer|developer|designer|manager|architect|specialist|consultant|administrator|recruiter|director|lead|intern|researcher|stack|devops|qa|tester)/i.test(
          role
        );

      return (
        looksLikeRole &&
        (lower.startsWith(q) || lower.includes(q))
      );
    }),
  ]);

  return matches.slice(0, 12);
}

function compactJobCount(count) {
  const n = Number(count || 0);
  if (!n) return "—";
  if (n < 1000) return String(n);
  const thousands = Math.floor(n / 1000);
  return `${thousands}K+`;
}

function loadFilterCache() {
  try {
    const raw = localStorage.getItem(FILTER_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return {
      sources: uniqueOptions(parsed.sources),
      skills: uniqueOptions(parsed.skills),
      domains: uniqueOptions(parsed.domains),
      roleTitles: uniqueOptions(parsed.roleTitles),
    };
  } catch {
    return null;
  }
}

function saveFilterCache(options) {
  try {
    localStorage.setItem(FILTER_CACHE_KEY, JSON.stringify({ ...options, savedAt: Date.now() }));
  } catch {
    // Cache is an optimization only.
  }
}

function Logo({ compact = false }) {
  return (
    <div className={`brand-lockup ${compact ? "compact" : ""}`}>
      <div className="brand-logo" aria-hidden="true">
        <svg viewBox="0 0 44 44" role="img">
          <defs>
            <linearGradient id="jobwise-gradient" x1="6" y1="8" x2="38" y2="36" gradientUnits="userSpaceOnUse">
              <stop stopColor="#6D5DFB" />
              <stop offset="1" stopColor="#A78BFA" />
            </linearGradient>
          </defs>
          <path d="M22 3.8c2.2 9.4 4.8 12 14.2 14.2C26.8 20.2 24.2 22.8 22 32.2 19.8 22.8 17.2 20.2 7.8 18 17.2 15.8 19.8 13.2 22 3.8Z" fill="url(#jobwise-gradient)" />
                  </svg>
      </div>
      {!compact && <div className="brand-wordmark"><strong>JobWise AI</strong><span>Smarter jobs. Better matches.</span></div>}
    </div>
  );
}

function SearchIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.7" /><path d="m16 16 5 5" /></svg>;
}

function ArrowUpRight() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17 17 7" /><path d="M8 7h9v9" /></svg>;
}

function ChevronRight() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg>;
}

function ChevronDown() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>;
}

function TripleSparkles() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className="triple-sparkle-icon">
      <path d="M12 2.5c1.3 5.9 3.3 7.9 9.2 9.2-5.9 1.3-7.9 3.3-9.2 9.2-1.3-5.9-3.3-7.9-9.2-9.2C8.7 10.4 10.7 8.4 12 2.5Z" fill="currentColor" />
      <path d="M24.2 16.2c.7 3 1.7 4 4.7 4.7-3 .7-4 1.7-4.7 4.7-.7-3-1.7-4-4.7-4.7 3-.7 4-1.7 4.7-4.7Z" fill="currentColor" />
      <path d="M25.7 2.8c.4 1.7 1 2.3 2.7 2.7-1.7.4-2.3 1-2.7 2.7-.4-1.7-1-2.3-2.7-2.7 1.7-.4 2.3-1 2.7-2.7Z" fill="currentColor" />
    </svg>
  );
}

function UserCircleIcon() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className="user-circle-icon">
      <circle cx="16" cy="16" r="13" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="16" cy="12" r="4" fill="currentColor" />
      <path d="M8.5 24c1.7-3.4 4.2-5.2 7.5-5.2s5.8 1.8 7.5 5.2" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function SelectedChips({ values, onRemove, valueLabel }) {
  if (!values?.length) return null;
  return (
    <div className="selected-chip-row" aria-label="Selected filters">
      {values.map((value) => (
        <button
          key={value}
          type="button"
          className="selected-chip"
          onClick={() => onRemove(value)}
          title={`Remove ${valueLabel ? valueLabel(value) : value}`}
        >
          <span>{valueLabel ? valueLabel(value) : value}</span>
          <span aria-hidden="true">×</span>
        </button>
      ))}
    </div>
  );
}

function locationLabel(value) {
  if (!value) return value;
  const parts = String(value).split("|");
  return parts[parts.length - 1] || value;
}

function CompanyAvatar({ thumbnail, companyName }) {
  const [failed, setFailed] = useState(false);
  const initial = String(companyName || "?").trim().charAt(0).toUpperCase() || "?";

  if (!thumbnail || failed) {
    return <span className="company-avatar-fallback">{initial}</span>;
  }

  return (
    <img
      src={thumbnail}
      alt=""
      onError={() => setFailed(true)}
      loading="lazy"
    />
  );
}

function MultiSelectDropdown({ label, options, selectedValues, onChange, searchable = true }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapperRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event) => {
      if (!wrapperRef.current?.contains(event.target)) setOpen(false);
    };
    const handleKeyDown = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const filteredOptions = query.trim()
    ? options.filter((option) => option.toLowerCase().startsWith(query.trim().toLowerCase()))
    : options;

  const toggle = (option) => {
    const next = selectedValues.includes(option)
      ? selectedValues.filter((v) => v !== option)
      : [...selectedValues, option];
    onChange(next);
    // Filters are applied with the Apply filters button, but the menu itself
    // should close as soon as the user chooses an item.
    setOpen(false);
    setQuery("");
  };

  const clear = () => {
    onChange([]);
    setOpen(false);
    setQuery("");
  };

  return (
    <div className={`filter-menu-wrap ${open ? "is-open" : ""}`} ref={wrapperRef}>
      <button
        type="button"
        className={`filter-button ${open ? "active" : ""}`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span>{selectedValues.length ? `${selectedValues.length} selected` : label}</span>
        <ChevronRight />
      </button>

      {open && (
        <div className="filter-popover">
          <div className="popover-head">
            <strong>{label}</strong>
            <button type="button" onClick={clear}>Clear</button>
          </div>

          {searchable && (
            <div className="popover-search">
              <SearchIcon />
              <input
                autoFocus
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={`Search ${label.toLowerCase()}...`}
                aria-label={`Search ${label}`}
              />
            </div>
          )}

          <div className="popover-list">
            {filteredOptions.length ? filteredOptions.map((option) => (
              <label key={option} className="check-row">
                <input
                  type="checkbox"
                  checked={selectedValues.includes(option)}
                  onChange={() => toggle(option)}
                />
                <span>{option}</span>
              </label>
            )) : (
              <div className="popover-empty">No matching {label.toLowerCase()}.</div>
            )}
          </div>
        </div>
      )}

      <SelectedChips
        values={selectedValues}
        onRemove={(value) => onChange(selectedValues.filter((item) => item !== value))}
      />
    </div>
  );
}

function LocationDropdown({ selectedValues, onChange, allowRemote = false }) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef(null);
  const [countries, setCountries] = useState(() => loadStoredCountries() || []);
  const [states, setStates] = useState({});
  const [cities, setCities] = useState({});
  const [expandedCountries, setExpandedCountries] = useState({});
  const [expandedStates, setExpandedStates] = useState({});
  const [loading, setLoading] = useState({ countries: false, states: {}, cities: {} });
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");

  const toggle = (value) => {
    onChange(
      selectedValues.includes(value)
        ? selectedValues.filter((v) => v !== value)
        : [...selectedValues, value]
    );
    setOpen(false);
    setQuery("");
  };

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event) => {
      if (!wrapperRef.current?.contains(event.target)) setOpen(false);
    };
    const handleKeyDown = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    if (!countries.length && !loading.countries) {
      let cancelled = false;
      setError("");
      setLoading((s) => ({ ...s, countries: true }));
      getCountriesOnce()
        .then((data) => {
          if (!cancelled) setCountries(data);
        })
        .catch((requestError) => {
          console.error("Location countries error:", requestError);
          if (!cancelled) {
            setCountries([]);
            setError("Could not load locations.");
          }
        })
        .finally(() => {
          if (!cancelled) setLoading((s) => ({ ...s, countries: false }));
        });

      return () => {
        cancelled = true;
        document.removeEventListener("mousedown", handlePointerDown);
        document.removeEventListener("keydown", handleKeyDown);
      };
    }

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, countries.length, loading.countries]);

  const expandCountry = async (country) => {
    const key = country.code;
    setExpandedCountries((s) => ({ ...s, [key]: !s[key] }));
    if (states[key]) return;

    setLoading((s) => ({
      ...s,
      states: { ...s.states, [key]: true },
    }));

    try {
      const data = await getStatesOnce(key);
      setStates((s) => ({ ...s, [key]: data }));
    } catch (requestError) {
      console.error("Location states error:", requestError);
      setStates((s) => ({ ...s, [key]: [] }));
    } finally {
      setLoading((s) => ({
        ...s,
        states: { ...s.states, [key]: false },
      }));
    }
  };

  const expandState = async (country, state) => {
    const key = `${country.code}::${state.code}`;
    setExpandedStates((s) => ({ ...s, [key]: !s[key] }));
    if (cities[key]) return;

    setLoading((s) => ({
      ...s,
      cities: { ...s.cities, [key]: true },
    }));

    try {
      const data = await getCitiesOnce(country.code, state.code);
      setCities((s) => ({ ...s, [key]: data }));
    } catch (requestError) {
      console.error("Location cities error:", requestError);
      setCities((s) => ({ ...s, [key]: [] }));
    } finally {
      setLoading((s) => ({
        ...s,
        cities: { ...s.cities, [key]: false },
      }));
    }
  };

  const countryValue = (country) =>
    `country|${country.code}|${country.name}`;
  const stateValue = (country, state) =>
    `state|${country.code}|${state.code}|${state.name}`;
  const cityValue = (country, state, city) =>
    `city|${country.code}|${state.code}|${city.name}`;

  const visibleCountries = countries.filter((country) => !query.trim() || country.name.toLowerCase().startsWith(query.trim().toLowerCase()));

  return (
    <div className={`filter-menu-wrap location-filter-wrap ${open ? "is-open" : ""}`} ref={wrapperRef}>
      <button
        type="button"
        className={`filter-button ${open ? "active" : ""}`}
        onClick={() => setOpen((v) => !v)}
      >
        <span>
          {selectedValues.length
            ? `${selectedValues.length} selected`
            : "Choose location"}
        </span>
        <ChevronRight />
      </button>

      {open && (
        <div className="filter-popover location-popover">
          <div className="popover-head">
            <strong>Location</strong>
            <button type="button" onClick={() => { onChange([]); setQuery(""); setOpen(false); }}>
              Clear
            </button>
          </div>

          <div className="popover-search">
            <SearchIcon />
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search countries..."
              aria-label="Search countries"
            />
          </div>

          {allowRemote && (!query.trim() || "remote".startsWith(query.trim().toLowerCase())) && (
            <label className="remote-location-row">
              <input
                type="checkbox"
                checked={selectedValues.includes("remote")}
                onChange={() => toggle("remote")}
              />
              <span>Remote</span>
              <small>Work from home</small>
            </label>
          )}

          <div className="location-scroll">
            {loading.countries ? (
              <div className="popover-empty">Loading countries...</div>
            ) : error ? (
              <div className="popover-empty">{error}</div>
            ) : countries.length === 0 ? (
              <div className="popover-empty">No locations available.</div>
            ) : (
              <>
                {visibleCountries.map((country) => {
                  const countrySelected = selectedValues.includes(countryValue(country));
                  return (
                    <div key={country.code} className="location-group">
                      <div className="location-line">
                        <button
                          type="button"
                          className="expand-button"
                          onClick={() => expandCountry(country)}
                          aria-label={`Expand ${country.name}`}
                        >
                          {expandedCountries[country.code] ? "⌄" : "›"}
                        </button>

                        <label className="check-row">
                          <input
                            type="checkbox"
                            checked={countrySelected}
                            onChange={() => toggle(countryValue(country))}
                          />
                          <span className="country-option">
                            <span className="country-flag">
                              {country.code
                                ?.toUpperCase()
                                .replace(/./g, (char) =>
                                  String.fromCodePoint(127397 + char.charCodeAt(0))
                                )}
                            </span>
                            <span>{country.name}</span>
                          </span>
                        </label>
                      </div>

                      {expandedCountries[country.code] && (
                        <div className="nested-level">
                          {loading.states[country.code] ? (
                            <div className="mini-loading">Loading states...</div>
                          ) : (states[country.code] || []).map((state) => {
                            const stateKey = `${country.code}::${state.code}`;
                            const stateSelected = selectedValues.includes(
                              stateValue(country, state)
                            );

                            return (
                              <div key={stateKey} className="location-group">
                                <div className="location-line">
                                  <button
                                    type="button"
                                    className="expand-button"
                                    onClick={() => expandState(country, state)}
                                    aria-label={`Expand ${state.name}`}
                                  >
                                    {expandedStates[stateKey] ? "⌄" : "›"}
                                  </button>

                                  <label className="check-row">
                                    <input
                                      type="checkbox"
                                      checked={stateSelected}
                                      onChange={() => toggle(stateValue(country, state))}
                                    />
                                    <span>{state.name}</span>
                                  </label>
                                </div>

                                {expandedStates[stateKey] && (
                                  <div className="nested-level city-level">
                                    {loading.cities[stateKey] ? (
                                      <div className="mini-loading">Loading cities...</div>
                                    ) : (cities[stateKey] || []).map((city) => {
                                      const value = cityValue(country, state, city);
                                      return (
                                        <label key={value} className="check-row">
                                          <input
                                            type="checkbox"
                                            checked={selectedValues.includes(value)}
                                            onChange={() => toggle(value)}
                                          />
                                          <span>{city.name}</span>
                                        </label>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
                {visibleCountries.length === 0 && !loading.countries && !error && (
                  <div className="popover-empty">No countries start with “{query}”.</div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      <SelectedChips
        values={selectedValues}
        onRemove={(value) => onChange(selectedValues.filter((item) => item !== value))}
        valueLabel={locationLabel}
      />
    </div>
  );
}

function SparkleIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M12 2.5l1.7 6.1L20 10.5l-6.3 1.9L12 18.5l-1.7-6.1L4 10.5l6.3-1.9L12 2.5Z"
        fill="currentColor"
      />
    </svg>
  );
}

function EyeIcon({ hidden = false }) {
  return hidden ? (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M3 3l18 18" />
      <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
      <path d="M9.9 5.1A10.4 10.4 0 0 1 12 4.9c5.1 0 8.8 4.5 9.8 7.1-.4 1-1.3 2.6-2.9 4.1" />
      <path d="M6.2 6.3C4.4 7.7 3.1 9.6 2.2 12c.9 2.5 4.6 7.1 9.8 7.1 1 0 1.9-.2 2.7-.5" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M2.4 12s3.4-6.7 9.6-6.7S21.6 12 21.6 12 18.2 18.7 12 18.7 2.4 12 2.4 12Z" />
      <circle cx="12" cy="12" r="2.6" />
    </svg>
  );
}


function formatAuthError(error, action = "authentication") {
  const message = String(error?.message || "").trim();
  const code = String(error?.code || "").toLowerCase();
  const status = Number(error?.status || error?.statusCode || 0);
  const lower = message.toLowerCase();

  const rateLimited =
    status === 429 ||
    code === "over_request_rate_limit" ||
    lower.includes("rate limit") ||
    lower.includes("too many requests") ||
    lower.includes("email rate limit") ||
    lower.includes("quota exceeded");

  if (rateLimited) {
    if (action === "password reset") {
      return "Password reset emails are temporarily limited. Please wait a little and try again.";
    }
    if (action === "sign up") {
      return "Email sign-up is temporarily rate-limited. Please wait a little and try again.";
    }
    return "Too many authentication requests were made. Please wait a little and try again.";
  }

  if (lower.includes("invalid login credentials")) {
    return "The email or password is incorrect. Please check your details and try again.";
  }

  if (lower.includes("user already registered") || lower.includes("already been registered")) {
    return "An account with this email already exists. Try logging in instead.";
  }

  if (lower.includes("email not confirmed")) {
    return "Please confirm your email address before logging in.";
  }

  if (lower.includes("password should be at least")) {
    return "Your password needs to be at least 6 characters long.";
  }

  if (lower.includes("email") && lower.includes("invalid")) {
    return "Please enter a valid email address.";
  }

  if (lower.includes("redirect") && lower.includes("not allowed")) {
    return "This authentication redirect is not allowed yet. Check the Supabase URL configuration.";
  }

  return message || `Could not complete ${action}. Please try again.`;
}

const PASSWORD_REQUIREMENTS = [
  {
    label: "At least 8 characters",
    test: (value) => value.length >= 8,
  },
  {
    label: "One uppercase letter",
    test: (value) => /[A-Z]/.test(value),
  },
  {
    label: "One lowercase letter",
    test: (value) => /[a-z]/.test(value),
  },
  {
    label: "One number",
    test: (value) => /\d/.test(value),
  },
  {
    label: "One special character",
    test: (value) => /[^A-Za-z0-9]/.test(value),
  },
];

function isValidPassword(password) {
  return PASSWORD_REQUIREMENTS.every((requirement) =>
    requirement.test(password)
  );
}

function AuthPage() {
  const [mode, setMode] = useState("login");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [rememberMe, setRememberMe] = useState(false);

  const switchMode = (nextMode) => {
    setMode(nextMode);
    setError("");
    setMessage("");
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!supabase || !isSupabaseConfigured) {
      setError("Supabase is not configured yet. Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to frontend/.env.");
      return;
    }

    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (mode === "signup") {
        if (!fullName.trim()) {
          throw new Error("Please enter your full name.");
        }

        if (!isValidPassword(password)) {
          throw new Error(
            "Password must be at least 8 characters and include an uppercase letter, lowercase letter, number, and special character."
          );
        }

        const { data, error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { full_name: fullName.trim() },
          },
        });

        if (signUpError) throw signUpError;
        
        if (data.session) {
          setMessage("Account created. Welcome to JobWise AI.");
        } else {
          setMessage("Account created. Check your email to confirm your account before signing in."
            );
        }
      } else {
        clearAuthStorage()  ;
        setAuthPersistence(rememberMe);

        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (signInError) throw signInError;
      }
    } catch (err) {
      setError(formatAuthError(err, mode === "signup" ? "sign up" : "log in"));
    } finally {
      setBusy(false);
    }
  };

  const continueWithGoogle = async () => {
    if (!supabase || !isSupabaseConfigured) {
      setError("Supabase is not configured yet. Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to frontend/.env.");
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");

    clearAuthStorage();
    setAuthPersistence(rememberMe);

    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });

    if (oauthError) {
      setError(formatAuthError(oauthError, "Google sign-in"));
      setBusy(false);
    }
  };

  const resetPassword = async () => {
    if (!supabase || !isSupabaseConfigured) {
      setError("Supabase is not configured yet. Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to frontend/.env.");
      return;
    }
    if (!email.trim()) {
      setError("Enter your email address first, then click Forgot password?.");
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: window.location.origin,
      });
      if (resetError) throw resetError;
      setMessage("Password reset email sent. Check your inbox.");
    } catch (err) {
      setError(formatAuthError(err, "password reset"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-topbar">
        <div className="auth-topbar-spacer" />
        {/* <div className="auth-topbar-label">JobWise AI</div> */}
        <div className="auth-topbar-spacer" />
      </div>
      <div className="auth-card-shell">
        <section className="auth-visual" aria-label="JobWise AI overview">
          <div className="auth-visual-top">
            <Logo />
            <span className="auth-pill"><span className="auth-pill-dot" /> AI-POWERED JOB DISCOVERY</span>
          </div>
          <div className="auth-visual-copy">
            <span className="eyebrow">YOUR NEXT OPPORTUNITY</span>
            <h1>Find the right job <span>faster.</span></h1>
            <p>Discover relevant opportunities with AI-powered matching, intelligent search, and personalized filters.</p>
            <div className="auth-preview-stack">
              <div className="auth-preview-card main-preview">
                <div className="auth-preview-icon"><SparkleIcon /></div>
                <div className="auth-preview-copy"><span>PERSONALIZED MATCH</span><strong>Data Analyst</strong><small>91% match · 7/8 skills</small></div>
                <div className="auth-preview-badge">91%</div>
              </div>
              <div className="auth-preview-card ask-preview">
                <div className="auth-preview-icon small"><TripleSparkles /></div>
                <div className="auth-preview-copy"><strong>Ask AI</strong><small>Suitability · gaps · preparation</small></div>
              </div>
            </div>
          </div>
          <div className="auth-trust">✦ Personalized matching &nbsp;·&nbsp; Private profile &nbsp;·&nbsp; AI-assisted decisions</div>
        </section>

        <section className="auth-card">
          <div className="auth-tabs" role="tablist" aria-label="Authentication">
            <button type="button" className={mode === "login" ? "active" : ""} onClick={() => switchMode("login")}>Log in</button>
            <button type="button" className={mode === "signup" ? "active" : ""} onClick={() => switchMode("signup")}>Sign up</button>
          </div>

          <div className="auth-copy">
            <span className="section-kicker">{mode === "login" ? "WELCOME BACK" : "GET STARTED"}</span>
            <h2>{mode === "login" ? "Welcome back." : "Create your account."}</h2>
            <p>{mode === "login" ? "Sign in to continue your job search and saved opportunities." : "Create a profile so your matches, saved jobs and AI tools can stay with you."}</p>
          </div>

          <button type="button" className="social-auth-button" onClick={continueWithGoogle} disabled={busy}>
            <FcGoogle size={22} />
            <span className="social-auth-label">Continue with Google</span>
          </button>

          <div className="auth-divider"><span>OR CONTINUE WITH EMAIL</span></div>

          <form onSubmit={submit} className="auth-form">
            {mode === "signup" && (
              <label className="auth-field">
                <span>Full name</span>
                <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your name" autoComplete="name" />
              </label>
            )}
            <label className="auth-field">
              <span>Email address</span>
              <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="you@example.com" autoComplete="email" required />
            </label>

            <label className="auth-field">
              <span>Password</span>

              <div className="auth-password-wrap">
                <input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type={showPassword ? "text" : "password"}
                  placeholder={mode === "signup" ? "Create a password" : "Enter your password"}
                  autoComplete={
                    mode === "login"
                      ? "current-password"
                      : "new-password"
                  }
                  required
                />

                <button
                  type="button"
                  className="auth-password-toggle"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowPassword((visible) => !visible)}
                >
                  <EyeIcon hidden={showPassword} />
                </button>
              </div>

              {mode === "signup" && (
                <div className="password-requirements">
                  {PASSWORD_REQUIREMENTS.map((requirement) => {
                    const passed = requirement.test(password);

                    return (
                      <div
                        key={requirement.label}
                        className={`password-requirement ${passed ? "passed" : ""}`}
                      >
                        <span className="password-requirement-icon">
                          {passed ? "✓" : "○"}
                        </span>
                        <span>{requirement.label}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </label>

            {mode === "login" && (
              <div className="auth-support-row">
                <label className="auth-remember">
                  <input 
                    type="checkbox" 
                    checked={rememberMe} 
                    onChange={(e) => setRememberMe(e.target.checked)} 
                  />
                  <span>Remember me</span>
                </label>

                <button 
                  type="button" 
                  className="auth-link-button"
                  onClick={resetPassword}
                >
                  Forgot password?
                </button>
              </div>
            )}

            <button type="submit" className="auth-primary" disabled={busy}>
              {busy ? "Please wait…" : mode === "login" ? "Log in" : "Create account"}<ArrowUpRight />
            </button>
          </form>

          {message && <div className="auth-feedback success">{message}</div>}
          {error && <div className="auth-feedback error">{error}</div>}

          <p className="auth-note">
            {mode === "login" ? "New to JobWise AI? " : "Already have an account? "}
            <button type="button" onClick={() => switchMode(mode === "login" ? "signup" : "login")}>
              {mode === "login" ? "Create an account" : "Log in"}
            </button>
          </p>
          <p className="auth-legal">By continuing, you agree to the JobWise AI Terms and Privacy Policy.</p>
        </section>
      </div>
    </div>
  );
}


function PasswordResetPage({ onComplete }) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const submit = async (event) => {
    event.preventDefault();
    if (!supabase) {
      setError("Supabase is not configured yet.");
      return;
    }

    if (!isValidPassword(password)) {
      setError(
        "Password must be at least 8 characters and include an uppercase letter, lowercase letter, number, and special character."
      );
      return;
    }

    if (password !== confirmPassword) {
      setError("The passwords do not match.");
      return;
    }

    setBusy(true);
    setError("");
    setMessage("");
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      setMessage("Your password has been updated. You can now log in with your new password.");
      setPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError(formatAuthError(err, "password update"));
    } finally {
      setBusy(false);
    }
  };

  const finish = async () => {
    try {
      sessionStorage.removeItem("jobwise-password-recovery");
      if (supabase) await supabase.auth.signOut();
    } finally {
      onComplete();
    }
  };

  return (
    <div className="auth-page reset-page">
      <div className="auth-card-shell reset-card-shell">
        <section className="auth-visual" aria-label="Password reset">
          <div className="auth-visual-top">
            <Logo />
            <span className="auth-pill"><span className="auth-pill-dot" /> SECURE ACCOUNT RECOVERY</span>
          </div>
          <div className="auth-visual-copy">
            <span className="eyebrow">ALMOST THERE</span>
            <h1>
              Set a new{" "}
              <span className="reset-password-highlight">password</span>{" "}
              that keeps your account <span className="reset-secure-highlight">secure.</span>
            </h1>
            <p>Choose a strong password for your JobWise AI account and continue your job search.</p>
          </div>
          <div className="auth-trust">✦ Secure account access &nbsp;·&nbsp; Private profile &nbsp;·&nbsp; JobWise AI</div>
        </section>

        <section className="auth-card">
          <div className="auth-copy">
            <span className="section-kicker">RESET PASSWORD</span>
            <h2>Create a new password.</h2>
            <p>Use a new password you have not used before.</p>
          </div>

          <form onSubmit={submit} className="auth-form">
          
          <label className="auth-field">
            <span>New password</span>

            <div className="auth-password-wrap">
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type={showPassword ? "text" : "password"}
                placeholder="Enter your new password"
                autoComplete="new-password"
                required
              />

              <button
                type="button"
                className="auth-password-toggle"
                aria-label={showPassword ? "Hide password" : "Show password"}
                onClick={() => setShowPassword((visible) => !visible)}
              >
                <EyeIcon hidden={showPassword} />
              </button>
            </div>

            <div className="password-requirements">
              {PASSWORD_REQUIREMENTS.map((requirement) => {
                const passed = requirement.test(password);

                return (
                  <div
                    key={requirement.label}
                    className={`password-requirement ${
                      passed ? "passed" : ""
                    }`}
                  >
                    <span className="password-requirement-icon">
                      {passed ? "✓" : "○"}
                    </span>

                    <span>{requirement.label}</span>
                  </div>
                );
              })}
            </div>
          </label>

            <label className="auth-field">
              <span>Confirm password</span>
              <div className="auth-password-wrap">
                <input
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  type={showConfirm ? "text" : "password"}
                  placeholder="Re-enter your new password"
                  autoComplete="new-password"
                  required
                  minLength={6}
                />
                <button type="button" className="auth-password-toggle" aria-label={showConfirm ? "Hide password" : "Show password"} onClick={() => setShowConfirm((visible) => !visible)}>
                  <EyeIcon hidden={showConfirm} />
                </button>
              </div>
            </label>

            <button type="submit" className="auth-primary" disabled={busy}>
              {busy ? "Updating…" : "Update password"}<ArrowUpRight />
            </button>

            <div className="reset-security-note">
              Your password is securely updated through your JobWise AI account.
            </div>

          </form>

          {message && <div className="auth-feedback success">{message}</div>}
          {error && <div className="auth-feedback error">{error}</div>}

          {message && (
            <button type="button" className="reset-finish-button" onClick={finish}>
              Continue to login
            </button>
          )}
        </section>
      </div>
    </div>
  );
}


function SavedJobsView({ savedJobs, onBack, onOpenJob, onRemove }) {
  return (
    <div className="saved-page">
      <div className="saved-page-shell">
        <div className="saved-page-header">
          <div>
            <button type="button" className="saved-back-button" onClick={onBack}>← Back to Jobs</button>
            <h1>Your saved opportunities</h1>
            <p>{savedJobs.length ? `${savedJobs.length} saved ${savedJobs.length === 1 ? "role" : "roles"}. Pick up where you left off.` : "Save jobs from anywhere in the app and they will all appear here."}</p>
          </div>
          <div className="saved-count-badge">{savedJobs.length}</div>
        </div>

        {savedJobs.length === 0 ? (
          <section className="saved-empty-state">
            <div className="saved-empty-icon">♡</div>
            <h2>No saved jobs yet</h2>
            <p>Tap the heart on any job card, recommendation, or job details page to keep it here.</p>
            <button type="button" className="saved-browse-button" onClick={onBack}>Browse jobs <span className="saved-browse-icon">↗</span></button>
          </section>
        ) : (
          <section className="saved-page-list">
            {savedJobs.map((job) => {
              const skills = (job.ai_enriched && Array.isArray(job.ai_skills) && job.ai_skills.length
                ? job.ai_skills
                : String(job.skills || "").split(",").map((v) => v.trim()).filter(Boolean)
              ).slice(0, 6);

              return (
                <article
                  className="saved-page-card"
                  key={job.job_id}
                  tabIndex={0}
                  onClick={() => onOpenJob(job.job_id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onOpenJob(job.job_id);
                    }
                  }}
                >
                  <div className="saved-page-card-head">
                    <div className="company-avatar">
                      <CompanyAvatar thumbnail={job.thumbnail} companyName={job.company_name} />
                    </div>
                    <div className="job-card-heading">
                      <h3>{job.title}</h3>
                      <p>{job.company_name || "Company not listed"}</p>
                    </div>
                    <button
                      type="button"
                      className="save-icon-button saved"
                      onClick={(event) => {
                        event.stopPropagation();
                        onRemove(job);
                      }}
                      aria-label="Remove saved job"
                    >
                      ♥
                    </button>
                  </div>

                  <div className="job-meta">
                    <span>⌖ {job.location || "Location not listed"}</span>
                    <span>◷ {job.employment_type || "Flexible"}</span>
                    {job.domain && <span>{job.domain}</span>}
                  </div>

                  <div className="skill-chips">
                    {skills.map((skill) => <span key={skill}>{skill}</span>)}
                    {((job.skills || "").split(",").filter(Boolean).length > skills.length) && <span>More skills</span>}
                  </div>

                  <div className="saved-page-card-footer">
                    <span className="saved-source-label">Saved role</span>
                    <button type="button" className="view-job-button" onClick={(event) => { event.stopPropagation(); onOpenJob(job.job_id); }}>
                      View job <span className="view-job-icon"><ArrowUpRight /></span>
                    </button>
                  </div>
                </article>
              );
            })}
          </section>
        )}
      </div>
    </div>
  );
}

function JobBoardApp({ session, onSignOut }) {
  const cachedJobs = loadCachedJobs();

  const [jobs, setJobs] = useState(cachedJobs.jobs);
  const [totalJobs, setTotalJobs] = useState(cachedJobs.total);
  const [overallJobsTotal, setOverallJobsTotal] = useState(cachedJobs.overallTotal);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [source, setSource] = useState("");
  const [selectedSkills, setSelectedSkills] = useState([]);
  const [selectedLocations, setSelectedLocations] = useState([]);
  const [selectedDomains, setSelectedDomains] = useState([]);
  const [selectedExperience, setSelectedExperience] = useState("");
  const [filterOptions, setFilterOptions] = useState(() => loadFilterCache() || { sources: [], skills: [], domains: [], roleTitles: [] });
  const [hasMoreJobs, setHasMoreJobs] = useState(false);
  const [jobsError, setJobsError] = useState("");
  const [roleMenuOpen, setRoleMenuOpen] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [sortMode, setSortMode] = useState("az");
  const [postedWindow, setPostedWindow] = useState("");
  const [filterLoading, setFilterLoading] = useState(() => !loadFilterCache());
  const [selectedJobId, setSelectedJobId] = useState(null);
  const [savedView, setSavedView] = useState(false);
  // Resume matches are session-only. A hard browser reload should start fresh.
  const [resumeMatches, setResumeMatches] = useState([]);
  const [resumeProfile, setResumeProfile] = useState(null);
  const [savedJobs, setSavedJobs] = useState(() => loadSavedJobs());
  const [heroPreview] = useState(() => {
    const options = [
      { title: "Senior Data Scientist", skills: ["Python", "SQL", "ML"], matched: "8/9", score: 94 },
      { title: "Data Analyst", skills: ["SQL", "Python", "Power BI"], matched: "7/8", score: 91 },
      { title: "Machine Learning Engineer", skills: ["Python", "TensorFlow", "AWS"], matched: "8/10", score: 92 },
      { title: "Business Analyst", skills: ["SQL", "Tableau", "Excel"], matched: "7/8", score: 89 },
      { title: "Product Analyst", skills: ["SQL", "Python", "Tableau"], matched: "8/9", score: 93 },
    ];
    return options[Math.floor(Math.random() * options.length)];
  });

  useEffect(() => {
    setSavedJobs(loadSavedJobs());
  }, [selectedJobId]);

  const activeFilterCount = (source ? 1 : 0) + selectedSkills.length + selectedLocations.length + selectedDomains.length + (selectedExperience ? 1 : 0) + (postedWindow ? 1 : 0);

  const isSaved = (jobId) => savedJobs.some((job) => job.job_id === jobId);

  const toggleSaveJob = (job) => {
    if (!job?.job_id) return;
    setSavedJobs((previous) => {
      const exists = previous.some((item) => item.job_id === job.job_id);
      const next = exists
        ? previous.filter((item) => item.job_id !== job.job_id)
        : [job, ...previous];
      persistSavedJobs(next);
      return next;
    });
  };
  const clearAll = () => {
    setSource("");
    setSelectedSkills([]);
    setSelectedLocations([]);
    setSelectedDomains([]);
    setSelectedExperience("");
    setPostedWindow("");
  };

  const scrollTo = (id) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });

  const fetchJobs = async ({ append = false, postedWindowOverride = null } = {}) => {
    if (append) {
      setLoadingMore(true);
    } else if (jobs.length === 0) {
      setLoading(true);
    }

    const offset = append ? jobs.length : 0;
    const params = new URLSearchParams();
    if (searchTerm.trim()) params.append("search", searchTerm.trim());
    if (source) params.append("source", source);
    selectedSkills.forEach((v) => params.append("skill", v));
    selectedLocations.forEach((v) => params.append("location", v));
    selectedDomains.forEach((v) => params.append("domain", v));
    if (selectedExperience) params.append("experience", selectedExperience);
    const activePostedWindow = postedWindowOverride !== null ? postedWindowOverride : postedWindow;
    if (activePostedWindow) params.append("posted_window", activePostedWindow);
    params.append("limit", "20");
    params.append("offset", String(offset));

    try {
      setJobsError("");
      const response = await fetch(`${API_BASE_URL}/api/jobs?${params.toString()}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Failed to fetch jobs");
      const nextJobs = Array.isArray(data.jobs) ? data.jobs : [];
      setJobs((prev) => append ? [...prev, ...nextJobs] : nextJobs);
      if (
        !append &&
        !searchTerm.trim() &&
        !source &&
        selectedSkills.length === 0 &&
        selectedLocations.length === 0 &&
        selectedDomains.length === 0 &&
        !selectedExperience &&
        !activePostedWindow
      ) {
        saveCachedJobs(
          nextJobs,
          Number(data.total || 0),
          Number(data.total_all || data.total || 0)
        );
      }
      setTotalJobs(Number(data.total || 0));
      if (!append && !searchTerm.trim() && !source && selectedSkills.length === 0 && selectedLocations.length === 0 && selectedDomains.length === 0 && !selectedExperience) {
        setOverallJobsTotal(Number(data.total_all || data.total || 0));
      }
      setHasMoreJobs(Boolean(data.has_more));
    } catch (error) {
      console.error(error);
      setJobsError(error instanceof Error ? error.message : "Failed to load jobs.");
      if (!append && jobs.length === 0) {
        setJobs([]);
        setTotalJobs(0);
      }
      setHasMoreJobs(false);
    } finally {
      if (append) setLoadingMore(false);
      else setLoading(false);
    }
  };

  const fetchFilterOptions = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/jobs/filter-options`);
      const data = await response.json();
      if (!response.ok) throw new Error("Failed to fetch filter options");
      const next = {
        sources: uniqueOptions(data.sources),
        skills: uniqueOptions(data.skills),
        domains: uniqueOptions(data.domains),
        roleTitles: uniqueOptions(data.role_titles || []),
      };
      setFilterOptions(next);
      saveFilterCache(next);
    } catch (error) {
      console.error(error);
    } finally {
      setFilterLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
    fetchFilterOptions();
  }, []);

  useEffect(() => {
    if (!roleMenuOpen) return;
    const handlePointerDown = (event) => {
      const target = event.target;
      if (!target.closest(".role-combobox")) setRoleMenuOpen(false);
    };
    const handleKeyDown = (event) => {
      if (event.key === "Escape") setRoleMenuOpen(false);
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [roleMenuOpen]);

  const filteredRoleTitles = buildRoleSuggestions(filterOptions.roleTitles || [], searchTerm);

  const parsePostedDate = (job) => {
    const raw = job?.posted_at || job?.date_posted || job?.published_at || job?.created_at || job?.updated_at;
    if (!raw) return null;
    const date = new Date(raw);
    return Number.isNaN(date.getTime()) ? null : date.getTime();
  };

  const sortedJobs = [...jobs].sort((a, b) => {
    if (sortMode === "az") return String(a.title || "").localeCompare(String(b.title || ""));
    if (sortMode === "za") return String(b.title || "").localeCompare(String(a.title || ""));
    if (sortMode === "recent") return (parsePostedDate(b) || 0) - (parsePostedDate(a) || 0);
    if (sortMode === "24h" || sortMode === "7d" || sortMode === "30d") {
      const windowMs = sortMode === "24h" ? 24*60*60*1000 : sortMode === "7d" ? 7*24*60*60*1000 : 30*24*60*60*1000;
      const cutoff = Date.now() - windowMs;
      return (parsePostedDate(b) || 0) - (parsePostedDate(a) || 0);
    }
    return 0;
  });

  if (selectedJobId) return <JobDetails jobId={selectedJobId} profile={resumeProfile} onBack={() => setSelectedJobId(null)} />;
  if (savedView) {
    return (
      <div className="job-board">
        <header className="site-header">
          <button type="button" className="brand-button" onClick={() => { setSavedView(false); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
            <Logo />
          </button>
          <nav className="main-nav" aria-label="Primary navigation">
            <button type="button" onClick={() => setSavedView(false)}>Jobs</button>
            <button type="button" onClick={() => { setSavedView(false); setTimeout(() => scrollTo("resume"), 0); }}>My Matches</button>
            <button type="button" onClick={() => { setSavedView(false); setTimeout(() => scrollTo("assistant"), 0); }}>AI Assistant</button>
            <button type="button" className="nav-active" onClick={() => setSavedView(true)}>Saved</button>
          </nav>
          <div className="header-actions">
            <div className="signed-in-profile" title={session?.user?.email || "Signed in"}>
              <span className="signed-in-avatar"><UserCircleIcon /></span>
              <span className="signed-in-email">{session?.user?.email || "Signed in"}</span>
            </div>
            <button type="button" className="logout-button" onClick={onSignOut}>Log out</button>
          </div>
        </header>
        <SavedJobsView
          savedJobs={savedJobs}
          onBack={() => setSavedView(false)}
          onOpenJob={setSelectedJobId}
          onRemove={toggleSaveJob}
        />
      </div>
    );
  }

  const handleResumeRecommendations = (recommendations, profile) => {
    const safeRecommendations = Array.isArray(recommendations) ? recommendations : [];
    const safeProfile = profile || null;
    setResumeMatches(safeRecommendations);
    setResumeProfile(safeProfile);
    setTimeout(() => scrollTo("resume-matches"), 50);
  };

  const dismissResumeMatches = () => {
    setResumeMatches([]);
    setResumeProfile(null);
    setTimeout(() => scrollTo("jobs"), 50);
  };

  return (
    <div className="job-board">
      <header className="site-header">
        <button type="button" className="brand-button" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
          <Logo />
        </button>
        <nav className="main-nav" aria-label="Primary navigation">
          <button type="button" onClick={() => scrollTo("jobs")}>Jobs</button>
          <button type="button" onClick={() => scrollTo(resumeMatches.length ? "resume-matches" : "resume")}>My Matches</button>
          <button type="button" onClick={() => scrollTo("assistant")}>AI Assistant</button>
          <button type="button" onClick={() => setSavedView(true)}>Saved{savedJobs.length > 0 ? ` (${savedJobs.length})` : ""}</button>
        </nav>
        <div className="header-actions">
            <div className="signed-in-profile" title={session?.user?.email || "Signed in"}>
              <span className="signed-in-avatar"><UserCircleIcon /></span>
              <span className="signed-in-email">{session?.user?.email || "Signed in"}</span>
            </div>
            <button type="button" className="logout-button" onClick={onSignOut}>Log out</button>
          </div>
      </header>

      <main>
        <section className="hero-shell">
          <div className="hero-content">
            <span className="eyebrow">AI-POWERED JOB DISCOVERY</span>
            <h1>Find the right job <span>faster.</span></h1>
            <p className="hero-description">
              Discover relevant opportunities with AI-powered matching, intelligent search, and personalized filters.
            </p>

            <form
              className="hero-search"
              onSubmit={(e) => {
                e.preventDefault();
                scrollTo("jobs");
                fetchJobs();
              }}
            >
              <div className={`hero-search-field role-search-field role-combobox ${roleMenuOpen ? "is-open" : ""}`}>
                <SearchIcon />
                <input
                  value={searchTerm}
                  onFocus={() => setRoleMenuOpen(true)}
                  onChange={(e) => { setSearchTerm(e.target.value); setRoleMenuOpen(true); }}
                  placeholder="What role are you looking for?"
                  aria-label="What role are you looking for?"
                  aria-expanded={roleMenuOpen}
                  aria-controls="role-suggestions"
                />
                <button
                  type="button"
                  className="role-combobox-toggle"
                  onClick={() => setRoleMenuOpen((v) => !v)}
                  aria-label="Show role suggestions"
                  aria-expanded={roleMenuOpen}
                >
                  <ChevronDown />
                </button>
                {roleMenuOpen && (
                  <div className="role-suggestion-menu" id="role-suggestions">
                    <div className="role-suggestion-head">
                      <strong>Choose a role or type your own</strong>
                    </div>
                    <div className="role-suggestion-list">
                      {filteredRoleTitles.length ? filteredRoleTitles.map((role) => (
                        <button
                          key={role}
                          type="button"
                          className="role-suggestion-item"
                          onClick={() => { setSearchTerm(role); setRoleMenuOpen(false); }}
                        >
                          {role}
                        </button>
                      )) : (
                        <div className="role-suggestion-empty">No matching role suggestions. You can still type your own search term.</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
              <button type="submit" className="hero-search-button">
                Find jobs
                <ArrowUpRight />
              </button>
            </form>

            <div className="hero-suggested">
              <span>Popular:</span>
              {['Data Analyst', 'Data Scientist', 'Software Engineer'].map((role) => (
                <button
                  key={role}
                  type="button"
                  onClick={() => {
                    setSearchTerm(role);
                    scrollTo("jobs");
                    setTimeout(fetchJobs, 0);
                  }}
                >
                  {role}
                </button>
              ))}
            </div>
          </div>

          <div className="hero-visual" aria-hidden="true">
            <div className="hero-orb" />
            <div className="match-card-preview match-card-preview-centered">
              <div className="preview-top">
                <span className="preview-logo"><Logo compact /></span>
                <span className="preview-match">{heroPreview.score}% match</span>
              </div>
              <strong>{heroPreview.title}</strong>
              <small>AI-powered match preview</small>
              <div className="preview-chips">{heroPreview.skills.map((skill) => <span key={skill}>{skill}</span>)}</div>
              <div className="preview-bottom"><span>{heroPreview.matched} skills matched</span></div>
            </div>
          </div>
        </section>

        <section className="stat-strip">
          <div><strong>{compactJobCount(overallJobsTotal)}</strong><span>jobs indexed</span></div>
          <div><strong>AI</strong><span>resume matching</span></div>
          <div><strong>Smart</strong><span>location search</span></div>
          <div><strong>Live</strong><span>job browsing</span></div>
        </section>

        <section className="job-workspace" id="jobs">
          <aside className="filter-rail" aria-label="Job filters">
            <div className="filter-rail-card">
              <div className="filter-rail-heading">
                <div>
                  <span className="section-kicker">EXPLORE</span>
                  <h2>Opportunities</h2>
                  <p>Refine the jobs shown in the center.</p>
                </div>
                {activeFilterCount > 0 && <span className="filter-count-badge">{activeFilterCount}</span>}
              </div>

              <div className="filter-stack">
                <div className="filter-stack-label">Source</div>
                <div className="filter-select-wrap">
                  <select
                    className="filter-control filter-control-block filter-select-right"
                    value={source}
                    onChange={(e) => setSource(e.target.value)}
                    aria-label="Filter by source"
                  >
                    <option value="">{filterLoading ? "Loading sources..." : "All sources"}</option>
                    {filterOptions.sources.map((item) => <option key={item} value={item}>{item}</option>)}
                  </select>
                  <ChevronRight />
                </div>

                <div className="filter-stack-label">Skills</div>
                <MultiSelectDropdown label="All skills" options={filterOptions.skills} selectedValues={selectedSkills} onChange={setSelectedSkills} />

                <div className="filter-stack-label">Location</div>
                <LocationDropdown selectedValues={selectedLocations} onChange={setSelectedLocations} allowRemote />

                <div className="filter-stack-label">Experience</div>
                <div className="filter-select-wrap">
                  <select className="filter-control filter-control-block filter-select-right" value={selectedExperience} onChange={(e) => setSelectedExperience(e.target.value)} aria-label="Filter by experience">
                    <option value="">Any experience</option>
                    <option value="fresher">Fresher</option>
                    <option value="0-1">0–1 years</option>
                    <option value="1-2">1–2 years</option>
                    <option value="2-3">2–3 years</option>
                    <option value="3-5">3–5 years</option>
                    <option value="5+">5+ years</option>
                  </select>
                  <ChevronRight />
                </div>

                <div className="filter-stack-label">Domain</div>
                <MultiSelectDropdown label="All domains" options={filterOptions.domains} selectedValues={selectedDomains} onChange={setSelectedDomains} />
              </div>

              <div className="filter-actions">
                <button type="button" className="filter-apply-button" onClick={fetchJobs}>Apply filters</button>
                {activeFilterCount > 0 && <button type="button" className="filter-clear-button" onClick={clearAll}>Clear all</button>}
              </div>
            </div>
          </aside>

          <section className="workspace-main">
            {resumeMatches.length > 0 && (
              <section className="resume-matches-center" id="resume-matches">
                <div className="workspace-heading resume-match-heading">
                  <div>
                    <span className="section-kicker">YOUR RESUME MATCH</span>
                    <h2>Jobs picked for you.</h2>
                    <p>{Math.min(6, resumeMatches.length)} personalized matches based on your resume.</p>
                  </div>
                  <button type="button" className="resume-match-dismiss" onClick={dismissResumeMatches} aria-label="Close resume recommendations" title="Close resume recommendations">×</button>
                  {resumeProfile?.skills?.length > 0 && (
                    <div className="resume-profile-mini">
                      {resumeProfile.skills.slice(0, 4).map((skill) => <span key={skill}>{skill}</span>)}
                    </div>
                  )}
                </div>

                <div className="resume-match-grid">
                  {resumeMatches.slice(0, 6).map((job) => {
                    const skills = String(job.skills || "").split(",").map((v) => v.trim()).filter(Boolean).slice(0, 4);
                    return (
                      <article
                        key={job.job_id}
                        className="resume-match-card"
                        role="button"
                        tabIndex={0}
                        onClick={() => setSelectedJobId(job.job_id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setSelectedJobId(job.job_id);
                          }
                        }}
                      >
                        <div className="resume-match-card-head">
                          <div className="company-avatar">
                            <CompanyAvatar thumbnail={job.thumbnail} companyName={job.company_name} />
                          </div>
                          <div className="job-card-heading">
                            <h3>{job.title}</h3>
                            <p>{job.company_name || "Company not listed"}</p>
                          </div>
                          <span className="resume-match-score">{job.match_score}%</span>
                        </div>
                        <div className="job-meta"><span>⌖ {job.location || "Location not listed"}</span><span>◷ {job.employment_type || "Flexible"}</span></div>
                        <div className="skill-chips">{skills.map((skill) => <span key={skill}>{skill}</span>)}</div>
                        <div className="resume-match-card-footer">
                          <span>{job.matched_skills?.length || 0} skills matched</span>
                          <button type="button" className="view-job-button" onClick={(e) => { e.stopPropagation(); setSelectedJobId(job.job_id); }}>
                            View job <span className="view-job-icon"><ArrowUpRight /></span>
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            )}

            <section className="job-results-panel">
              <div className="workspace-heading">
                <div>
                  <span className="section-kicker">JOBS</span>
                  <h2>{resumeMatches.length ? "Explore all opportunities" : "Explore opportunities"}</h2>
                  <p>{loading ? "Finding relevant roles..." : jobsError ? "Unable to load jobs" : `${jobs.length}${totalJobs ? ` of ${totalJobs}` : ""} roles shown`}</p>
                </div>
                <div className="workspace-tools">
                  <label className="sort-control">
                    <span>Sort by</span>
                    <select
                      value={postedWindow ? `posted-${postedWindow}` : sortMode}
                      onChange={(e) => {
                        const value = e.target.value;
                        setPostedWindow("");
                        setSortMode(value === "za" ? "za" : "az");
                        setTimeout(() => fetchJobs(), 0);
                      }}
                    >
                      <option value="az">A–Z</option>
                      <option value="za">Z–A</option>
                    </select>
                  </label>
                </div>
              </div>

              <div className="workspace-query-row">
                <span>{searchTerm.trim() ? <>Searching for <strong>“{searchTerm.trim()}”</strong></> : "Use the left-side filters to refine the jobs."}</span>
                {searchTerm.trim() && <button type="button" onClick={() => { setSearchTerm(""); fetchJobs(); }}>Clear search</button>}
              </div>

              {loading ? (
                <div className="results-loading"><div className="loading-spinner" /><strong>Finding jobs for you...</strong><span>Pulling fresh results from the live job board.</span></div>
              ) : jobs.length === 0 ? (
                <div className="results-empty">
                  <div className="empty-icon">⌕</div>
                  <h3>{jobsError ? "Jobs could not be loaded" : "No matching jobs"}</h3>
                  <p>{jobsError || "Try a broader search or remove a filter."}</p>
                  <button type="button" className="secondary-button" onClick={() => { if (jobsError) fetchJobs(); else clearAll(); }}>{jobsError ? "Try again" : "Clear filters"}</button>
                </div>
              ) : (
                <div className="job-grid">
                  {sortedJobs.map((job) => {
                    const skills = (job.ai_enriched && Array.isArray(job.ai_skills) && job.ai_skills.length ? job.ai_skills : String(job.skills || "").split(",").map((v) => v.trim()).filter(Boolean));
                    const visible = skills.slice(0, 5);
                    const hasScore = Number.isFinite(Number(job.match_score));
                    return (
                      <article className="job-card" key={job.job_id} onClick={() => setSelectedJobId(job.job_id)} tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelectedJobId(job.job_id); } }}>
                        <div className="job-card-head">
                          <div className="company-avatar"><CompanyAvatar thumbnail={job.thumbnail} companyName={job.company_name} /></div>
                          <div className="job-card-heading"><h3>{job.title}</h3><p>{job.company_name || "Company not listed"}</p></div>
                          <button
                            className={`save-icon-button ${isSaved(job.job_id) ? "saved" : ""}`}
                            type="button"
                            onClick={(e) => { e.stopPropagation(); toggleSaveJob(job); }}
                            aria-label={isSaved(job.job_id) ? "Remove saved job" : "Save job"}
                            aria-pressed={isSaved(job.job_id)}
                          >
                            {isSaved(job.job_id) ? "♥" : "♡"}
                          </button>
                        </div>
                        <div className="job-meta"><span>⌖ {job.location || "Location not listed"}</span><span>◷ {job.employment_type || "Flexible"}</span>{job.domain && <span>{job.domain}</span>}</div>
                        <div className="skill-chips">{visible.map((skill) => <span key={skill}>{skill}</span>)}{skills.length > visible.length && <span>{skills.length - visible.length} more</span>}</div>
                        <div className="job-card-footer">
                          <div><span className={`match-badge ${hasScore ? "has-score" : ""}`}>{hasScore ? `${job.match_score}% Match` : "Open role"}</span><small>{hasScore ? `${job.matched_skills?.length || 0} skills matched` : "See full requirements"}</small></div>
                          <button type="button" className="view-job-button" onClick={(e) => { e.stopPropagation(); setSelectedJobId(job.job_id); }}>View job <span className="view-job-icon"><ArrowUpRight /></span></button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}

              {!loading && hasMoreJobs && (
                <div className="load-more-wrap">
                  <button type="button" className="load-more-button" onClick={() => fetchJobs({ append: true })} disabled={loadingMore}>
                    {loadingMore ? "Loading more jobs..." : "Load more jobs"}
                  </button>
                  <span>{jobs.length} of {totalJobs} roles loaded</span>
                </div>
              )}
            </section>
          </section>

          <aside className="tool-rail" aria-label="Job tools">
            <section className="tool-card accent-card" id="resume">
              <div className="tool-card-head"><div className="tool-icon match-tool-icon"><UserCircleIcon /></div></div>
              <span className="section-kicker">YOUR MATCH</span>
              <h3>Get jobs matched to your resume.</h3>
              <p>Upload a PDF once and we'll build a profile for personalized recommendations.</p>
              <ResumeUpload
                onJobSelect={setSelectedJobId}
                onRecommendationsChange={handleResumeRecommendations}
                initialProfile={resumeProfile}
                compact
              />
            </section>

            <section className="tool-card assistant-side" id="assistant">
              <div className="tool-card-head"><div className="tool-icon ai-tool-icon"><TripleSparkles /></div></div>
              <span className="section-kicker">AI ASSISTANT</span>
              <h3>Need help deciding?</h3>
              <p>Ask about a role, your fit, missing skills or interview preparation.</p>
              <JobAssistant
                profile={resumeProfile}
                recommendedJobIds={resumeMatches.slice(0, 6).map((job) => job.job_id).filter(Boolean)}
                filteredJobIds={jobs.map((job) => job.job_id).filter(Boolean)}
                compact
              />
            </section>
          </aside>
        </section>
      </main>

      <footer className="site-footer"><Logo /><span>Your next opportunity starts here.</span></footer>
    </div>
  );
}

export default App;

function AuthLoadingScreen() {
  return (
    <div className="auth-loading-screen">
      <div className="auth-loading-card">
        <Logo />
        <strong>Loading JobWise AI…</strong>
        <span>Checking your session.</span>
      </div>
    </div>
  );
}

function App() {
  const [session, setSession] = useState(undefined);
  const [passwordRecovery, setPasswordRecovery] = useState(
  () => sessionStorage.getItem("jobwise-password-recovery") === "true"
);

  useEffect(() => {
    let mounted = true;
    if (!supabase || !isSupabaseConfigured) {
      setSession(null);
      return undefined;
    }

    supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted) return;
      if (error) console.error("Supabase session error:", error);
      setSession(data?.session || null);
    });

    const { data } = supabase.auth.onAuthStateChange((event, nextSession) => {
    if (event === "PASSWORD_RECOVERY") {
      sessionStorage.setItem("jobwise-password-recovery", "true");
      setPasswordRecovery(true);
    }

    if (event === "SIGNED_OUT") {
      sessionStorage.removeItem("jobwise-password-recovery");
      setPasswordRecovery(false);
    }
      setSession(nextSession || null);
    });

    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, []);

  if (session === undefined) return <AuthLoadingScreen />;
  if (passwordRecovery && session) {
    return <PasswordResetPage onComplete={() => setPasswordRecovery(false)} />;
  }
  if (!session) return <AuthPage />;

  return (
    <JobBoardApp
      session={session}
      onSignOut={async () => {
        if (!supabase) return;
        const { error } = await supabase.auth.signOut();
        if (error) console.error("Supabase sign-out error:", error);
      }}
    />
  );
}
