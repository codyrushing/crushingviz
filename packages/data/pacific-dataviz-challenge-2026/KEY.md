## About the data
This data comes from [The Pacific Data Hub](https://pacificdata.org/). At least one of the datasets included in this set must be used. It can be joined with other data - other datasets at The Pacific Data Hub would be a good place to start to find complementary data.

## About this directory
The files in this directory (.csv or .pmtiles) come from the official list of required datasets. The data is organized by Pacific country/atoll. 

The pmtiles data have already been processed to extract coastline change rate (`./data/coast_rate_by_country.json`). 

#### Subdirectories

* `/analysis` - scripts to process raw data.
* `/derived` - normalized and cleaned data grouped by country/atoll.
* `/raw` - other datasets (not on the official list but possibly helpful)

### Files key
* `SPC,DF_SDG_03,3.0,complete,2026-06-15 00-05-47.csv` - health behaviors and outcomes
* `SPC,DF_CLIMATE_CHANGE,1.0,complete,2026-06-14 16-08-23.csv` - climate change factors (power generation, rain anomolies, sea surface temperature, etc)
* `SPC,DF_SDG_11,3.0,complete,2026-06-14 18-16-49.csv` - disaster impacts
* `SPC,DF_SDG_15,3.0,complete,2026-06-15 00-08-35.csv` - biodiversity and endangered species risk
* `SPC,DF_SDG_06,3.0,complete,2026-06-15 00-29-26.csv` - sanitation, clean water access, etc

#### Economic / vulnerability datasets (in `/raw`, added 2026-06-20)
These add the economic denominators and vulnerability axes used in the P0g
analysis. Extracted by `analysis/extract_economic.py`. Note: these SDMX exports
are irregular — `DF_KEYFACTS` and `DF_POP_DENSITY` store the **year in the
`INDICATOR` column**, and `DF_NATIONAL_ACCOUNTS` has corrupt off-by-10× USD rows
(handled in the extractor).
* `SPC,DF_NATIONAL_ACCOUNTS,1.0,...csv` - GDP total / per-capita / growth (USD + domestic), 22 PICTs 2005–2024
* `SPC,DF_KEYFACTS,1.0,...csv` - per-country reference facts incl. **max elevation (m)** and maritime/EEZ area (km²)
* `SPC,DF_HHEXP,1.0,...csv` - household expenditure by commodity, **income quintile**, urban/rural (13 PICTs, survey snapshot)
* `SPC,DF_NMDI,1.0,...csv` - National Minimum Development Indicators (40+ social/economic series incl. remittances, renewable energy share, electricity access)
* `SPC,DF_CPI,3.2,...csv` - inflation rate, 20 PICTs 2016–2025
* `SPC,DF_NEET,1.0,...csv` - youth not in employment/education/training, 13 PICTs
* `SPC,DF_POP_DENSITY,1.0,...csv` - population density (persons/km²); ⚠ parsing landmine, deferred
* `SPC,DF_POP_LECZ,1.0,...csv` - duplicate of existing low-elevation coastal-zone data
