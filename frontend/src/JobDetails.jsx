import { useEffect, useMemo, useState } from "react";
import JobAssistant from "./JobAssistant";
import { API_BASE_URL } from "./lib/apiConfig";

const SAVED_JOBS_KEY = "ai-job-board-saved-jobs-v1";

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
    // Best effort only.
  }
}

function DetailCompanyAvatar({ thumbnail, initial }) {
  const [failed, setFailed] = useState(false);

  if (!thumbnail || failed) {
    return (
      <span className="company-avatar-fallback">
        {initial}
      </span>
    );
  }

  return (
    <img
      src={thumbnail}
      alt=""
      onError={() => setFailed(true)}
    />
  );
}

function JobWiseLogo() {
  return (
    <div className="jobwise-logo">
      <div className="jobwise-logo-mark">
        <svg viewBox="0 0 44 44" aria-hidden="true">
          <defs>
            <linearGradient
              id="jobwise-details-gradient"
              x1="6"
              y1="4"
              x2="38"
              y2="40"
              gradientUnits="userSpaceOnUse"
            >
              <stop offset="0" stopColor="#8B7CFF" />
              <stop offset="1" stopColor="#6D5DFB" />
            </linearGradient>
          </defs>

          <path
            d="M22 3.8c2.2 9.4 4.8 12 14.2 14.2C26.8 20.2 24.2 22.8 22 32.2 19.8 22.8 17.2 20.2 7.8 18 17.2 15.8 19.8 13.2 22 3.8Z"
            fill="url(#jobwise-details-gradient)"
          />
        </svg>
      </div>

      <div className="jobwise-logo-wordmark">
        <strong>JobWise AI</strong>
        <span>Smarter jobs. Better matches.</span>
      </div>
    </div>
  );
}

function formatJobDescription(description) {
  if (!description) return [];

  const headings = [
    "Company Description",
    "Role Description",
    "Key Responsibilities",
    "Responsibilities",
    "Requirements",
    "Essential Requirements",
    "Desirable Requirements",
    "Preferred Qualifications",
    "Qualifications",
    "Benefits",
    "How to Apply",
    "About the Company",
    "About the Role",
    "Job Description",
    "What You'll Do",
    "What We're Looking For",
  ];

  const escapeRegex = (value) =>
    value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  const headingRegex = new RegExp(
    `(${headings.map(escapeRegex).join("|")})\\s*:?(?=\\s|$)`,
    "gi"
  );

  let normalized = String(description)
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/[•●▪◦]/g, "\n• ")
    .trim();

  // Force known headings onto their own lines,
  // even when the source text has them stuck together.
  normalized = normalized.replace(headingRegex, "\n\n$1\n");

  // Separate common bullet-like separators.
  normalized = normalized.replace(
    /\s+(?:•|\-|\*)\s+/g,
    "\n• "
  );

  normalized = normalized
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const lines = normalized
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const sections = [];
  let current = null;

  const isHeading = (line) =>
    new RegExp(
      `^(${headings.map(escapeRegex).join("|")})\\s*:?$`,
      "i"
    ).test(line);

  lines.forEach((line) => {
    if (isHeading(line)) {
      current = {
        heading: line.replace(/:$/, ""),
        lines: [],
      };
      sections.push(current);
      return;
    }

    if (!current) {
      current = {
        heading: null,
        lines: [],
      };
      sections.push(current);
    }

    current.lines.push(line);
  });

  return sections;
}

