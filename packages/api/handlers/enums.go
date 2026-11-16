package handlers

import "api.crushingviz.info/types/acled"

// Accepted values for the enum filters, derived from the domain types so the
// API can't accept a value the ACLED codebook doesn't define.
var (
	validDisorderTypes = newValueSet(
		acled.DisorderTypePoliticalViolence,
		acled.DisorderTypeDemonstrations,
		acled.DisorderTypeStrategic,
		acled.DisorderTypePoliticalViolenceDemonstrations,
	)

	validEventTypes = newValueSet(
		acled.EventTypeBattles,
		acled.EventTypeProtests,
		acled.EventTypeRiots,
		acled.EventTypeExplosionsRemoteViolence,
		acled.EventTypeViolenceAgainstCivilians,
		acled.EventTypeStrategicDevelopments,
	)

	validSubEventTypes = func() map[string]struct{} {
		all := make([]acled.SubEventType, 0, 25)
		all = append(all, acled.GetBattlesSubEventTypes()...)
		all = append(all, acled.GetProtestsSubEventTypes()...)
		all = append(all, acled.GetRiotsSubEventTypes()...)
		all = append(all, acled.GetExplosionsRemoteViolenceSubEventTypes()...)
		all = append(all, acled.GetViolenceAgainstCiviliansSubEventTypes()...)
		all = append(all, acled.GetStrategicDevelopmentsSubEventTypes()...)
		return newValueSet(all...)
	}()
)

func newValueSet[T ~string](values ...T) map[string]struct{} {
	set := make(map[string]struct{}, len(values))
	for _, value := range values {
		set[string(value)] = struct{}{}
	}
	return set
}
