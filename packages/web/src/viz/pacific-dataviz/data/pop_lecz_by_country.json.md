# pop_lecz_by_country.json

Share (`pct`) and count (`n`) of population in Low Elevation Coastal Zones by elevation band (0–5 / 0–10 / 0–20 m), 20 of 22 PICTs (no Tokelau, Pitcairn).

- **Source:** SPC (Pacific Community) dataflow `DF_POP_LECZ` v1.0 (indicators `LECZPOPRF` share / `LECZPOPAF` count; [dataset page](https://sdd.spc.int/dataset/df_pop_lecz)), from the [SPC Pacific Data Hub](https://pacificdata.org/) — [raw CSV (raw/DF_POP_LECZ_1.0.csv)](https://github.com/codyrushing/crushingviz/blob/main/packages/data/pacific-dataviz-challenge-2026/raw/DF_POP_LECZ_1.0.csv), also saved as [raw/SPC,DF_POP_LECZ,1.0,complete,...csv](https://github.com/codyrushing/crushingviz/blob/main/packages/data/pacific-dataviz-challenge-2026/raw/SPC,DF_POP_LECZ,1.0,complete,2026-06-20%2001-50-46.csv). Census-derived; treated as a static exposure profile.
- **Processing script:** [analysis/extract_coastal.py](https://github.com/codyrushing/crushingviz/blob/main/packages/data/pacific-dataviz-challenge-2026/analysis/extract_coastal.py) — pivots the SDMX long format into `{country: {band: {pct, n}}}`.
- **Upstream derived file:** [derived/pop_lecz_by_country.json](https://github.com/codyrushing/crushingviz/blob/main/packages/data/pacific-dataviz-challenge-2026/derived/pop_lecz_by_country.json).
