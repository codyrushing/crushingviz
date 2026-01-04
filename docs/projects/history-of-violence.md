## History of violence
Explore historical patterns in armed conflict and violence using geospatial data. This could be split into several sub projects grouped by region or conflict.

The underlying data is vast, so meaningful visualizations will likely need to focus on small slices.  The first project I would like to do is a history of violence between Israel and its neighbors since at least the Great March of Return. A similar idea would be the history of ceasefires in Palestine, and how much violence is actually taking place during the supposed ceasefires.

### Data sources
* ACLED 
    * https://apidocs.acleddata.com/generalities_section.html#queries
    * Not much data before 2010
    * Very granular
    * Curated datasets for conflicts against women, health care workers, and civilians
    * Updated weekly
* UCDP 
    * https://ucdp.uu.se/apidocs/
    * Easier to access
    * Very official, used by UN
    * Goes back to the 1940s
    * Updated yearly, but it appears that there is more recent data for Palestine
* GDELT
    * https://blog.gdeltproject.org/the-datasets-of-gdelt-as-of-february-2016/
    * Disorganized documentation
    * 15 min updates
* [Comparison of ACLED vs UCDP](https://www.urban-response.org/system/files/content/resource/files/main/a_83553-f_CoCo__Eck__final_.111204.release_vers.pdf)

ACLED seems best. It seems to provide the correct level of aggregation - granular enough to examine micropatterns weekly.

### Aggregated data
* https://acleddata.com/use-access/how-use-acleds-aggregated-data
* https://acleddata.com/faq-codebook-tools#acleds-aggregated-data-0
* Main takeaways
  * Data updated weekly on a per state/province/admin region.
    * Files are published here under "Data by Region" section: https://acleddata.com/conflict-data/download-data-files/aggregated-data
  * Different event types are expressed, including violence against civilians, and sub-event types (eg. drone strike, explosion)
  * ACLED seems more confident about the fatality numbers, but they say they are conservative.
  * There is a new "population exposure" column, which is a good way to measure the intensity of the events.
  * Geo data is less precise - it only represents the centroid of the admin region, not of the specific events, which reduces how expressive the maps can be. 

There are some [curated data published on monthly/yearly basis at the country level](https://data.humdata.org/organization/acled), which could be helpful but is probably too aggregated to be meaningful for the types of projects I'm interested.
  
### Access
Aggregated data is available via download in the browser, which could be automated.

### Open question: how to get geospatial data for regions
ACLED aggregated data only includes a centroid of the admin region, so we will need a way to get geojson for countries and admin regions. This may end up being a more manual process. A site like this looks like it would help: https://mapscaping.com/country-boundary-viewer/

We could create a `region` table to manage the relationship between different regions and define their geojson.
