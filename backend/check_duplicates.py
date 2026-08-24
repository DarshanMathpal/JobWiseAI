import ijson
from collections import Counter

FILE_PATH = "../data/jobs.json"

job_ids = Counter()
job_signatures = Counter()

with open(FILE_PATH, "rb") as file:
    for job in ijson.items(file, "item"):
        job_id = job.get("job_id")

        if job_id:
            job_ids[job_id] += 1

        title = (job.get("title") or "").strip().lower()
        company = (job.get("company_name") or "").strip().lower()
        location = (job.get("location") or "").strip().lower()

        signature = (title, company, location)

        if title or company:
            job_signatures[signature] += 1

duplicate_ids = {
    job_id: count
    for job_id, count in job_ids.items()
    if count > 1
}

duplicate_signatures = {
    signature: count
    for signature, count in job_signatures.items()
    if count > 1
}

print(f"Total records: {sum(job_ids.values())}")
print(f"Unique job IDs: {len(job_ids)}")
print(f"Duplicate job IDs: {len(duplicate_ids)}")
print(f"Duplicate title/company/location groups: {len(duplicate_signatures)}")

print("\nSample duplicate job IDs:")
for job_id, count in list(duplicate_ids.items())[:10]:
    print(job_id, "->", count)

print("\nSample duplicate-looking jobs:")
for signature, count in list(duplicate_signatures.items())[:10]:
    print(signature, "->", count)