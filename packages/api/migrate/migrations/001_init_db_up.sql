-- Create enum types
CREATE TYPE geographic_area_type AS ENUM ('region', 'country', 'admin_1');
CREATE TYPE disorder_type AS ENUM ('Political violence', 'Demonstrations', 'Strategic developments');
CREATE TYPE event_type AS ENUM ('Battles', 'Protests', 'Riots', 'Explosions/Remote violence', 'Violence against civilians', 'Strategic developments');
CREATE TYPE sub_event_type AS ENUM (
    'Government regains territory',
    'Non-state actor overtakes territory',
    'Armed clash',
    'Excessive force against protesters',
    'Protest with intervention',
    'Peaceful protest',
    'Violent demonstration',
    'Mob violence',
    'Chemical weapon',
    'Air/drone strike',
    'Suicide bomb',
    'Shelling/artillery/missile attack',
    'Remote explosive/landmine/IED',
    'Grenade',
    'Sexual violence',
    'Attack',
    'Abduction/forced disappearance',
    'Agreement',
    'Arrests',
    'Change to group/activity',
    'Disrupted weapons use',
    'Headquarters or base established',
    'Looting/property destruction',
    'Non-violent transfer of territory',
    'Other'
);

-- Create geographic_area table
CREATE TABLE geographic_area (
    id SERIAL PRIMARY KEY,
    acled_code INTEGER UNIQUE,
    name TEXT NOT NULL,
    type geographic_area_type NOT NULL,
    iso VARCHAR(10),
    parent INTEGER REFERENCES geographic_area(id),
    geojson JSONB
);

-- Create unique constraint on type + name to prevent duplicate geographies
CREATE UNIQUE INDEX idx_geographic_area_type_name ON geographic_area(type, name);

-- Create index on parent for efficient hierarchy queries
CREATE INDEX idx_geographic_area_parent ON geographic_area(parent);

-- Create acled_weekly_agg table
CREATE TABLE acled_weekly_agg (
    week TIMESTAMP NOT NULL,
    region_id INTEGER NOT NULL REFERENCES geographic_area(id),
    country_id INTEGER REFERENCES geographic_area(id),
    admin1_id INTEGER REFERENCES geographic_area(id),
    disorder_type disorder_type,
    event_type event_type,
    sub_event_type sub_event_type NOT NULL,
    event_count INTEGER,
    fatalities INTEGER,
    population_exposure INTEGER,
    centroid_longitude DECIMAL,
    centroid_latitude DECIMAL,
    PRIMARY KEY (week, region_id, country_id, admin1_id, disorder_type, event_type, sub_event_type)
);

-- Create additional indexes for query optimization
CREATE INDEX idx_acled_weekly_agg_country_week ON acled_weekly_agg(country_id, week);
CREATE INDEX idx_acled_weekly_agg_admin1_week ON acled_weekly_agg(admin1_id, week);

-- Create async_job table
CREATE TABLE async_job (
    id SERIAL PRIMARY KEY,
    created_at TIMESTAMP DEFAULT NOW(),
    source TEXT,
    status TEXT,
    duration INTEGER,
    type TEXT NOT NULL,
    meta JSONB
);

-- Support looking up the latest job of a given type (e.g. the most recent download run)
CREATE INDEX idx_async_job_type_created_at ON async_job(type, created_at DESC);

-- Support looking up the latest job of a given type and source
-- (e.g. the last successful ingest job for a region)
CREATE INDEX idx_async_job_type_source_created_at ON async_job(type, source, created_at DESC);
