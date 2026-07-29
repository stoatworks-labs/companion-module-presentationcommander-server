// Thin wrapper around the Master Server's automation API
// (presentation-commander-server/src/main/services/automationApi.ts) —
// GET /state for the live source/scene/output/client list, POST /rpc for
// commands. Node 22's global fetch, no extra dependency.
//
// The command shapes here are half of a contract kept in sync BY HAND across
// three repos (server, client, this module). When the server's
// AutomationCommand union or OrchestratorState shape changes, nothing imports
// across repos to catch it — a Stream Deck button just stops working, mid-show,
// with no error anywhere obvious. See AGENTS.md.
//
// The server binds this API to 127.0.0.1 with no authentication, which is why
// the module's default host is loopback. Reaching it from another machine needs
// a tunnel or an authenticating proxy, not a config change.

export async function fetchState(self) {
	const url = `http://${self.config.host}:${self.config.port}/state`
	const res = await fetch(url)
	if (!res.ok) throw new Error(`GET /state failed: HTTP ${res.status}`)
	return res.json()
}

/**
 * POST one command and treat the server's own ok flag as authoritative.
 *
 * A 200 carrying {ok:false} is a failure — the automation API answers 400 for
 * a rejected command but this guards the case anyway, and prefers body.error
 * over the status code so the operator sees the server's own wording.
 *
 * What a resolved promise does NOT prove: that anything happened at the far
 * end. next-slide/previous-slide in particular are forwarded by the server to a
 * Client Node only if that client is connected; otherwise the server steps its
 * own counter and still reports success. There is no field distinguishing the
 * two, so don't build UI state on this returning. The "Client Node is online"
 * feedback is the honest signal.
 */
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
