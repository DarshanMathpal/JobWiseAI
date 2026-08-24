import ijson
from collections import Counter

FILE_PATH = "../data/jobs.json"

total_jobs = 0
sources = Counter()

with open(FILE_PATH, "rb") as file:
    for job in ijson.items(file, "item"):
        total_jobs += 1

        source = job.get("via")

        if source:
            sources[source] += 1

print(f"\nTotal jobs: {total_jobs}")

print("\nTop job sources:")
for source, count in sources.most_common(30):
    print(f"{source}: {count}")