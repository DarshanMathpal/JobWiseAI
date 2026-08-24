import ijson

FILE_PATH = "../data/jobs.json"

count = 0
first_job = None

with open(FILE_PATH, "rb") as file:
    for job in ijson.items(file, "item"):
        count += 1

        if first_job is None:
            first_job = job

        if count >= 1000:
            break

print(f"Checked {count} job records.")

if first_job:
    print("\nFields in the first job:")

    for key, value in first_job.items():
        print(f"- {key}: {type(value).__name__}")

    print("\nFirst job ID:", first_job.get("job_id"))
    print("First job title:", first_job.get("title"))
    print("First job company:", first_job.get("company_name"))