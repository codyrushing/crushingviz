// Package handlers contains the API's HTTP handlers.
package handlers

import (
	"context"
	"errors"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"time"

	"api.crushingviz.info/db"
	"api.crushingviz.info/types/acled"
	"github.com/jackc/pgx/v5/pgtype"
)

const (
	// Upper bound for a single request so slow queries can't pile up.
	queryTimeout = 10 * time.Second

	defaultWeeklyAggLimit = 500
	maxWeeklyAggLimit     = 5000

	dateLayout = "2006-01-02"
)

// ACLED serves endpoints backed by the ACLED tables.
type ACLED struct {
	Queries *db.Queries
}

// weeklyAggResponse is the wire shape for a page of weekly aggregate rows.
type weeklyAggResponse struct {
	Data       []acled.ACLEDWeeklyAggregate `json:"data"`
	Pagination pagination                   `json:"pagination"`
}

type pagination struct {
	Limit  int   `json:"limit"`
	Offset int   `json:"offset"`
	Total  int64 `json:"total"`
}

// weeklyAggParams is the parsed and validated form of the request's query string.
type weeklyAggParams struct {
	from, to time.Time

	regionID     pgtype.Int4
	countryID    pgtype.Int4
	admin1ID     pgtype.Int4
	disorderType pgtype.Text
	eventType    pgtype.Text
	subEventType pgtype.Text

	limit  int32
	offset int32
}

// ListWeeklyAgg handles GET /acled/weekly-agg.
func (h ACLED) ListWeeklyAgg(w http.ResponseWriter, r *http.Request) {
	params, err := parseWeeklyAggParams(r)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), queryTimeout)
	defer cancel()

	rows, err := h.Queries.ListACLEDWeeklyAgg(ctx, db.ListACLEDWeeklyAggParams{
		FromWeek:     params.from,
		ToWeek:       params.to,
		RegionID:     params.regionID,
		CountryID:    params.countryID,
		Admin1ID:     params.admin1ID,
		DisorderType: params.disorderType,
		EventType:    params.eventType,
		SubEventType: params.subEventType,
		RowLimit:     params.limit,
		RowOffset:    params.offset,
	})
	if err != nil {
		log.Printf("query acled_weekly_agg: %v", err)
		writeError(w, http.StatusInternalServerError, "failed to query weekly aggregates")
		return
	}

	total, err := h.Queries.CountACLEDWeeklyAgg(ctx, db.CountACLEDWeeklyAggParams{
		FromWeek:     params.from,
		ToWeek:       params.to,
		RegionID:     params.regionID,
		CountryID:    params.countryID,
		Admin1ID:     params.admin1ID,
		DisorderType: params.disorderType,
		EventType:    params.eventType,
		SubEventType: params.subEventType,
	})
	if err != nil {
		log.Printf("count acled_weekly_agg: %v", err)
		writeError(w, http.StatusInternalServerError, "failed to query weekly aggregates")
		return
	}

	data := make([]acled.ACLEDWeeklyAggregate, 0, len(rows))
	for _, row := range rows {
		data = append(data, toWeeklyAggregate(row))
	}

	writeJSON(w, http.StatusOK, weeklyAggResponse{
		Data: data,
		Pagination: pagination{
			Limit:  int(params.limit),
			Offset: int(params.offset),
			Total:  total,
		},
	})
}

// toWeeklyAggregate converts a generated database row into the API's domain
// type. Keeping this explicit means changes to a query can't silently reshape
// the JSON contract (and therefore the TypeScript types generated from it).
func toWeeklyAggregate(row db.ListACLEDWeeklyAggRow) acled.ACLEDWeeklyAggregate {
	countryID := int(row.CountryID)
	admin1ID := int(row.Admin1ID)

	return acled.ACLEDWeeklyAggregate{
		Week:               row.Week,
		RegionID:           int(row.RegionID),
		CountryID:          &countryID,
		Admin1ID:           &admin1ID,
		DisorderType:       row.DisorderType,
		EventType:          row.EventType,
		SubEventType:       row.SubEventType,
		EventCount:         uint64(row.EventCount),
		Fatalities:         uint64(row.Fatalities),
		PopulationExposure: uint64(row.PopulationExposure),
		CentroidLongitude:  row.CentroidLongitude,
		CentroidLatitude:   row.CentroidLatitude,
	}
}

