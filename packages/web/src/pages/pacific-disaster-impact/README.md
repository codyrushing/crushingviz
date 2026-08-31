# Pacific Dataviz Challenge 2026
  
## Background info
* Competition info and data sources: https://pacificdatavizchallenge.org/
  * Other data sets: https://stats.pacificdata.org/
* [Data exploration, analysis, methodologies, and references](../../../../data/pacific-dataviz-challenge-2026/README.md)

## Purpose
This is a planning/strategy doc for the data vizualization app itself. To deep dive into the data analysis and exploration, follow the link above.

## Thesis
The overall unifying thesis of this piece could be summed up with: **How many Pacific Islanders live in the danger zone today, how that grows by 2050, and how rising seas turn today's rare floods into routine ones.**

We can explore and break down this thesis with two stories that have emerged from the research:

## Story 1: Which Pacific Islanders bear the greatest burden from disasters today
Verdict: The PICTs with the highest percentage of population living in low lying areas are also the most economically precarious. The lack of high ground makes flooding events more devastating, leaving the country with no buffer and fewer unaffected resources.
* [disaster_affected_by_country.json](../../../../data/pacific-dataviz-challenge-2026/derived/disaster_affected_by_country.json) and [disaster_affected_merged.json](../../../../data/pacific-dataviz-challenge-2026/derived/disaster_affected_merged.json) measure disaster exposure by counting the number of people who experienced a disaster. This dataset is an incomplete timeseries, but there's enough historical data to warrant a timeseries visualization.
  * Per-capita shows smaller PICTs bear a heavier burden.
    * The "whole nation" effect, which means that for these countries, a small percentage of the population and infrastructure are unaffected by flooding, which makes aid and recovery more difficult.
  * To further tell the "no high ground, no buffer" story, add max elevation to the LECZ exposure data [max_elevation_by_country.json](../../../../data/pacific-dataviz-challenge-2026/derived/max_elevation_by_country.json).
  * Would this be a good place to introduce the population by elevation bands? Or is that level of detail only necessary with the future projections? [pop_lecz_by_country.json](../../../../data/pacific-dataviz-challenge-2026/derived/pop_lecz_by_country.json)
    * Answer, per-capita LECZ will be usefull to show here.
  * Caveats and TODOs:
    * ~~There is no distinction in the data between flooding disasters and other disasters. Annotate the larger floods to help drive the relationship with later assertions in the piece.~~ We used EM-DAT data to measure disasters by type in [disaster_emdat_by_type.json](../../../../data/pacific-dataviz-challenge-2026/derived/disaster_emdat_by_type.json), and that has been used to fill in the gaps in [../../../../data/pacific-dataviz-challenge-2026/derived/disaster_affected_merged.json](disaster_affected_merged.json) doc. EM-DAT data was pre-aggregated to combine all flood-related categories into a single `flood-relevant` column.

#### Add economic dimension 
* [disaster_loss_pct_gdp.json](../../../../data/pacific-dataviz-challenge-2026/derived/disaster_loss_pct_gdp.json)
  * An extension to the "whole nation" effect, single events can have an outsized effect on small countries' GDP.
  * The most disaster-exposed atolls are poorer as measured by per-capita GDP [gdp_by_country.json](../../../../data/pacific-dataviz-challenge-2026/derived/gdp_by_country.json).
  * Using Engel's Law, which posits that % of household budget spent on food is proportional to poverty, the same poor countries which suffer the most from disasters also experience the most food insecurity. This is underscored by dips in agriculture output during years of high disaster exposure. ~~Specifically fish, which has decreased availabilty sea warming and reef loss, is felt higher by the more flood-prone PICTs~~ That is speculative. [household_expenditure.json](../../../../data/pacific-dataviz-challenge-2026/derived/household_expenditure.json)
  * The most exposed atolls also have the smallest remittances as a percent of GDP compared to other high islands, adding to their economic precarity. The outlier is Marshall Islands, but that is explained by the COFA exception. This data currently lives in [remittances_renewables.json](../../../../data/pacific-dataviz-challenge-2026/derived/remittances_renewables.json).

