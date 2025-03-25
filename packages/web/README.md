## crushingviz

Notes on the ACLED methodology: https://acleddata.com/knowledge-base/faqs-acled-fatality-methodology/
* > the data cannot generally be used to estimate the number of deaths caused or suffered by one actor or another in a conflict, as a single event may contain information on fatalities caused or suffered by both parties in a battle. The exception to this is events targeting civilians and protesters, who are by definition not engaging in violence themselves.1 Therefore, the number of fatalities reported for each event involving civilians or protesters as ‘Actor 2’ can be understood as the number of civilians or protesters killed.2
* > As such, aggregate estimates of “civilian fatalities” in ACLED’s curated data 3do not include civilians that may have died as ‘collateral damage’ during fighting between armed groups or as a result of the remote targeting of armed groups 
* Palestine/Israel data go back to Jan 2016
* There are specialized curated datasets for attacks on media journalists, health workers, women, and civilians here https://acleddata.com/curated-data-files/#media
* > ACLED emphasizes that fatalities are often a poor approximation of a conflict’s form and impact. They are often debated and can vary widely. Conflict actors may overstate or under-report fatalities to appear strong to the opposition or to minimize international backlash.... Event counts can be one alternative to fatality counts. The relationship between conflict events and fatalities is not consistent. Some conflicts have relatively fewer events yet the number of reported fatalities is high, such as in Afghanistan. 
* https://www.politico.eu/article/israel-hamas-gaza-a-fixation-on-death-tolls-can-be-a-fatal-distraction/
* https://acleddata.com/2023/10/10/fact-sheet-israel-and-palestine-conflict/
* https://www.uu.se/en/news/2024/2024-06-05-mapping-the-death-toll-in-gaza

## Development

#### Run migrations
```bash
cd ./migrate; 
go run . up;
```

#### Reverse migrations
```bash
cd ./migrate; 
go run . down;
```
