import json
import os
import time

from google import genai
from supabase_client import supabase
from supabase_admin import supabase_admin


BATCH_SIZE = 5
DELAY_SECONDS = 2


def enrich_job(job, api_key):
    client = genai.Client(api_key=api_key)

    prompt = f"""
Analyze this job listing and return ONLY valid JSON.

Job title:
{job.get("title")}

Company:
{job.get("company_name")}

Description:
{job.get("description")}

Return exactly this structure:

{{
  "skills": [],
  "roles": [],
  "experience_min": null,
  "experience_max": null,
  "tags": []
}}

Rules:
- skills: important technical and professional skills relevant to the job
- roles: normalized role categories relevant to this job
- experience_min/max: use only when supported by the job description
- tags: useful discovery tags such as Python, SQL, Machine Learning,
  Generative AI, Fresher, Internship, Remote, etc.
- Do not invent requirements that are not supported by the job description.
"""

    response = client.models.generate_content(
        model="gemini-3.6-flash",
        contents=prompt,
    )

    raw = response.text.strip()

    if raw.startswith("```"):
        raw = raw.replace("```json", "", 1)
        raw = raw.replace("```", "", 1)
        raw = raw.strip()

    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        print("Invalid JSON returned by Gemini.")
        return None


def main():
    api_key = os.getenv("GEMINI_API_KEY")

    if not api_key:
        raise ValueError("GEMINI_API_KEY is not set.")

    response = (
        supabase
        .table("jobs")
        .select(
            "job_id,title,company_name,description"
        )
        .eq("ai_enriched", False)
        .limit(BATCH_SIZE)
        .execute()
    )

    jobs = response.data

    if not jobs:
        print("No unenriched jobs found.")
        return

    print(f"Found {len(jobs)} jobs to enrich.")

    successful = 0

    for index, job in enumerate(jobs, start=1):
        print(
            f"\n[{index}/{len(jobs)}] "
            f"{job['title']} — {job['company_name']}"
        )

        try:
            enriched = enrich_job(job, api_key)

            if not enriched:
                print("Skipped: enrichment failed.")
                continue

            update_data = {
                "ai_skills": enriched.get("skills", []),
                "ai_roles": enriched.get("roles", []),
                "ai_tags": enriched.get("tags", []),
                "ai_min_experience": enriched.get("experience_min"),
                "ai_max_experience": enriched.get("experience_max"),
                "ai_enriched": True,
            }

            (
                supabase_admin
                .table("jobs")
                .update(update_data)
                .eq("job_id", job["job_id"])
                .execute()
            )

            successful += 1
            print("Saved successfully.")

        except Exception as error:
            print(f"Error: {error}")

        time.sleep(DELAY_SECONDS)

    print(
        f"\nFinished. Successfully enriched "
        f"{successful}/{len(jobs)} jobs."
    )


if __name__ == "__main__":
    main()