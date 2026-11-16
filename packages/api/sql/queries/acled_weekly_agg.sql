-- Queries over the ACLED weekly aggregates table.
--
-- Conventions:
--   * Optional filters are passed as nullable params (sqlc.narg) in a `filters`
--     CTE, so each named param appears exactly once (sqlc's codegen trips over
--     repeated names) and `NULL` means "don't filter on this column".
--   * Nullable integer/numeric columns are COALESCEd or cast so generated row
--     structs use plain Go types instead of pgtype wrappers.
--   * The week range is half-open: [from_week, to_week).

-- name: ListACLEDWeeklyAgg :many
WITH filters AS (
  SELECT sqlc.narg(region_id)::int       AS region_id,
         sqlc.narg(country_id)::int      AS country_id,
         sqlc.narg(admin1_id)::int       AS admin1_id,
         sqlc.narg(disorder_type)::text  AS disorder_type,
         sqlc.narg(event_type)::text     AS event_type,
         sqlc.narg(sub_event_type)::text AS sub_event_type
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
  AND (f.region_id      IS NULL OR a.region_id      = f.region_id)
  AND (f.country_id     IS NULL OR a.country_id     = f.country_id)
  AND (f.admin1_id      IS NULL OR a.admin1_id      = f.admin1_id)
  AND (f.disorder_type  IS NULL OR a.disorder_type  = f.disorder_type::disorder_type)
  AND (f.event_type     IS NULL OR a.event_type     = f.event_type::event_type)
  AND (f.sub_event_type IS NULL OR a.sub_event_type = f.sub_event_type::sub_event_type)
ORDER BY a.week, a.region_id, a.country_id, a.admin1_id, a.sub_event_type
LIMIT sqlc.arg(row_limit) OFFSET sqlc.arg(row_offset);

-- name: CountACLEDWeeklyAgg :one
WITH filters AS (
  SELECT sqlc.narg(region_id)::int       AS region_id,
         sqlc.narg(country_id)::int      AS country_id,
         sqlc.narg(admin1_id)::int       AS admin1_id,
         sqlc.narg(disorder_type)::text  AS disorder_type,
         sqlc.narg(event_type)::text     AS event_type,
         sqlc.narg(sub_event_type)::text AS sub_event_type
)
SELECT COUNT(*)::bigint AS total
FROM acled_weekly_agg a, filters f
WHERE a.week >= sqlc.arg(from_week)
  AND a.week <  sqlc.arg(to_week)
  AND (f.region_id      IS NULL OR a.region_id      = f.region_id)
  AND (f.country_id     IS NULL OR a.country_id     = f.country_id)
  AND (f.admin1_id      IS NULL OR a.admin1_id      = f.admin1_id)
  AND (f.disorder_type  IS NULL OR a.disorder_type  = f.disorder_type::disorder_type)
  AND (f.event_type     IS NULL OR a.event_type     = f.event_type::event_type)
  AND (f.sub_event_type IS NULL OR a.sub_event_type = f.sub_event_type::sub_event_type);
