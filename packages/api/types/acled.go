package types

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

// SubEventType is a marker interface that all sub-event types must implement
type SubEventType interface {
	subEventType()
	String() string
}

// Battles sub-event types
type BattlesSubEventType string

const (
	BattlesGovernmentRegainsTerritory      BattlesSubEventType = "Government regains territory"
	BattlesNonStateActorOvertakesTerritory BattlesSubEventType = "Non-state actor overtakes territory"
	BattlesArmedClash                      BattlesSubEventType = "Armed clash"
)

func (BattlesSubEventType) subEventType() {}
func (b BattlesSubEventType) String() string { return string(b) }

// Protests sub-event types
type ProtestsSubEventType string

const (
	ProtestsExcessiveForceAgainstProtesters ProtestsSubEventType = "Excessive force against protesters"
	ProtestsProtestWithIntervention         ProtestsSubEventType = "Protest with intervention"
	ProtestsPeacefulProtest                 ProtestsSubEventType = "Peaceful protest"
)

func (ProtestsSubEventType) subEventType() {}
func (p ProtestsSubEventType) String() string { return string(p) }

// Riots sub-event types
type RiotsSubEventType string

const (
	RiotsViolentDemonstration RiotsSubEventType = "Violent demonstration"
	RiotsMobViolence          RiotsSubEventType = "Mob violence"
)

func (RiotsSubEventType) subEventType() {}
func (r RiotsSubEventType) String() string { return string(r) }

// Explosions/Remote violence sub-event types
type ExplosionsRemoteViolenceSubEventType string

const (
	ExplosionsRemoteViolenceChemicalWeapon             ExplosionsRemoteViolenceSubEventType = "Chemical weapon"
	ExplosionsRemoteViolenceAirDroneStrike             ExplosionsRemoteViolenceSubEventType = "Air/drone strike"
	ExplosionsRemoteViolenceSuicideBomb                ExplosionsRemoteViolenceSubEventType = "Suicide bomb"
	ExplosionsRemoteViolenceShellingArtilleryMissile   ExplosionsRemoteViolenceSubEventType = "Shelling/artillery/missile attack"
	ExplosionsRemoteViolenceRemoteExplosiveLandmineIED ExplosionsRemoteViolenceSubEventType = "Remote explosive/landmine/IED"
	ExplosionsRemoteViolenceGrenade                    ExplosionsRemoteViolenceSubEventType = "Grenade"
)

func (ExplosionsRemoteViolenceSubEventType) subEventType() {}
func (e ExplosionsRemoteViolenceSubEventType) String() string { return string(e) }

// Violence against civilians sub-event types
type ViolenceAgainstCiviliansSubEventType string

const (
	ViolenceAgainstCiviliansSexualViolence           ViolenceAgainstCiviliansSubEventType = "Sexual violence"
	ViolenceAgainstCiviliansAttack                   ViolenceAgainstCiviliansSubEventType = "Attack"
	ViolenceAgainstCiviliansAbductionForcedDisappear ViolenceAgainstCiviliansSubEventType = "Abduction/forced disappearance"
)

func (ViolenceAgainstCiviliansSubEventType) subEventType() {}
func (v ViolenceAgainstCiviliansSubEventType) String() string { return string(v) }

// Strategic developments sub-event types
type StrategicDevelopmentsSubEventType string

const (
	StrategicDevelopmentsAgreement                     StrategicDevelopmentsSubEventType = "Agreement"
	StrategicDevelopmentsArrests                       StrategicDevelopmentsSubEventType = "Arrests"
	StrategicDevelopmentsChangeToGroupActivity         StrategicDevelopmentsSubEventType = "Change to group/activity"
	StrategicDevelopmentsDisruptedWeaponsUse           StrategicDevelopmentsSubEventType = "Disrupted weapons use"
	StrategicDevelopmentsHeadquartersOrBaseEstablished StrategicDevelopmentsSubEventType = "Headquarters or base established"
	StrategicDevelopmentsLootingPropertyDestruction    StrategicDevelopmentsSubEventType = "Looting/property destruction"
	StrategicDevelopmentsNonViolentTransferOfTerritory StrategicDevelopmentsSubEventType = "Non-violent transfer of territory"
	StrategicDevelopmentsOther                         StrategicDevelopmentsSubEventType = "Other"
)