### Visualizations
* Viz 1: Demonstrate the correlation between disaster exposure and GDP 
  * `disaster_affected_merged.json` - use the primary per country yearly series of disaster affected people.
    * Stacked area or line graph w/ each country. This are 20 countries...
      * Crazy idea, maybe a legend that runs along either side of the graph w/ flags + names.
        * Need color scale for countries. Maybe use per-capita GDP to visually encode poor to rich (red => yellow => green).
      * This should probably be the only graph that includes all 20 countries. After this, we zoom in on the most impacted countries only.
    * Probably don't use `cumulative_per_capita` or `pct_of_pop`. Those are based on only 2014 population. We have the per-year population in `population_by_country.json`, so we should apply that dimension.
    * Allow the user to change the Y-axis unit between these units:
      * affected persons (`disaster_affected_merged.json`)
      * affected % of population (`disaster_affected_merged.json` / population in `population_by_country.json`)
      * economic loss as percent GDP. TODO - how to get the numerator here.
    * Find a way to annotate disaster events, which are defined per-country per-year in `disaster_emdat_by_type.json`. This might be too much to show on the full regional graph, so maybe only show them on PICT highlight.
    * Bar chart approach
      * One of the goals should be to show that how most of the disaster impact is clustered at the bottom of the per-capita GDP scale.
      * Plotting per-year shows movement through time along the per-capita GDP scale, which is not really helpful and possibly confounding. The rich countries stay near the top and the poor countries stay near the bottom.  Avg per-capita GDP would be better.
      * Per year plotting misses the big picture, which is more apparent with the cumulative values, not the per-year. Also, large per-year values distort the scale. Per year does help illustrate the impact of major events (eg. this year there was a typhoon and that created a huge spike), but we can use a supplemental small-multiples circular bar chart to show that.
      * How to visualize the per-capita GDP scale?
        * Using a linear scale clusters all of the poor countries together, with a large-ish gap between them and the rich. Maybe that's ok, but it feels space inefficient.
        * Just sort by name? That hides just how much poorer the poor countries are compared to the rich.
        * Using a color scale was interesting, but harder to read honestly. 
        * Compromise w/ linear and sort and just fixed bins probably.
      * How to visualize the cumulative impact scale?
        * Binned bar chart is most straightforward
          * Could even visualize event types within bars
          * Still allow metric change
        * Maybe small multiple circular bars w/ connecting line to the per capita GDP scale?
        * A stacked area or streamgraph would provide a nice region-wide view, and it looks nice. You would have to use color scale for per capita GDP, which isn't perfect. But that relationship and per-country trends could be explored in a separate visualization.
* Zoom in on flooding. Only EM-DAT data is broken down by disaster type, but the overall shape and proportion are what we are interested in. Use the `flood_relevant` category which includes all relevant flooding sub-categories. Ignore `coastal_flood_only`, too small to be relevant.
  * Maybe here is where to introduce LECZ population bands and max elevation since those are more relevant to flooding.


## Story 2: Future projection of flood risk
This is where the visualization can start to be future-looking. The above story demonstrates how the smaller and poorer PICTs currently bear the largest disaster burden. The following model is used to to project flood risk into the future:

1. Use population growth projection + elevation bands to determine the *sub-10m population yearly between now and 2050* assuming the population grows with the same proportions living in the different elevation bands.
  * Acknowledge that some PICTs are expected to shrink in population (Marshall Islands, Cook Islands, Palau). While this will decrease disaster exposure, it can bolster the story by claiming that some of this out migration is climate-driven.
2. Using IPCC data, determine the *relative sea level change (SLR)* for each of the PICTs
3. A region-wide "doubling" interval - which indicates how many cm of SLR it takes to double flood frequency. This is the same for all PICTs in the data set.
4. Calculate a per-PICT flood amplification factor using Vitousek's formula of *AF = 2^(SLR / D)*. This returns both a single value (`af_central`) and a range [risk_trajectory_2050.json](../../../../data/pacific-dataviz-challenge-2026/derived/risk_trajectory_2050.json). For simplicity, `af_central` is a sensible value to use here, but we could show the entire range.

The amplification factor (AF) indicates how the frequency of floods will change. If you combine this with population projection in the elevation bands, you can calculate the future population exposure to flooding. It does not predict storm/cyclone frequency - it only predicts flooding.

It is important to mention that these sea level projections for the 2050 horizon are essentially locked in, meaning that the window to reduce them by cutting emissions has already closed. So these models are likely under-representing sea level rise that we can expect by 2050.

## Viz challenges:
* How to demonstrate the AF range band? Or just use the central AF value?
* How to visualize the increased frequency? We could just plot AF, but it would be more powerful to take the annoted spikes seen from the real historical disaster exposure data, and show those becoming more frequent as we approach 2050.

## Caveats:
* Note that the impact of sea level change (SLR) is not that it moves people into different population bands. Its impact is to change the baseline for tides and storm surges, meaning that the frequency of flooding that people in each band experience increases.
* All regions use the same doubling interval (D). This means that the same AF is calculated for a given sea level rise both for low-lying atolls and high islands. If anything, this means that for low-lying atolls, who have the most flood risk, AF is conservative.
* The definition of "disaster-affected" is slightly different between the two different merged data sources (UNDRR and EM-DAT).
* We removed any countries with <10k population from DisasterImpact visualization

## Other TODOs:
* Add footnotes (modal probably)
