package acled

import "time"

/* ***************************
 * * ACLED CUSTOM DATA TYPES *
 * ***************************
 * Based on ACLED Codebook and Aggregated Data Structure
 * https://acleddata.com/methodology/acled-codebook
 * https://acleddata.com/use-access/how-use-acleds-aggregated-data
 */

// DisorderType represents the three broad categories of disorder in ACLED data
type DisorderType string

const (
	DisorderTypePoliticalViolence DisorderType = "Political violence"
	DisorderTypeDemonstrations    DisorderType = "Demonstrations"
	DisorderTypeStrategic         DisorderType = "Strategic developments"
)

// EventType represents the six main event classifications in ACLED data
type EventType string

const (
	EventTypeBattles                  EventType = "Battles"
	EventTypeProtests                 EventType = "Protests"
	EventTypeRiots                    EventType = "Riots"
	EventTypeExplosionsRemoteViolence EventType = "Explosions/Remote violence"
	EventTypeViolenceAgainstCivilians EventType = "Violence against civilians"
	EventTypeStrategicDevelopments    EventType = "Strategic developments"
)

// SubEventType is the most detailed event type classification level
type SubEventType string

const (
	// Battles
	SubEventTypeBattlesGovernmentRegainsTerritory      SubEventType = "Government regains territory"
	SubEventTypeBattlesNonStateActorOvertakesTerritory SubEventType = "Non-state actor overtakes territory"
	SubEventTypeBattlesArmedClash                      SubEventType = "Armed clash"
	// Protests
	SubEventTypeProtestsExcessiveForceAgainstProtesters SubEventType = "Excessive force against protesters"
	SubEventTypeProtestsProtestWithIntervention         SubEventType = "Protest with intervention"
	SubEventTypeProtestsPeacefulProtest                 SubEventType = "Peaceful protest"
	// Riots
	SubEventTypeRiotsViolentDemonstration SubEventType = "Violent demonstration"
	SubEventTypeRiotsMobViolence          SubEventType = "Mob violence"
	// Explosions/Remote violence
	SubEventTypeExplosionsChemicalWeapon             SubEventType = "Chemical weapon"
	SubEventTypeExplosionsAirDroneStrike             SubEventType = "Air/drone strike"
	SubEventTypeExplosionsSuicideBomb                SubEventType = "Suicide bomb"
	SubEventTypeExplosionsShellingArtilleryMissile   SubEventType = "Shelling/artillery/missile attack"
	SubEventTypeExplosionsRemoteExplosiveLandmineIED SubEventType = "Remote explosive/landmine/IED"
	SubEventTypeExplosionsGrenade                    SubEventType = "Grenade"
	// Violence against civilians
	SubEventTypeVACiviliansSexualViolence           SubEventType = "Sexual violence"
	SubEventTypeVACiviliansAttack                   SubEventType = "Attack"
	SubEventTypeVACiviliansAbductionForcedDisappear SubEventType = "Abduction/forced disappearance"
	// Strategic developments
	SubEventTypeStrategicAgreement                     SubEventType = "Agreement"
	SubEventTypeStrategicArrests                       SubEventType = "Arrests"
	SubEventTypeStrategicChangeToGroupActivity         SubEventType = "Change to group/activity"
	SubEventTypeStrategicDisruptedWeaponsUse           SubEventType = "Disrupted weapons use"
	SubEventTypeStrategicHeadquartersOrBaseEstablished SubEventType = "Headquarters or base established"
	SubEventTypeStrategicLootingPropertyDestruction    SubEventType = "Looting/property destruction"
	SubEventTypeStrategicNonViolentTransferOfTerritory SubEventType = "Non-violent transfer of territory"
	SubEventTypeStrategicOther                         SubEventType = "Other"
)

// GeographicAreaType represents the type of a geographic area
type GeographicAreaType string

const (
	GeographicAreaTypeRegion  GeographicAreaType = "region"
	GeographicAreaTypeCountry GeographicAreaType = "country"
	GeographicAreaTypeAdmin1  GeographicAreaType = "admin_1"
)

// GeographicArea represents a row from the geographic_area table
type GeographicArea struct {
	ID        int                `json:"id"`
	ACLEDCode *int               `json:"acled_code,omitempty"`
	Name      string             `json:"name"`
	Type      GeographicAreaType `json:"type"`
	ISO       *string            `json:"iso,omitempty"`
	ParentID  *int               `json:"parent,omitempty"`
	GeoJSON   interface{}        `json:"geojson,omitempty"`
}

