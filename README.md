# crushingviz
Viz projects and data apps

## Goals
* Build visualizations against compelling data sets that are either personally interesting to me and/or relevant to better understanding the world and current political discourse.
* Prioritize living data sets whenever possible, and have new data be integrated automatically.
* Explore geospatial data.

## Architecture - TBD
* `packages/api` - data API written in Go. It is also the source of truth for any API related-types, and `tygo` is used to generate typescript types from them.
* `packages/types` - a collection of shared types. API-related types from `packages/api` are converted from Go to TS and output to `packages/types/api.ts`.
* `packages/web` - Astro site which does a static build of the site using the above API.
* `packages/data` - responsible for fetching and ingesting data from various sources into database. These will run on some sort of schedule

## Database design
The database design is documented in the [crushingviz.dbml](crushingviz.dbml) file. This can be dropped into [dbdiagram.io](https://dbdiagram.io/) to create an entity-relationship graph.

## Prerequisites
* Bun
* Go
* [tygo](https://github.com/gzuidhof/tygo)
  * go install github.com/gzuidhof/tygo@latest

## Development
* `./dev all` starts runs database migrations and starts all services