func (StrategicDevelopmentsSubEventType) subEventType() {}
func (s StrategicDevelopmentsSubEventType) String() string { return string(s) }

// Region represents ACLED's broad geographic classifications
type Region string

const (
	RegionMiddleEast          Region = "Middle East"
	RegionSouthAsia           Region = "South Asia"
	RegionSoutheastAsia       Region = "Southeast Asia"
	RegionEastAsia            Region = "East Asia"
	RegionCentralAsia         Region = "Central Asia"
	RegionCaucasus            Region = "Caucasus and Central Asia"
	RegionEasternAfrica       Region = "Eastern Africa"
	RegionMiddleAfrica        Region = "Middle Africa"
	RegionSouthernAfrica      Region = "Southern Africa"
	RegionWesternAfrica       Region = "Western Africa"
	RegionEasternEurope       Region = "Eastern Europe"
	RegionSoutheasternEurope  Region = "Southeastern Europe"
	RegionWesternEurope       Region = "Western Europe"
	RegionNorthAmerica        Region = "North America"
	RegionCentralAmerica      Region = "Central America"
	RegionSouthAmerica        Region = "South America"
	RegionCaribbean           Region = "Caribbean"
	RegionOceania             Region = "Oceania"
)

// ACLEDWeeklyAggregateBase contains the common fields for all aggregated ACLED data
type ACLEDWeeklyAggregateBase struct {
	// Week is the date of the Saturday marking the start of that week of aggregated data (Saturday to Friday)
	Week time.Time `json:"week"`

	// Region is the broad geographic classification
	Region Region `json:"region"`

	// Country is the country or territory identifier
	Country string `json:"country"`

	// Admin1 is the first-order administrative division (state, province, department, etc.)
	Admin1 string `json:"admin1"`

	// DisorderType is one of three broad categories: Political violence, Demonstrations, or Strategic developments
	DisorderType DisorderType `json:"disorder_type"`

	// EventType is one of six main event classifications
	EventType EventType `json:"event_type"`

	// SubEventType is the most detailed event type classification level
	// This will be one of the concrete sub-event types (BattlesSubEventType, RiotsSubEventType, etc.)
	SubEventType SubEventType `json:"sub_event_type"`

	// Events is the total number of discrete events recorded for the specified week, Admin1, and sub_event_type
	Events uint64 `json:"events"`

	// Fatalities is the sum of reported fatalities across the events for this row
	Fatalities uint64 `json:"fatalities"`

	// PopulationBest is the best aggregated estimate of people exposed to any events that week
	// NOTE: Users should not sum these values as they represent exposure estimates based on proximity
	PopulationBest uint64 `json:"population_best"`

	// CentroidLongitude is the longitude of the geographic center point for mapping the administrative district
	CentroidLongitude float64 `json:"centroid_longitude"`

	// CentroidLatitude is the latitude of the geographic center point for mapping the administrative district
	CentroidLatitude float64 `json:"centroid_latitude"`
}

// Type-safe event aggregates with compile-time enforced event/sub-event relationships
// These wrapper types ensure at compile time that only valid sub-event types are used with their parent event type

// BattlesAggregate ensures SubEventType can only be a BattlesSubEventType
type BattlesAggregate struct {
	ACLEDWeeklyAggregateBase
	TypedSubEventType BattlesSubEventType `json:"-"` // Use this for type-safe access
}

// ProtestsAggregate ensures SubEventType can only be a ProtestsSubEventType
type ProtestsAggregate struct {
	ACLEDWeeklyAggregateBase
	TypedSubEventType ProtestsSubEventType `json:"-"` // Use this for type-safe access
}

