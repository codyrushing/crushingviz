# affected_projection_2050.json

Projected flood-affected population (person-incidents) per country per year, 2025–2050, with low/high bands, plus a return-period framing ("today's ~1-in-25-yr flood becomes ~N× more frequent by 2050").

- **Inputs (all derived in this repo):**
  - [derived/risk_trajectory_2050.json](https://github.com/codyrushing/crushingviz/blob/main/packages/data/pacific-dataviz-challenge-2026/derived/risk_trajectory_2050.json) — exposure × AR6 SLR × amplification factor (see its citation for upstream sources).
  - [derived/population_by_country.json](https://github.com/codyrushing/crushingviz/blob/main/packages/data/pacific-dataviz-challenge-2026/derived/population_by_country.json) — SPC `DF_POP_PROJ` yearly population.
  - [derived/disaster_emdat_by_type.json](https://github.com/codyrushing/crushingviz/blob/main/packages/data/pacific-dataviz-challenge-2026/derived/disaster_emdat_by_type.json) — EM-DAT (CRED/UCLouvain) HDX [Country Profiles](https://data.humdata.org/dataset/emdat-country-profiles); baseline = mean annual `flood_relevant` affected, 2000–2024.
- **Model:** affected(t) = baseline_annual_affected × (exposed(t) / baseline_exposed) × AF(t), where AF(t) ramps exponentially from 1 (2020) to the 2050 amplification factor per [Vitousek et al. 2017](https://doi.org/10.1038/s41598-017-01362-7) / [Taherkhani et al. 2020](https://doi.org/10.1038/s41467-020-17321-2).
- **Processing script:** [analysis/affected_projection.py](https://github.com/codyrushing/crushingviz/blob/main/packages/data/pacific-dataviz-challenge-2026/analysis/affected_projection.py) → [derived/affected_projection_2050.json](https://github.com/codyrushing/crushingviz/blob/main/packages/data/pacific-dataviz-challenge-2026/derived/affected_projection_2050.json).
- **Caveats (in-file):** person-incidents ≠ unique people; `flood_relevant` includes cyclone wind damage not only SLR-driven flooding; per-event affected size held constant; LECZ share static; illustrative, not site-calibrated. Nauru excluded (no EM-DAT records).
