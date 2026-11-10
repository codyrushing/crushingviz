# Analysis 1: Broad study across both Palestinian territories

## Goals

* Provide a sense of the scale of the violence throughout the period. While we do want to focus on the relationship between the two regions and the different ceasefire states, it is important to provide a holistic view of the violence that has occurred in the region.

## Analysis

### Primary metrics
The analysis uses the `acled_weekly_agg` table. This table captures different numbers of events in a given admin1 region. Gaza and West Bank each have their own admin1 region, so we can clearly delineate between the violence in these two regions.  Each event entry carries `event_count`, `fatalaties`, `population_exposure`.  These are used to build the three main dimensions of the analysis:

* `fatalaties` - a likely conservative estimate. By itself, it can be very misleading
* `population_exposure` - an estimate of the number of people affected by the event. Different event types have a different exposure radius, which when combined with population data can provide the number of people affected by an event. Some events, like land seizures in the West Bank are given a very tight radius, and thus have minimal population exposure.
* `event_count` - number of events of each type. Can be combined with the other two dimensions above to derive other metrics like
  * Fatalities/event
  * Population exposure/event
  * Population exposure/fatality
  * Event composition

As far as historical metrics to visualize in a timeseries, these are the three main metrics to focus on.

### Regression models
The analysis also performs some linear regressions on fatalities and population exposure in the two theatres (Gaza and West Bank). The way this works is that for every week, it creates a curve for for one metric (eg. fatalities) for the previous 26 weeks in one theatre, and compares it to the corresponding curve in the other theatre. The regression tells you how closely those curves are coupled.  It's a way to determine the relationship between those two theatres.  

These are called `r` values. `r` near 0 suggests no relationship. When `r` is more positive, it suggests tighter coupling between the curves. When `r` is more negative, it suggests an inverse relationship between the curves.

It also does the same for population exposure. It turns out that the `r` values are pretty similar for those two metrics.

# Analysis 2: Zooming in on settler activity in the West Bank

## Defining settler activity
Because ACLED does not identify actors in the dataset, we need a reliable "proxy" that we can compose from sub event types. Those sub event types are "Looting/property destruction" and "Strategic Developments - Other". Those two sub event types are combined to form what we will call the **core proxy**"** of settler activity.

Comparing our core proxy to actor-tagged data from in OCHA (a separate UN dataset), we see a `r = 0.94` correlation. This suggests the shape of this proxy is pretty good, which is more important for this project than the exact magnitudes.

By design, these event types in ACLED carry no population exposure, which reduces the utility of the population exposure metric in this data set.

There are also "Mob violence" and "Attack" events, but these contain a mix of settler, IDF, and Palestinian-led violence. In that sense, this is a poor proxy for settler activity, but when combined with the core proxy defined above, it can provide a good metric of broad regional violence, which is referred to as **VAC** (violence, attacks, core).

When comparing the mob violence numbers to actor-tagged ACLED data, it shows that nearly all of the mob violence in 2026 can be attributed to settlers. It is unclear how useful this will be in the project.

## Key takeaways
* Settler activity has been gradually ratcheting up throughout the 11 year period in this analysis. It previously peaked in Oct 2023 right at the beginning of the Gaza War, but that peak has been surpassed by Oct 2026. Every deescalation remains higher than the previous deescalation.
* Settler activity does increase at the beginning of each ceasefire period in Gaza. October is the worst month, possibly aligning with the
* When comparing the mob violence numbers to actor-tagged ACLED data, it shows that nearly all of the mob violence in 2026 can be attributed to settlers. This was not true in previous years, likely because Palestinian violence was also included in the totals. It is unclear how useful this will be in the project.
* Confrontational violence, where Palestinians have an organized resistance, has collapsed. This largely explains the above point - mob violence used to be mixed, but in the absense of Palestinian resistance, it largely just represents settler terrorism.
* When the activity is mostly land seizures and village raids, the fatality rate is low. When Palestinians resist in large numbers (great march of return, May 2021 war), fatality rate is high. It's also high at the beginning of the Gaza War.

## Open questions
* Similar to how we built a proxy for settler activity, is there a proxy we can construct for IDF activity?
* What is meant by this sentence in the analysis:

> The Palestinian organized-confrontation field that filled the mob stream in 2018 has been suppressed to statistical zero — Iron Wall and two years of raids did that 

How did Iron Wall and raids erode Palestinian organized resistance?
