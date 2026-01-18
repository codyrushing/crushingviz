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

// SubEventType represents the most detailed event type classification (25 total)
type SubEventType string

const (
	// Battles sub-event types
	SubEventTypeGovernmentRegainsTerritory      SubEventType = "Government regains territory"
	SubEventTypeNonStateActorOvertakesTerritory SubEventType = "Non-state actor overtakes territory"
	SubEventTypeArmedClash                      SubEventType = "Armed clash"

	// Protests sub-event types
	SubEventTypeExcessiveForceAgainstProtesters SubEventType = "Excessive force against protesters"
	SubEventTypeProtestWithIntervention         SubEventType = "Protest with intervention"
	SubEventTypePeacefulProtest                 SubEventType = "Peaceful protest"

	// Riots sub-event types
	SubEventTypeViolentDemonstration SubEventType = "Violent demonstration"
	SubEventTypeMobViolence          SubEventType = "Mob violence"

	// Explosions/Remote violence sub-event types
	SubEventTypeChemicalWeapon               SubEventType = "Chemical weapon"
	SubEventTypeAirDroneStrike               SubEventType = "Air/drone strike"
	SubEventTypeSuicideBomb                  SubEventType = "Suicide bomb"
	SubEventTypeShellingArtilleryMissile     SubEventType = "Shelling/artillery/missile attack"
	SubEventTypeRemoteExplosiveLandmineIED   SubEventType = "Remote explosive/landmine/IED"
	SubEventTypeGrenade                      SubEventType = "Grenade"

	// Violence against civilians sub-event types
	SubEventTypeSexualViolence            SubEventType = "Sexual violence"
	SubEventTypeAttack                    SubEventType = "Attack"
	SubEventTypeAbductionForcedDisappear  SubEventType = "Abduction/forced disappearance"

	// Strategic developments sub-event types
	SubEventTypeAgreement                      SubEventType = "Agreement"
	SubEventTypeArrests                        SubEventType = "Arrests"
	SubEventTypeChangeToGroupActivity          SubEventType = "Change to group/activity"
	SubEventTypeDisruptedWeaponsUse            SubEventType = "Disrupted weapons use"
	SubEventTypeHeadquartersOrBaseEstablished  SubEventType = "Headquarters or base established"
	SubEventTypeLootingPropertyDestruction     SubEventType = "Looting/property destruction"
	SubEventTypeNonViolentTransferOfTerritory  SubEventType = "Non-violent transfer of territory"
	SubEventTypeOther                          SubEventType = "Other"
)

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

// ACLEDWeeklyAggregate represents aggregated ACLED data organized by week-country-admin1-event type
// Events and fatalities are summed across specified geographic and temporal parameters
type ACLEDWeeklyAggregate struct {
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
