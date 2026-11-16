// Package handlers contains the API's HTTP handlers.
package handlers

import (
	"context"
	"errors"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"api.crushingviz.info/db"
	"api.crushingviz.info/types/acled"
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

	// The filters map to sqlc.narg arrays in the query; nil (unused) becomes
	// NULL, which the query treats as "don't filter".
	regionIDs     []int32
	countryIDs    []int32
	admin1IDs     []int32
	disorderTypes []string
	eventTypes    []string
	subEventTypes []string

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
		FromWeek:      params.from,
		ToWeek:        params.to,
		RegionIds:     params.regionIDs,
		CountryIds:    params.countryIDs,
		Admin1Ids:     params.admin1IDs,
		DisorderTypes: params.disorderTypes,
		EventTypes:    params.eventTypes,
		SubEventTypes: params.subEventTypes,
		RowLimit:      params.limit,
		RowOffset:     params.offset,
	})
	if err != nil {
		log.Printf("query acled_weekly_agg: %v", err)
		writeError(w, http.StatusInternalServerError, "failed to query weekly aggregates")
		return
	}

	total, err := h.Queries.CountACLEDWeeklyAgg(ctx, db.CountACLEDWeeklyAggParams{
		FromWeek:      params.from,
		ToWeek:        params.to,
		RegionIds:     params.regionIDs,
		CountryIds:    params.countryIDs,
		Admin1Ids:     params.admin1IDs,
		DisorderTypes: params.disorderTypes,
		EventTypes:    params.eventTypes,
		SubEventTypes: params.subEventTypes,
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

	regionIDs, err := parseOptionalIDList(values["region_id"], "region_id")
	if err != nil {
		return weeklyAggParams{}, err
	}
	countryIDs, err := parseOptionalIDList(values["country_id"], "country_id")
	if err != nil {
		return weeklyAggParams{}, err
	}
	admin1IDs, err := parseOptionalIDList(values["admin1_id"], "admin1_id")
	if err != nil {
		return weeklyAggParams{}, err
	}

	disorderTypes, err := parseOptionalEnumList(values["disorder_type"], "disorder_type", validDisorderTypes)
	if err != nil {
		return weeklyAggParams{}, err
	}
	eventTypes, err := parseOptionalEnumList(values["event_type"], "event_type", validEventTypes)
	if err != nil {
		return weeklyAggParams{}, err
	}
	subEventTypes, err := parseOptionalEnumList(values["sub_event_type"], "sub_event_type", validSubEventTypes)
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
		regionIDs:     regionIDs,
		countryIDs:    countryIDs,
		admin1IDs:     admin1IDs,
		disorderTypes: disorderTypes,
		eventTypes:    eventTypes,
		subEventTypes: subEventTypes,
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

// splitList flattens enum/id filter values given either as repeated query
// params or as one comma-separated value (or both at once) into non-empty,
// trimmed parts.
func splitList(raws []string) []string {
	var parts []string
	for _, raw := range raws {
		for _, value := range strings.Split(raw, ",") {
			if value = strings.TrimSpace(value); value != "" {
				parts = append(parts, value)
			}
		}
	}
	return parts
}

// parseOptionalIDList validates ID filter values, returning nil when none are
// present so the query treats the filter as unused.
func parseOptionalIDList(raws []string, name string) ([]int32, error) {
	var ids []int32
	for _, value := range splitList(raws) {
		id, err := strconv.Atoi(value)
		if err != nil {
			return nil, fmt.Errorf("'%s' must be an integer", name)
		}
		if id < 1 {
			return nil, fmt.Errorf("'%s' must be >= 1", name)
		}
		ids = append(ids, int32(id))
	}
	return ids, nil
}

// parseOptionalEnumList validates enum filter values against the allowed
// values, returning nil when none are present so the filter is unused.
func parseOptionalEnumList(raws []string, name string, valid map[string]struct{}) ([]string, error) {
	var parsed []string
	for _, value := range splitList(raws) {
		if _, ok := valid[value]; !ok {
			return nil, fmt.Errorf("'%s' must be one of the ACLED values for that column", name)
		}
		parsed = append(parsed, value)
	}
	return parsed, nil
}
