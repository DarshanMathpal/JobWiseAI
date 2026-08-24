# JobWise AI

> AI-powered job discovery and matching that helps users find relevant opportunities, understand job fit, and make better application decisions.

JobWise AI brings job search, location-aware filtering, resume matching, saved jobs, and contextual AI assistance into one focused experience.

🌐 **[Live Website Link](https://job-wise-ai.vercel.app)** 

▶️ **[Project Video Link]** 

---

## Product Preview

### Authentication

**Sign up**
<img width="1440" height="900" alt="1" src="https://github.com/user-attachments/assets/f288fb9a-2f23-4b06-8094-7ce16ba5d464" />

**Login**

<img width="1440" height="900" alt="2" src="https://github.com/user-attachments/assets/6f5a39fe-245e-43cf-be32-8bc3ab4fc4cb" />


### Job discovery

**Main dashboard**

<img width="1440" height="900" alt="3" src="https://github.com/user-attachments/assets/1db3da6d-456c-460c-b732-832165698123" />


**Job listings, filters, resume matching, and AI assistant**

<img width="1440" height="900" alt="4" src="https://github.com/user-attachments/assets/e02da8e3-6bf2-434b-8960-fd1b956d4548" />


### Job details

**Job details, requirements, application links, and AI assistant**

<img width="1440" height="900" alt="5" src="https://github.com/user-attachments/assets/3f294790-8511-4634-962f-a3767a5bb113" />


These screenshots reflect the working UI tested locally before deployment.

---

## Product Workflow

```text
User
  │
  ▼
Authentication (Supabase)
  │
  ▼
Job Discovery
  │
  ├── Search / Role suggestions
  ├── Filters / Location / Experience / Domain
  └── Cached initial results
  │
  ▼
Job Results
  │
  ▼
Job Details
  │
  ├── Requirements
  ├── Application links
  └── AI Assistant
  │
  ├──────────────┐
  ▼              ▼
Resume Upload   Saved Jobs
  │
  ▼
Resume Profile + Matching
  │
  ▼
Personalized Recommendations

---

## System Architecture

```mermaid
flowchart TD
    U[User Browser]
    V[Vercel - React/Vite Frontend]
    A[Render - FastAPI Backend]
    S[Supabase Auth + Postgres/API]
    G[Google Gemini API]

    U --> V
    V -->|REST API| A
    V -->|Auth / OAuth| S
    A --> S
    A --> G
```

### Runtime responsibilities

- **Frontend:** UI, authentication UX, search/filter interactions, local caching, saved jobs, resume upload UI, AI assistant UI, and job-details rendering.
- **Backend:** job APIs, filtering/pagination, location data APIs, resume PDF extraction, recommendation logic, AI endpoints, and database access.
- **Supabase:** authentication plus the `jobs` data used by the backend.
- **Gemini:** resume analysis/enrichment and AI assistant requests.

---

## Authentication & Security

Authentication is handled by **Supabase Auth** with email/password, Google OAuth, password recovery, session persistence, and sign-out.

Frontend publishable credentials are supplied through Vite environment variables; server-side credentials stay in backend environment variables.

**Never commit real credentials or `.env` files.**

---

## API

Full interactive documentation:

**[API Documentation Link](https://jobwise-ai-backend.onrender.com/docs)**

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
CORS_ORIGINS=http://localhost:5173
```

`GEMINI_API_KEY` is optional for the manual Gemini-powered enrichment/analysis workflows; users who enable Gemini-powered functionality should provide their own valid Gemini key.

**Never commit real credentials or `.env` files.**

---

## Performance

The frontend caches default job results, country data, filter options, and saved jobs in the browser. Cached default results can render immediately while fresh API data is requested in the background, improving perceived loading speed.

---
