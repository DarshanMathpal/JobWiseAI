import json
import ijson
from supabase_admin import supabase_admin
from source_normalizer import normalize_source

FILE_PATH = "../data/jobs.json"
BATCH_SIZE = 500


def safe_int(value):
    try:
        if value in (None, "", "null"):
            return None
        return int(float(value))
    except (ValueError, TypeError):
        return None


def parse_apply_options(value):
    if not value:
        return None

    if isinstance(value, list):
        return value

    try:
        return json.loads(value)
    except (json.JSONDecodeError, TypeError):
        return None


def clean_job(job):
    return {
        "job_id": job.get("job_id"),
        "title": job.get("title"),
        "company_name": job.get("company_name"),
        "description": job.get("description"),
        "formatted_description": job.get("formattedDescription"),
        "location": job.get("location"),
        "source": normalize_source(job.get("via")),
        "via": job.get("via"),
        "skills": job.get("skills"),
        "roles": job.get("roles"),
        "domain": job.get("domain"),
        "employment_type": job.get("employmentType"),
        "min_experience": safe_int(job.get("minExperienceRequired")),
        "max_experience": safe_int(job.get("maxExperienceRequired")),
        "location_requirement": job.get("locationRequirement"),
        "apply_options": parse_apply_options(job.get("apply_options")),
        "posted_at": job.get("posted_at"),
        "thumbnail": job.get("thumbnail"),
    }


def ingest_jobs():
    batch = []
    total = 0

    with open(FILE_PATH, "rb") as file:
        for job in ijson.items(file, "item"):
            cleaned = clean_job(job)

            if not cleaned["job_id"]:
                continue

            batch.append(cleaned)

            if len(batch) >= BATCH_SIZE:
                supabase_admin.table("jobs").upsert(
                    batch,
                    on_conflict="job_id"
                ).execute()

                total += len(batch)
                print(f"Imported {total} jobs...")
                batch = []

    if batch:
        supabase_admin.table("jobs").upsert(
            batch,
            on_conflict="job_id"
        ).execute()

        total += len(batch)

    print(f"Finished. Imported {total} jobs.")


if __name__ == "__main__":
    ingest_jobs()