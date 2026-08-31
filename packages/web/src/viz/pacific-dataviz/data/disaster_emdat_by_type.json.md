# disaster_emdat_by_type.json

EM-DAT disaster events for the 20 PICTs it covers, 2000–2026 (177 country-year-type rows), preserving disaster type/subtype, with affected / deaths / damage series per country, pre-aggregated `flood_relevant` (Storm + Flood + wet Mass movement) and strict `coastal_flood_only` subsets, and damage joined to same-year USD GDP.

- **Source:** [EM-DAT](https://www.emdat.be/) (CRED/UCLouvain, Brussels) HDX [Country Profiles](https://data.humdata.org/dataset/emdat-country-profiles) (downloaded 2026-06-23; free access, CC-BY-NC) — [raw/emdat-country-profiles.xlsx](https://github.com/codyrushing/crushingviz/blob/main/packages/data/pacific-dataviz-challenge-2026/raw/emdat-country-profiles.xlsx).
- **GDP denominator** (for `pct_of_gdp`): SPC `DF_NATIONAL_ACCOUNTS` via [derived/gdp_by_country.json](https://github.com/codyrushing/crushingviz/blob/main/packages/data/pacific-dataviz-challenge-2026/derived/gdp_by_country.json).
- **Processing script:** [analysis/extract_emdat_by_type.py](https://github.com/codyrushing/crushingviz/blob/main/packages/data/pacific-dataviz-challenge-2026/analysis/extract_emdat_by_type.py) — parses the xlsx, maps ISO-3 → PICT codes, groups by disaster type, and computes the flood-relevant subsets + regional roll-ups.
- **Upstream derived file:** [derived/disaster_emdat_by_type.json](https://github.com/codyrushing/crushingviz/blob/main/packages/data/pacific-dataviz-challenge-2026/derived/disaster_emdat_by_type.json).
- **Caveat:** EM-DAT has an inclusion threshold (≥10 deaths, ≥100 affected, emergency declaration, or international appeal) — very small events may be missing.
