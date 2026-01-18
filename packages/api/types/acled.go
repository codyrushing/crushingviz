package types

/* ***************************
 * * ACLED CUSTOM DATA TYPES *
 * ***************************
 */
type DisorderType string

const (
	Demonstrations                  DisorderType = "Demonstrations"
	PoliticalViolence               DisorderType = "Political violence"
	PoliticalViolenceDemonstrations DisorderType = "Political violence; Demonstrations"
	StrategicDevelopments           DisorderType = "Strategic developments"
)

type EventType string

const (
	Battles                    EventType = "Battles"
	Protests                   EventType = "Protests"
	Riots                      EventType = "Riots"
	ExplosionsRemoteViolence   EventType = "Explosions / Remote violence"
	ViolenceAgainstCivilians   EventType = "Violence against civilians"
	StrategicDevelopmentsEvent EventType = "Strategic developments"
)

type SubEventType string

const (
	GovernmentRegainsTerritory      SubEventType = "Government regains territory"
	NonStateActorOvertakesTerritory SubEventType = "Non-state actor overtakes territory"
	ArmedClash                      SubEventType = "Armed clash"
	// TODO add more from the ACLED codebook
)

// https://acleddata.com/faq-codebook-tools#acleds-aggregated-data-0
type ACLEDWeeklyAggregate struct {
	Week int64 `json:"week"`
	// TODO make this an enum
	Region             string       `json:"region"`
	Country            string       `json:"country"`
	Admin1             string       `json:"admin1"`
	DisorderType       DisorderType `json:"disorderType"`
	EventType          EventType    `json:"eventType"`
	SubEventType       SubEventType `json:"subEventType"`
	EventCount         uint64       `json:"eventCount"`
	FatalityCount      uint64       `json:"fatalityCount"`
	PopulationExposure uint64       `json:"populationExposure"`
}
