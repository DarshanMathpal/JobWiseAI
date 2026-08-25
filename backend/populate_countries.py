import os
import time

from dotenv import load_dotenv
from supabase import create_client
from countrystatecity_countries import get_states_of_country

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise RuntimeError(
        "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY"
    )

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)


# Countries we know are present in your current dataset.
COUNTRIES = [
    {"code": "IN", "name": "India"},
    {"code": "BD", "name": "Bangladesh"},
    {"code": "AT", "name": "Austria"},
    {"code": "SG", "name": "Singapore"},
    {"code": "PE", "name": "Peru"},
    {"code": "ES", "name": "Spain"},
    {"code": "CA", "name": "Canada"},
    {"code": "PK", "name": "Pakistan"},
    {"code": "NG", "name": "Nigeria"},
    {"code": "US", "name": "United States"},
    {"code": "NP", "name": "Nepal"},
    {"code": "CH", "name": "Switzerland"},
    {"code": "GB", "name": "United Kingdom"},
]


# --------------------------------------------------
# Build state -> country mapping ONCE
# --------------------------------------------------

state_to_country = {}

for country in COUNTRIES:
    try:
        states = get_states_of_country(country["code"])

        for state in states:
            state_name = str(
                getattr(state, "name", "")
            ).strip().lower()

            state_code = str(
                getattr(state, "iso2", "")
            ).strip().lower()

            if state_name:
                state_to_country[state_name] = country["name"]

            if state_code:
                state_to_country[state_code] = country["name"]

    except Exception as exc:
        print(
            f"Warning: could not load states for "
            f"{country['name']}: {exc}"
        )


COUNTRY_NAMES = {
    country["name"].strip().lower(): country["name"]
    for country in COUNTRIES
}

COUNTRY_ALIASES = {
    "uk": "United Kingdom",
    "u.k.": "United Kingdom",
    "usa": "United States",
    "u.s.": "United States",
    "us": "United States",
}


def detect_country(location: str | None) -> str | None:
    if not isinstance(location, str):
        return None

    location = location.strip()

    if not location:
        return None

    # Remove things like "(+2 others)"
    location = location.split(" (+", 1)[0].strip()

    parts = [
        part.strip()
        for part in location.split(",")
        if part.strip()
    ]

    lowered_parts = [
        part.lower()
        for part in parts
    ]

    # ----------------------------------------------
    # Direct country name
    # ----------------------------------------------

    for part in lowered_parts:
        if part in COUNTRY_NAMES:
            return COUNTRY_NAMES[part]

    # ----------------------------------------------
    # Country aliases
    # ----------------------------------------------

    for part in lowered_parts:
        if part in COUNTRY_ALIASES:
            return COUNTRY_ALIASES[part]

    # ----------------------------------------------
    # Explicit country inside the full location
    # ----------------------------------------------

    location_lower = location.lower()

    for country in COUNTRIES:
        country_name = country["name"].lower()

        if country_name in location_lower:
            return country["name"]

    # ----------------------------------------------
    # Infer from state / region
    # ----------------------------------------------

    for part in lowered_parts[1:]:
        country_name = state_to_country.get(part)

        if country_name:
            return country_name

    return None


# --------------------------------------------------
# Migration
# --------------------------------------------------

if __name__ == "__main__":

    READ_BATCH_SIZE = 500
    UPDATE_BATCH_SIZE = 100

    updated = 0
    unmatched = 0

    started_at = time.time()

    while True:

        # Always fetch the first remaining NULL rows.
        # Do NOT use an offset because rows are being updated
        # from NULL to a country during the migration.
        response = (
            supabase
            .table("jobs")
            .select("job_id,location,country")
            .is_("country", "null")
            .range(
                0,
                READ_BATCH_SIZE - 1
            )
            .execute()
        )

        rows = response.data or []

        if not rows:
            break

        updates_by_country = {}
        unknown_job_ids = []

        for job in rows:

            job_id = job.get("job_id")
            location = job.get("location")

            detected_country = detect_country(location)

            if detected_country:
                updates_by_country.setdefault(
                    detected_country,
                    []
                ).append(job_id)
            else:
                # We cannot confidently determine the country.
                # Mark it so this row will not be processed again.
                unknown_job_ids.append(job_id)

        # ------------------------------------------
        # Bulk update known countries
        # ------------------------------------------

        batch_updated = 0

        for country, job_ids in updates_by_country.items():

            for start in range(
                0,
                len(job_ids),
                UPDATE_BATCH_SIZE
            ):

                chunk = job_ids[
                    start:start + UPDATE_BATCH_SIZE
                ]

                (
                    supabase
                    .table("jobs")
                    .update({"country": country})
                    .in_("job_id", chunk)
                    .execute()
                )

                batch_updated += len(chunk)

        # ------------------------------------------
        # Mark unknown / ambiguous locations
        # ------------------------------------------

        batch_unknown = 0

        for start in range(
            0,
            len(unknown_job_ids),
            UPDATE_BATCH_SIZE
        ):

            chunk = unknown_job_ids[
                start:start + UPDATE_BATCH_SIZE
            ]

            (
                supabase
                .table("jobs")
                .update({"country": "Unknown"})
                .in_("job_id", chunk)
                .execute()
            )

            batch_unknown += len(chunk)

        updated += batch_updated
        unmatched += batch_unknown

        processed = batch_updated + batch_unknown

        elapsed = time.time() - started_at

        print(
            f"Batch: {len(rows)} | "
            f"Updated: {updated} | "
            f"Unknown: {unmatched} | "
            f"Batch processed: {processed} | "
            f"Elapsed: {elapsed:.1f}s"
        )

        # No offset increment here.
        # The next iteration fetches the next remaining NULL rows.

    print()
    print("========================================")
    print("Country migration complete")
    print("========================================")
    print(f"Updated:   {updated}")
    print(f"Unknown:   {unmatched}")
    print(
        f"Time:      {time.time() - started_at:.1f}s"
    )