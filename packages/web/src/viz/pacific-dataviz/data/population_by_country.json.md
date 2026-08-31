# population_by_country.json

Mid-year population estimates and projections (`MIDYEARPOPEST`, total, all 22 PICTs, 1950–2050).

- **Source:** SPC (Pacific Community) National Statistics, dataflow `DF_POP_PROJ` v3.0 ([dataset page](https://sdd.spc.int/dataset/df_pop_proj)), via the [SPC SDMX API](https://stats-sdmx-disseminate.pacificdata.org/rest/) (`data/SPC,DF_POP_PROJ,3.0/all`, CSV format).
- **Processing script:** [analysis/extract_pop.py](https://github.com/codyrushing/crushingviz/blob/main/packages/data/pacific-dataviz-challenge-2026/analysis/extract_pop.py) — filters to `MIDYEARPOPEST` / `SEX=_T` / `AGE=_T` per country and pivots to `{country: {year: population}}`.
- **Upstream derived file:** [derived/population_by_country.json](https://github.com/codyrushing/crushingviz/blob/main/packages/data/pacific-dataviz-challenge-2026/derived/population_by_country.json).
