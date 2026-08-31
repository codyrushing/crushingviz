# gdp_by_country.json

GDP (total, per-capita, and growth; USD and domestic currency), 22 PICTs, 2005–2024.

- **Source:** SPC (Pacific Community) National Accounts, dataflow `DF_NATIONAL_ACCOUNTS` v1.0 ([dataset page](https://sdd.spc.int/dataset/df_national_accounts)), downloaded 2026-06-20 from the [SPC Pacific Data Hub](https://pacificdata.org/) — [raw CSV](https://github.com/codyrushing/crushingviz/blob/main/packages/data/pacific-dataviz-challenge-2026/raw/SPC,DF_NATIONAL_ACCOUNTS,1.0,complete,2026-06-20%2001-36-47.csv).
- **Processing script:** [analysis/extract_economic.py](https://github.com/codyrushing/crushingviz/blob/main/packages/data/pacific-dataviz-challenge-2026/analysis/extract_economic.py) — resolves `UNIT_MULT` currency scaling, splits USD vs domestic-currency series, and flags suspicious off-by-10× USD rows (retained but marked).
- **Upstream derived file:** [derived/gdp_by_country.json](https://github.com/codyrushing/crushingviz/blob/main/packages/data/pacific-dataviz-challenge-2026/derived/gdp_by_country.json).
