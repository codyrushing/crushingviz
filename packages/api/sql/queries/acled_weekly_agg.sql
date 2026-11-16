-- Queries over the ACLED weekly aggregates table.
--
-- Conventions:
--   * Optional filters are passed as nullable params (sqlc.narg) in a `filters`
--     CTE, so each named param appears exactly once (sqlc's codegen trips over
--     repeated names) and `NULL` means "don't filter on this column".
--   * Every filter param is an array matched with = ANY(...), so several
--     values OR together. NULL (not an empty array!) means "don't filter".
--   * Nullable integer/numeric columns are COALESCEd or cast so generated row
--     structs use plain Go types instead of pgtype wrappers.
--   * The week range is half-open: [from_week, to_week).

-- name: ListACLEDWeeklyAgg :many
WITH filters AS (
  SELECT sqlc.narg(region_ids)::int[]     AS region_ids,
         sqlc.narg(country_ids)::int[]    AS country_ids,
         sqlc.narg(admin1_ids)::int[]     AS admin1_ids,
         sqlc.narg(disorder_types)::text[]  AS disorder_types,
         sqlc.narg(event_types)::text[]     AS event_types,
         sqlc.narg(sub_event_types)::text[] AS sub_event_types
)
SELECT
  a.week,
  a.region_id,
  a.country_id,
  a.admin1_id,
  a.disorder_type,
  a.event_type,
  a.sub_event_type,
  COALESCE(a.event_count, 0)::bigint         AS event_count,
  COALESCE(a.fatalities, 0)::bigint          AS fatalities,
  COALESCE(a.population_exposure, 0)::bigint AS population_exposure,
  a.centroid_longitude::float8               AS centroid_longitude,
  a.centroid_latitude::float8                AS centroid_latitude
FROM acled_weekly_agg a, filters f
WHERE a.week >= sqlc.arg(from_week)
  AND a.week <  sqlc.arg(to_week)
  AND (f.region_ids      IS NULL OR a.region_id      = ANY(f.region_ids))
  AND (f.country_ids     IS NULL OR a.country_id     = ANY(f.country_ids))
  AND (f.admin1_ids      IS NULL OR a.admin1_id      = ANY(f.admin1_ids))
  AND (f.disorder_types  IS NULL OR a.disorder_type  = ANY(f.disorder_types::disorder_type[]))
  AND (f.event_types     IS NULL OR a.event_type     = ANY(f.event_types::event_type[]))
  AND (f.sub_event_types IS NULL OR a.sub_event_type = ANY(f.sub_event_types::sub_event_type[]))
ORDER BY a.week, a.region_id, a.country_id, a.admin1_id, a.sub_event_type
LIMIT sqlc.arg(row_limit) OFFSET sqlc.arg(row_offset);

-- name: CountACLEDWeeklyAgg :one
WITH filters AS (
  SELECT sqlc.narg(region_ids)::int[]     AS region_ids,
         sqlc.narg(country_ids)::int[]    AS country_ids,
         sqlc.narg(admin1_ids)::int[]     AS admin1_ids,
         sqlc.narg(disorder_types)::text[]  AS disorder_types,
         sqlc.narg(event_types)::text[]     AS event_types,
         sqlc.narg(sub_event_types)::text[] AS sub_event_types
)
SELECT COUNT(*)::bigint AS total
FROM acled_weekly_agg a, filters f
WHERE a.week >= sqlc.arg(from_week)
  AND a.week <  sqlc.arg(to_week)
  AND (f.region_ids      IS NULL OR a.region_id      = ANY(f.region_ids))
  AND (f.country_ids     IS NULL OR a.country_id     = ANY(f.country_ids))
  AND (f.admin1_ids      IS NULL OR a.admin1_id      = ANY(f.admin1_ids))
  AND (f.disorder_types  IS NULL OR a.disorder_type  = ANY(f.disorder_types::disorder_type[]))
  AND (f.event_types     IS NULL OR a.event_type     = ANY(f.event_types::event_type[]))
  AND (f.sub_event_types IS NULL OR a.sub_event_type = ANY(f.sub_event_types::sub_event_type[]));
