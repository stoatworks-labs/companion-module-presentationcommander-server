// Thin wrapper around the Master Server's automation API
// (presentation-commander-server/src/main/services/automationApi.ts) —
// GET /state for the live source/scene/output/client list, POST /rpc for
// commands. Node 22's global fetch, no extra dependency.

export async function fetchState(self) {
	const url = `http://${self.config.host}:${self.config.port}/state`
	const res = await fetch(url)
	if (!res.ok) throw new Error(`GET /state failed: HTTP ${res.status}`)
	return res.json()
}

export async function sendCommand(self, command) {
	const url = `http://${self.config.host}:${self.config.port}/rpc`
	const res = await fetch(url, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(command),
	})
	const body = await res.json().catch(() => ({}))
	if (!res.ok || body.ok === false) {
		throw new Error(body.error || `POST /rpc failed: HTTP ${res.status}`)
	}
	return body
}