function JobDetails({ jobId, onBack, profile = null }) {
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(() => loadSavedJobs().some((item) => item.job_id === jobId));

  useEffect(() => {
    if (!jobId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    fetch(`${API_BASE_URL}/api/jobs/${jobId}`)
      .then((response) => {
        if (!response.ok) throw new Error("Job not found");
        return response.json();
      })
      .then((data) => setJob(data))
      .catch((requestError) => {
        console.error("Failed to fetch job:", requestError);
        setError(requestError.message || "Unable to load this job.");
      })
      .finally(() => setLoading(false));
  }, [jobId]);

  const descriptionSections = useMemo(
    () => formatJobDescription(job?.description),
    [job?.description]
  );
  
  const applyOptions = useMemo(() => {
    if (Array.isArray(job?.apply_options)) return job.apply_options;
    if (typeof job?.apply_options === "string") {
      try {
        const parsed = JSON.parse(job.apply_options);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    return [];
  }, [job]);

  const skills = useMemo(() => {
    if (!job) return [];
    const source = job.ai_enriched && Array.isArray(job.ai_skills) && job.ai_skills.length
      ? job.ai_skills
      : String(job.skills || "").split(",");
    return [...new Set(source.map((item) => String(item).trim()).filter(Boolean))];
  }, [job]);

  const roles = useMemo(() => {
    if (!job) return [];
    if (job.ai_enriched && Array.isArray(job.ai_roles) && job.ai_roles.length) return job.ai_roles;
    return String(job.roles || "").split(",").map((item) => item.trim()).filter(Boolean);
  }, [job]);

  const tags = useMemo(() => {
    if (!job || !Array.isArray(job.ai_tags)) return [];
    return job.ai_tags;
  }, [job]);

  if (loading) {
    return (
      <div className="detail-page detail-state">
        <div className="detail-loading-card"><div className="loading-spinner" /><strong>Loading job details...</strong><span>Preparing the full role for you.</span></div>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="detail-page detail-state">
        <div className="detail-error-card">
          <div className="empty-icon">!</div>
          <h2>{error || "Job not found"}</h2>
          <p>We couldn't load this opportunity.</p>
          <button className="detail-error-back" type="button" onClick={onBack}>Back to Jobs</button>
        </div>
      </div>
    );
  }

  const companyInitial = String(job.company_name || "?").charAt(0).toUpperCase();
  const minExp = job.min_experience;
  const maxExp = job.max_experience;
  const experience = minExp == null && maxExp == null
    ? "Experience not listed"
    : `${minExp ?? maxExp}+${maxExp && maxExp !== minExp ? ` years (up to ${maxExp})` : " years"}`;

  return (
    <div className="detail-page">
      <header className="detail-nav">
        <button type="button" className="detail-back" onClick={onBack}>
          ← Back to Jobs
        </button>

        <div className="detail-brand">
          <JobWiseLogo />
        </div>

        <button
          type="button"
          className={`detail-save ${saved ? "saved" : ""}`}
          onClick={() => {
            setSaved((current) => {
              const existing = loadSavedJobs();
              const next = current
                ? existing.filter((item) => item.job_id !== job.job_id)
                : [job, ...existing.filter((item) => item.job_id !== job.job_id)];
              
                persistSavedJobs(next);
              return !current;
            });
          }}
          aria-pressed={saved}
        >
          <span className="detail-save-icon">{saved ? "♥" : "♡"}</span>
          <span>{saved ? "Saved" : "Save job"}</span>
        </button>
      </header>

      <main className="detail-container">
        <section className="detail-hero">
          <div className="detail-company-avatar">
            <DetailCompanyAvatar 
              thumbnail={job.thumbnail} 
              initial={companyInitial} 
            />
          </div>

          <div className="detail-hero-copy">
            <div className="detail-badges">
              <span className="detail-source-badge">
                {job.source || "Other"}
              </span>

              {job.ai_enriched && (
                <span className="detail-ai-badge">AI enriched</span>
              )}
            </div>

            <h1>{job.title}</h1>

            <p className="detail-company">
              {job.company_name || "Company not listed"}
            </p>

            <div className="detail-meta-line">
              <span>⌖ {job.location || "Location not listed"}</span>
              <span>◷ {job.employment_type || "Flexible"}</span>
              <span>{job.domain || "General"}</span>
            </div>
          </div>
        </section>

        <div className="detail-layout">
          <div className="detail-main-column">
            <section className="detail-card">
              <div className="detail-card-heading">
                <span>ABOUT THE JOB</span>
              </div>

              <div className="detail-description">
                {descriptionSections.length > 0 ? (
                  descriptionSections.map((section, index) => (
                    <div
                      className={`detail-description-section ${
                        section.heading ? "" : "detail-description-intro"
                      }`}
                      key={`${section.heading || "intro"}-${index}`}
                    >
                      {section.heading && (
                        <h3 className="detail-description-heading">
                          {section.heading}
                        </h3>
                      )}

                      <div className="detail-description-content">
                        {section.lines.map((line, lineIndex) => (
                          <p key={lineIndex}>{line}</p>
                        ))}
                      </div>
                    </div>
                  ))
                ) : (
                  <p>No description available.</p>
                )}
              </div>
            </section>

            <section className="detail-card">
              <div className="detail-card-heading">
                <span>REQUIREMENTS</span>
                <strong>{skills.length} skills</strong>
              </div>

              <div className="detail-chip-grid">
                {skills.length > 0 ? (
                  skills.map((skill) => <span key={skill}>{skill}</span>) 
                ): (
                  <p className="detail-muted">Skills not listed.</p>
                )}
              </div>
            </section>

            {roles.length > 0 && (
              <section className="detail-card">
                <div className="detail-card-heading">
                  <span>RELATED ROLES</span>
                </div>

                <div className="detail-chip-grid subtle-chips">
                  {roles.slice(0, 10).map((role) => <span key={role}>{role}</span>)}
                </div>
              </section>
            )}

            {tags.length > 0 && (
              <section className="detail-card">
                <div className="detail-card-heading">
                  <span>AI DISCOVERY TAGS</span>
                </div>

                <div className="detail-chip-grid subtle-chips">
                  {tags.map((tag) => (
                  <span key={tag}>{tag}</span>
                  ))}
                </div>
              </section>
            )}

          </div>

          <aside className="detail-side-column">
            <div className="apply-card apply-card-light">
              <span className="apply-kicker">YOUR NEXT STEP</span>

              <h2>Ready to explore this role?</h2>

              <p>
                Use the application link below. Keep this page open while you review the requirements.
              </p>

              <div className="apply-actions">
                {applyOptions.length > 0 ? (
                  applyOptions.map((option, index) => (
                  <a 
                    key={index} 
                    href={option.link} 
                    target="_blank" 
                    rel="noreferrer" 
                    className="apply-button"
                  >
                    {option.title || "Apply now"} <span>↗</span>
                  </a>
                  )) 
                ) : (
                  <span className="detail-muted">
                    No application link available.
                  </span>
                )}
              </div>
            </div>

            <div className="snapshot-card">
              <div className="detail-card-heading">
                <span>ROLE SNAPSHOT</span>
              </div>
              
              <dl>
                <div>
                  <dt>Location</dt>
                  <dd>{job.location || "Not listed"}</dd>
                </div>

                <div>
                  <dt>Experience</dt>
                  <dd>{experience}</dd>
                </div>

                <div>
                  <dt>Employment</dt>
                  <dd>{job.employment_type || "Not listed"}</dd>
                </div>
                
                <div>
                  <dt>Domain</dt>
                  <dd>{job.domain || "Not listed"}</dd>
                </div>
                
                <div>
                  <dt>Source</dt>
                  <dd>{job.source || "Other"}</dd>
                </div>
              </dl>
            </div>

            <section className="assistant-detail-side-card">
              <div className="detail-card-heading assistant-side-heading">
                <span>AI ASSISTANT</span>
              </div>

              <h3>Need help understanding this role?</h3>

              <p className="assistant-detail-subtitle">
                Ask about suitability, missing skills, preparation, or this role itself.
              </p>

              <JobAssistant jobId={jobId} profile={profile} />
            </section>
          </aside>
        </div>
      </main>

      <footer className="site-footer">
        <div className="detail-footer-brand">
          <JobWiseLogo />
        </div>

        <span className="detail-footer-message"> 
          Your next opportunity starts here.
        </span>
      </footer>
    </div>
  );
}
export default JobDetails;
