# disaster_emdat_regional_events.json

EM-DAT country-level events regrouped into named **regional** disaster events (e.g. a single cyclone spanning several countries), 2000–2026.

- **Source:** derived from [disaster_emdat_by_type.json](https://github.com/codyrushing/crushingviz/blob/main/packages/web/src/viz/pacific-dataviz/data/disaster_emdat_by_type.json) → upstream [EM-DAT](https://www.emdat.be/) (CRED/UCLouvain) HDX [Country Profiles](https://data.humdata.org/dataset/emdat-country-profiles) ([raw xlsx](https://github.com/codyrushing/crushingviz/blob/main/packages/data/pacific-dataviz-challenge-2026/raw/emdat-country-profiles.xlsx)).
- **Processing:** hand-assembled (no script). Country-year events were grouped on (year, type, subtype); where web research — Wikipedia cyclone-season articles, [JTWC](https://www.metoc.navy.mil/jtwc/), [Australian BoM](http://www.bom.gov.au/cyclone/), and Fiji Meteorological Service reports — clearly identifies distinct events within a group, it is split and named; when EM-DAT has already aggregated same-type events for one country-year, the group retains a `note` listing known constituent storms. Affected, deaths, damage, and event counts are summed across member countries.
- **Provenance notes:** the `name` field gives the identified storm name; `note` explains the split rationale. Same EM-DAT inclusion threshold caveat as the parent file.
