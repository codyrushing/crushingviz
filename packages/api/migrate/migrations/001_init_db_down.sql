-- Drop tables (order matters due to foreign keys)
DROP TABLE IF EXISTS acled_weekly_agg;
DROP TABLE IF EXISTS geographic_area;

-- Drop enum types
DROP TYPE IF EXISTS event_type;
DROP TYPE IF EXISTS disorder_type;
DROP TYPE IF EXISTS geographic_area_type;
