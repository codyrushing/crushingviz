## History of violence
Explore historical patterns in armed conflict and violence using geospatial data. This could be split into several sub projects grouped by region or conflict.

The underlying data is vast, so meaningful visualizations will likely need to focus on small slices.  The first project I would like to do is a history of violence between Israel and its neighbors since at least the Great March of Return.

### Data sources
* ACLED 
    * [docs](https://apidocs.acleddata.com/generalities_section.html#queries)
    * Not much data before 2010
    * Very granular
    * Curated datasets for conflicts against women, health care workers, and civilians
    * Updated weekly
* UCDP 
    * [docs](https://ucdp.uu.se/apidocs/)
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
* [https://acleddata.com/use-access/how-use-acleds-aggregated-data](https://acleddata.com/use-access/how-use-acleds-aggregated-data)
* [https://acleddata.com/faq-codebook-tools#acleds-aggregated-data-0](https://acleddata.com/faq-codebook-tools#acleds-aggregated-data-0)
* Main takeaways
  * Data updated weekly on a per state/province/admin region.
  * Different event types are expressed, including violence against civilians, and sub-event types (eg. drone strike, explosion)
  * ACLED seems more confident about the fatality numbers, but they say they are conservative.
  * There is a new "population exposure" column, which is a good way to measure the intensity of the events.
  * Geo data is less precise - it only represents the centroid of the admin region, not of the specific events, which reduces how expressive the maps can be. 
  
### Access
Aggregated data is available via download in the browser, which could be automated.