// ACLEDWeeklyAggregateBase contains the common fields for all aggregated ACLED data
type ACLEDWeeklyAggregateBase struct {
	// Week is the date of the Saturday marking the start of that week of aggregated data (Saturday to Friday)
	Week time.Time `json:"week"`

	// RegionID is the foreign key referencing the region in the geographic_area table
	RegionID int `json:"region_id"`

	// CountryID is the foreign key referencing the country in the geographic_area table
	CountryID *int `json:"country_id,omitempty"`

	// Admin1ID is the foreign key referencing the admin1 area in the geographic_area table
	Admin1ID *int `json:"admin1_id,omitempty"`

	// DisorderType is one of three broad categories: Political violence, Demonstrations, or Strategic developments
	DisorderType DisorderType `json:"disorder_type"`

	// EventType is one of six main event classifications
	EventType EventType `json:"event_type"`

	// SubEventType is the most detailed event type classification level
	SubEventType SubEventType `json:"sub_event_type"`

	// EventCount is the total number of discrete events recorded for the specified week, Admin1, and sub_event_type
	EventCount uint64 `json:"event_count"`

	// Fatalities is the sum of reported fatalities across the events for this row
	Fatalities uint64 `json:"fatalities"`

	// PopulationExposure is the best aggregated estimate of people exposed to any events that week
	// NOTE: Users should not sum these values as they represent exposure estimates based on proximity
	PopulationExposure uint64 `json:"population_exposure"`

	// CentroidLongitude is the longitude of the geographic center point for mapping the administrative district
	CentroidLongitude float64 `json:"centroid_longitude"`

	// CentroidLatitude is the latitude of the geographic center point for mapping the administrative district
	CentroidLatitude float64 `json:"centroid_latitude"`
}

// ACLEDWeeklyAggregate is an alias for ACLEDWeeklyAggregateBase
type ACLEDWeeklyAggregate = ACLEDWeeklyAggregateBase

// Helper functions to get all possible sub-event types for each event type

func GetBattlesSubEventTypes() []SubEventType {
	return []SubEventType{
		SubEventTypeBattlesGovernmentRegainsTerritory,
		SubEventTypeBattlesNonStateActorOvertakesTerritory,
		SubEventTypeBattlesArmedClash,
	}
}

func GetProtestsSubEventTypes() []SubEventType {
	return []SubEventType{
		SubEventTypeProtestsExcessiveForceAgainstProtesters,
		SubEventTypeProtestsProtestWithIntervention,
		SubEventTypeProtestsPeacefulProtest,
	}
}

func GetRiotsSubEventTypes() []SubEventType {
	return []SubEventType{
		SubEventTypeRiotsViolentDemonstration,
		SubEventTypeRiotsMobViolence,
	}
}

func GetExplosionsRemoteViolenceSubEventTypes() []SubEventType {
	return []SubEventType{
		SubEventTypeExplosionsChemicalWeapon,
		SubEventTypeExplosionsAirDroneStrike,
		SubEventTypeExplosionsSuicideBomb,
		SubEventTypeExplosionsShellingArtilleryMissile,
		SubEventTypeExplosionsRemoteExplosiveLandmineIED,
		SubEventTypeExplosionsGrenade,
	}
}

func GetViolenceAgainstCiviliansSubEventTypes() []SubEventType {
	return []SubEventType{
		SubEventTypeVACiviliansSexualViolence,
		SubEventTypeVACiviliansAttack,
		SubEventTypeVACiviliansAbductionForcedDisappear,
	}
}

func GetStrategicDevelopmentsSubEventTypes() []SubEventType {
	return []SubEventType{
		SubEventTypeStrategicAgreement,
		SubEventTypeStrategicArrests,
		SubEventTypeStrategicChangeToGroupActivity,
		SubEventTypeStrategicDisruptedWeaponsUse,
		SubEventTypeStrategicHeadquartersOrBaseEstablished,
		SubEventTypeStrategicLootingPropertyDestruction,
		SubEventTypeStrategicNonViolentTransferOfTerritory,
		SubEventTypeStrategicOther,
	}
}