// parseWeeklyAggParams parses and validates the query string. from/to are
// required and describe a half-open range [from, to) over the week column.
func parseWeeklyAggParams(r *http.Request) (weeklyAggParams, error) {
	values := r.URL.Query()

	from, err := parseDate(values.Get("from"), "from")
	if err != nil {
		return weeklyAggParams{}, err
	}
	to, err := parseDate(values.Get("to"), "to")
	if err != nil {
		return weeklyAggParams{}, err
	}
	if !from.Before(to) {
		return weeklyAggParams{}, errors.New("'from' must be before 'to'")
	}

	regionID, err := parseOptionalID(values.Get("region_id"), "region_id")
	if err != nil {
		return weeklyAggParams{}, err
	}
	countryID, err := parseOptionalID(values.Get("country_id"), "country_id")
	if err != nil {
		return weeklyAggParams{}, err
	}
	admin1ID, err := parseOptionalID(values.Get("admin1_id"), "admin1_id")
	if err != nil {
		return weeklyAggParams{}, err
	}

	disorderType, err := parseOptionalEnum(values.Get("disorder_type"), "disorder_type", validDisorderTypes)
	if err != nil {
		return weeklyAggParams{}, err
	}
	eventType, err := parseOptionalEnum(values.Get("event_type"), "event_type", validEventTypes)
	if err != nil {
		return weeklyAggParams{}, err
	}
	subEventType, err := parseOptionalEnum(values.Get("sub_event_type"), "sub_event_type", validSubEventTypes)
	if err != nil {
		return weeklyAggParams{}, err
	}

	limit, err := parseOptionalInt(values.Get("limit"), "limit", defaultWeeklyAggLimit, 1)
	if err != nil {
		return weeklyAggParams{}, err
	}
	if limit > maxWeeklyAggLimit {
		return weeklyAggParams{}, fmt.Errorf("'limit' must be <= %d", maxWeeklyAggLimit)
	}
	offset, err := parseOptionalInt(values.Get("offset"), "offset", 0, 0)
	if err != nil {
		return weeklyAggParams{}, err
	}

	return weeklyAggParams{
		from:         from,
		to:           to,
		regionID:     nullableInt4(regionID),
		countryID:    nullableInt4(countryID),
		admin1ID:     nullableInt4(admin1ID),
		disorderType: nullableText(disorderType),
		eventType:    nullableText(eventType),
		subEventType: nullableText(subEventType),
		limit:        int32(limit),
		offset:       int32(offset),
	}, nil
}

// parseDate parses a required YYYY-MM-DD date as UTC midnight.
func parseDate(raw, name string) (time.Time, error) {
	if raw == "" {
		return time.Time{}, fmt.Errorf("'%s' is required (%s)", name, dateLayout)
	}
	parsed, err := time.Parse(dateLayout, raw)
	if err != nil {
		return time.Time{}, fmt.Errorf("'%s' must be a date in %s format", name, dateLayout)
	}
	return parsed, nil
}

// parseOptionalInt parses an optional integer query param, falling back to def
// when it is absent. min is the smallest permitted value.
func parseOptionalInt(raw, name string, def, min int) (int, error) {
	if raw == "" {
		return def, nil
	}
	parsed, err := strconv.Atoi(raw)
	if err != nil {
		return 0, fmt.Errorf("'%s' must be an integer", name)
	}
	if parsed < min {
		return 0, fmt.Errorf("'%s' must be >= %d", name, min)
	}
	return parsed, nil
}

// parseOptionalID parses an optional positive id, returning nil when absent so
// the query treats the filter as unused.
func parseOptionalID(raw, name string) (*int, error) {
	parsed, err := parseOptionalInt(raw, name, 0, 1)
	if err != nil || raw == "" {
		return nil, err
	}
	return &parsed, nil
}

// parseOptionalEnum validates an optional query param against the allowed
// values, returning nil when it is absent.
func parseOptionalEnum(raw, name string, valid map[string]struct{}) (*string, error) {
	if raw == "" {
		return nil, nil
	}
	if _, ok := valid[raw]; !ok {
		return nil, fmt.Errorf("'%s' must be one of the ACLED values for that column", name)
	}
	return &raw, nil
}

func nullableInt4(value *int) pgtype.Int4 {
	if value == nil {
		return pgtype.Int4{}
	}
	return pgtype.Int4{Int32: int32(*value), Valid: true}
}

func nullableText(value *string) pgtype.Text {
	if value == nil {
		return pgtype.Text{}
	}
	return pgtype.Text{String: *value, Valid: true}
}
