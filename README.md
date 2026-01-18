# crushingviz
Viz projects and data apps

## Goals
* Build visualizations against compelling data sets that are either personally interesting to me and/or relevant to better understanding the world and current political discourse.
* Prioritize living data sets whenever possible, and have new data be integrated automatically.
* Explore geospatial data.

## Architecture - TBD
* The `packages/api` - data API written in Go. It is also the source of truth for all types, and `tygo` is used to generate typescript types from them.
* The `packages/web` - Astro site which does a static build of the site using the above API.
* `packages/data` - responsible for fetching and ingesting data from various sources into database. These will run on some sort of schedule

## Prerequisites
* Bun
* Go
* [tygo](https://github.com/gzuidhof/tygo)
  * go install github.com/gzuidhof/tygo@latest
