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
