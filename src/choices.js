// Dropdown choice lists derived from the last-polled OrchestratorState
// (self.state, refreshed by main.js's poll loop) — shared between
// actions.js and feedbacks.js so both stay in sync with whatever the
// server's current sources/scenes/outputs/clients actually are, instead
// of requiring the operator to know generated ids by heart.

export function outputChoices(self) {
	return (self.state?.outputs ?? []).map((o) => ({ id: o.id, label: o.name }))
}

/** Anything an output can be routed to: a full scene, or a bare source. */
export function routeTargetChoices(self) {
	const scenes = (self.state?.scenes ?? []).map((s) => ({ id: s.id, label: `Scene: ${s.name}` }))
	const sources = (self.state?.sources ?? []).map((s) => ({ id: s.id, label: `Source: ${s.name}` }))
	return [{ id: '', label: '— Unrouted —' }, ...scenes, ...sources]
}

export function sceneChoices(self) {
	return (self.state?.scenes ?? []).map((s) => ({ id: s.id, label: s.name }))
}

export function clientChoices(self) {
	return (self.state?.clients ?? []).map((c) => ({ id: c.id, label: `${c.name} (${c.app})` }))
}
