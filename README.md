# JobWise AI

> AI-powered job discovery and matching that helps users find relevant opportunities, understand job fit, and make better application decisions.

JobWise AI brings job search, location-aware filtering, resume matching, saved jobs, and contextual AI assistance into one focused experience.

🌐 **Live Website:** https://job-wise-ai.vercel.app  
▶️ **Project Walkthrough:** _Video coming soon_  
📚 **API Documentation:** https://jobwise-ai-backend.onrender.com/docs

---

## Product Preview

### Authentication

<table>
<tr>
<td width="50%" align="center">
<img src="docs/screenshots/login.png" alt="JobWise AI login" width="100%">
<br><sub><b>Login</b> — Email/password and Google authentication.</sub>
</td>
<td width="50%" align="center">
<img src="docs/screenshots/signup.png" alt="JobWise AI signup" width="100%">
<br><sub><b>Sign up</b> — Account creation through Supabase Auth.</sub>
</td>
</tr>
</table>

### Job Discovery

<table>
<tr>
<td width="50%" align="center">
<img src="docs/screenshots/dashboard.png" alt="JobWise AI dashboard" width="100%">
<br><sub><b>Dashboard</b> — Discover and refine opportunities.</sub>
</td>
<td width="50%" align="center">
<img src="docs/screenshots/job-list.png" alt="JobWise AI job list" width="100%">
<br><sub><b>Job List</b> — Search, filter, sort, and review jobs.</sub>
</td>
</tr>
</table>

### Job Details

<p align="center">
<img src="docs/screenshots/job-details.png" alt="JobWise AI job details" width="88%">
<br><sub><b>Job Details</b> — Requirements, application links, and AI assistance.</sub>
</p>

---

## Why JobWise AI?

Job searching is often a discovery problem: a large number of listings can make it difficult to identify the opportunities that actually fit.

- **Discover** — Search and narrow opportunities by role, location, experience, domain, skills, and source.
- **Understand fit** — Upload a PDF resume, derive a profile, and receive job recommendations.
- **Decide faster** — Review structured job details, save opportunities, and ask the AI assistant questions using relevant context.

The goal is a simpler path from **finding a job** to **understanding whether it is worth applying to**.

---

## Key Features

| Feature | Description |
|---|---|
| Job discovery | Browse jobs with cached initial results and fresh API data. |
| Search & filters | Source, skills, location, domain, experience, and posted-window filtering. |
| Location hierarchy | Country → state → city selection with country flags. |
| Job details | Structured descriptions, requirements, and application links. |
| Resume matching | PDF text extraction, profile creation, and job recommendations. |
| Gemini AI | Optional resume analysis, enrichment, and AI-assisted workflows. |
| Saved jobs | Save opportunities locally for later review. |
| Authentication | Email/password, Google OAuth, password recovery, sessions, and sign-out. |
| Responsive UI | Desktop and mobile layouts. |

---

## How It Works

<p align="center">
<img src="docs/architecture/product-workflow.png" alt="JobWise AI product workflow" width="95%">
</p>

The main flow connects authentication, discovery, job details, resume matching, contextual assistance, and action.

---

## Architecture

### Production Architecture

<p align="center">
<img src="docs/architecture/system-architecture.png" alt="JobWise AI production architecture" width="92%">
</p>

Vercel hosts the React/Vite frontend, Render hosts the FastAPI backend, Supabase provides authentication and Postgres-backed job data/API access, and Gemini supports optional AI workflows.

### Frontend Architecture

<p align="center">
<img src="docs/architecture/frontend-architecture.png" alt="JobWise AI frontend architecture" width="92%">
</p>

### Backend Architecture

<p align="center">
<img src="docs/architecture/backend-architecture.png" alt="JobWise AI backend architecture" width="92%">
</p>

---

## AI & Data Flow

<p align="center">
<img src="docs/architecture/ai-data-flow.png" alt="JobWise AI data flow" width="94%">
</p>

