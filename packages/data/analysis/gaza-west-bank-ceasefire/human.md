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
