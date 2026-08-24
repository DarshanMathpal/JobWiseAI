def normalize_source(via: str | None) -> str:
    if not via:
        return "Other"

    source = via.strip().lower()

    known_sources = {
        "linkedin": "LinkedIn",
        "via linkedin": "LinkedIn",
        "naukri": "Naukri",
        "via naukri": "Naukri",
        "indeed": "Indeed",
        "via indeed": "Indeed",
        "internshala": "Internshala",
        "via internshala": "Internshala",
    }

    return known_sources.get(source, "Other")

if __name__ == "__main__":
    test_values = [
        "LinkedIn",
        "via LinkedIn",
        "Naukri",
        "via Naukri",
        "Indeed",
        "Internshala",
        "BeBee",
        None,
    ]

    for value in test_values:
        print(f"{value!r} -> {normalize_source(value)}")