The AI layer supports two practical paths: resume-based matching and contextual job-search assistance.

---

## Technology Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite 8, React Icons |
| Backend | FastAPI, Uvicorn, Pydantic |
| PDF processing | pypdf |
| Database & Auth | Supabase |
| AI | Google Gemini API, `google-genai` |
| Deployment | Vercel, Render |
| Source control | GitHub |

---

## Project Structure

```text
JobWiseAI/
├── README.md
├── .gitignore
├── render.yaml
├── docs/
│   ├── screenshots/
│   │   ├── login.png
│   │   ├── signup.png
│   │   ├── dashboard.png
│   │   ├── job-list.png
│   │   └── job-details.png
│   └── architecture/
│       ├── product-workflow.png
│       ├── system-architecture.png
│       ├── frontend-architecture.png
│       ├── backend-architecture.png
│       └── ai-data-flow.png
├── frontend/
│   ├── .env.example
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   ├── public/
│   └── src/
│       ├── App.jsx
│       ├── App.css
│       ├── JobAssistant.jsx
│       ├── JobDetails.jsx
│       ├── ResumeUpload.jsx
│       ├── index.css
│       ├── main.jsx
│       └── lib/
│           ├── apiConfig.js
│           └── supabaseClient.js
└── backend/
    ├── .env.example
    ├── main.py
    ├── requirements.txt
    ├── supabase_client.py
    ├── supabase_admin.py
    ├── source_normalizer.py
    ├── ingest_jobs.py
    ├── enrich_jobs.py
    ├── enrich_one_job.py
    ├── inspect_data.py
    ├── analyze_dataset.py
    └── check_duplicates.py
```

---

## Authentication & Security

Authentication is handled by **Supabase Auth** with email/password, Google OAuth, password recovery, session persistence, and sign-out.

Frontend publishable credentials are supplied through Vite environment variables; server-side credentials stay in backend environment variables.

**Never commit real credentials or `.env` files.**

---

## API

Full interactive documentation:

**https://jobwise-ai-backend.onrender.com/docs**

The API covers jobs and filters, hierarchical locations, resume processing and recommendations, health checks, and AI assistant workflows.

---

## Deployment

```text
GitHub
├──► Vercel ──► React/Vite Frontend
│
└──► Render ──► FastAPI Backend
                   ├──► Supabase
                   └──► Gemini (optional)
```

| Service | Production URL |
|---|---|
| Website | https://job-wise-ai.vercel.app |
| Backend | https://jobwise-ai-backend.onrender.com |
| API Docs | https://jobwise-ai-backend.onrender.com/docs |

---

## Local Development

### Prerequisites

- Node.js and npm
- Python 3.12+
- Supabase project
- Required environment variables

### Clone

```bash
git clone https://github.com/DarshanMathpal/JobWiseAI.git
cd JobWiseAI
```

### Frontend

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

### Backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Local frontend: `http://localhost:5173`  
Local API: `http://localhost:8000`

---

## Environment Variables

### Frontend — `frontend/.env`

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key
VITE_API_BASE_URL=http://localhost:8000
```

### Backend — `backend/.env`

```env
SUPABASE_URL=your_supabase_url
SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
GEMINI_API_KEY=your_gemini_api_key
CORS_ORIGINS=http://localhost:5173
```

`GEMINI_API_KEY` is optional for the manual Gemini-powered enrichment/analysis workflows; users who enable Gemini-powered functionality should provide their own valid Gemini key.

**Never commit real credentials or `.env` files.**

---

## Performance

The frontend caches default job results, country data, filter options, and saved jobs in the browser. Cached default results can render immediately while fresh API data is requested in the background, improving perceived loading speed.

---

## Live Demo

🌐 https://job-wise-ai.vercel.app  
📚 https://jobwise-ai-backend.onrender.com/docs

▶️ **Project walkthrough:** add the video link here after recording.
