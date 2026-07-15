// Called from main.js only once self.state is populated (see
// updateVariableDefinitions there), so self.state.outputs is always
// present here.
//
// setVariableDefinitions expects an object keyed by variable id (not an
// array) — @companion-module/base throws "Variable definitions should be
// an object, not an array" otherwise.
export default function UpdateVariableDefinitions(self, safeVariableId) {
	const defs = {
		connection_status: { name: 'Connection status' },
		client_count: { name: 'Connected Client Nodes' },
	}
	for (const output of self.state.outputs) {
		defs[`routed_${safeVariableId(output.id)}`] = { name: `Routed source/scene — ${output.name}` }
	}
	self.setVariableDefinitions(defs)
}