// RiotsAggregate ensures SubEventType can only be a RiotsSubEventType
type RiotsAggregate struct {
	ACLEDWeeklyAggregateBase
	TypedSubEventType RiotsSubEventType `json:"-"` // Use this for type-safe access
}

// ExplosionsRemoteViolenceAggregate ensures SubEventType can only be an ExplosionsRemoteViolenceSubEventType
type ExplosionsRemoteViolenceAggregate struct {
	ACLEDWeeklyAggregateBase
	TypedSubEventType ExplosionsRemoteViolenceSubEventType `json:"-"` // Use this for type-safe access
}

// ViolenceAgainstCiviliansAggregate ensures SubEventType can only be a ViolenceAgainstCiviliansSubEventType
type ViolenceAgainstCiviliansAggregate struct {
	ACLEDWeeklyAggregateBase
	TypedSubEventType ViolenceAgainstCiviliansSubEventType `json:"-"` // Use this for type-safe access
}

// StrategicDevelopmentsAggregate ensures SubEventType can only be a StrategicDevelopmentsSubEventType
type StrategicDevelopmentsAggregate struct {
	ACLEDWeeklyAggregateBase
	TypedSubEventType StrategicDevelopmentsSubEventType `json:"-"` // Use this for type-safe access
}

// ACLEDWeeklyAggregate is an alias for ACLEDWeeklyAggregateBase for backwards compatibility
// and to make it clear when you're working with the base type directly
type ACLEDWeeklyAggregate = ACLEDWeeklyAggregateBase

// Helper functions to get all possible sub-event types for each event type

func GetBattlesSubEventTypes() []BattlesSubEventType {
	return []BattlesSubEventType{
		BattlesGovernmentRegainsTerritory,
		BattlesNonStateActorOvertakesTerritory,
		BattlesArmedClash,
	}
}

func GetProtestsSubEventTypes() []ProtestsSubEventType {
	return []ProtestsSubEventType{
		ProtestsExcessiveForceAgainstProtesters,
		ProtestsProtestWithIntervention,
		ProtestsPeacefulProtest,
	}
}

func GetRiotsSubEventTypes() []RiotsSubEventType {
	return []RiotsSubEventType{
		RiotsViolentDemonstration,
		RiotsMobViolence,
	}
}

func GetExplosionsRemoteViolenceSubEventTypes() []ExplosionsRemoteViolenceSubEventType {
	return []ExplosionsRemoteViolenceSubEventType{
		ExplosionsRemoteViolenceChemicalWeapon,
		ExplosionsRemoteViolenceAirDroneStrike,
		ExplosionsRemoteViolenceSuicideBomb,
		ExplosionsRemoteViolenceShellingArtilleryMissile,
		ExplosionsRemoteViolenceRemoteExplosiveLandmineIED,
		ExplosionsRemoteViolenceGrenade,
	}
}

func GetViolenceAgainstCiviliansSubEventTypes() []ViolenceAgainstCiviliansSubEventType {
	return []ViolenceAgainstCiviliansSubEventType{
		ViolenceAgainstCiviliansSexualViolence,
		ViolenceAgainstCiviliansAttack,
		ViolenceAgainstCiviliansAbductionForcedDisappear,
	}
}

func GetStrategicDevelopmentsSubEventTypes() []StrategicDevelopmentsSubEventType {
	return []StrategicDevelopmentsSubEventType{
		StrategicDevelopmentsAgreement,
		StrategicDevelopmentsArrests,
		StrategicDevelopmentsChangeToGroupActivity,
		StrategicDevelopmentsDisruptedWeaponsUse,
		StrategicDevelopmentsHeadquartersOrBaseEstablished,
		StrategicDevelopmentsLootingPropertyDestruction,
		StrategicDevelopmentsNonViolentTransferOfTerritory,
		StrategicDevelopmentsOther,
	}
}
