import { InstanceBase, Regex, InstanceStatus } from '@companion-module/base'
import { UpgradeScripts } from './upgrades.js'
import UpdateActions from './actions.js'
import UpdateFeedbacks from './feedbacks.js'
import UpdateVariableDefinitions from './variables.js'
import { fetchState } from './api.js'

const POLL_INTERVAL_MS = 3000

/** Companion variable ids are stripped down to safe tokens — the server's
 *  generated ids (e.g. "out-stage-1") already are, but this guards against
 *  future id formats gaining characters Companion doesn't like. */
function safeVariableId(id) {
	return String(id).replace(/[^a-zA-Z0-9_]/g, '_')
}

export default class ModuleInstance extends InstanceBase {
	constructor(internal) {
		super(internal)
		this.state = null // last-polled OrchestratorState from GET /state
		this.pollTimer = null
	}

	async init(config, _isFirstInit, _secrets) {
		this.config = config
		this.updateStatus(InstanceStatus.Connecting)
		this.updateActions()
		this.updateFeedbacks()
		this.updateVariableDefinitions()
		this.startPolling()
	}

	async destroy() {
		this.stopPolling()
	}

	async configUpdated(config, _secrets) {
		this.config = config
		this.stopPolling()
		this.startPolling()
	}

	getConfigFields() {
		return [
			{
				type: 'static-text',
				id: 'info',
				width: 12,
				label: 'Connection',
				value:
					'Points at the Master Server\'s automation API (127.0.0.1-only by default — see the module README if Companion runs on a different machine).',
			},
			{
				type: 'textinput',
				id: 'host',
				label: 'Master Server host',
				width: 8,
				default: '127.0.0.1',
				regex: Regex.HOSTNAME,
			},
			{
				type: 'textinput',
				id: 'port',
				label: 'Automation API port',
				width: 4,
				default: '9700',
				regex: Regex.PORT,
			},
		]
	}

	startPolling() {
		this.pollTimer = setInterval(() => this.poll(), POLL_INTERVAL_MS)
		this.poll()
	}

	stopPolling() {
		if (this.pollTimer) clearInterval(this.pollTimer)
		this.pollTimer = null
	}

	async poll() {
		try {
			const state = await fetchState(this)
			const changed = JSON.stringify(state) !== JSON.stringify(this.state)
			this.state = state
			this.updateStatus(InstanceStatus.Ok)
			if (changed) {
				// Re-registering picks up any new/removed sources, scenes,
				// outputs, or clients in the dropdown choice lists.
				this.updateActions()
				this.updateFeedbacks()
				this.updateVariableDefinitions()
				this.refreshVariableValues()
				this.checkFeedbacks()
			}
		} catch (err) {
			this.updateStatus(InstanceStatus.ConnectionFailure, err.message)
			this.setVariableValues({ connection_status: 'Disconnected' })
		}
	}

	refreshVariableValues() {
		if (!this.state) return
		const values = {
			connection_status: 'Connected',
			client_count: this.state.clients.filter((c) => c.online).length,
		}
		for (const output of this.state.outputs) {
			const routedId = output.routedSourceId
			const routed = routedId
				? (this.state.scenes.find((s) => s.id === routedId) ??
					this.state.sources.find((s) => s.id === routedId))
				: null
			values[`routed_${safeVariableId(output.id)}`] = routed?.name ?? 'Unrouted'
		}
		this.setVariableValues(values)
	}

	updateActions() {
		UpdateActions(this)
	}

	updateFeedbacks() {
		UpdateFeedbacks(this)
	}

	updateVariableDefinitions() {
		if (!this.state) {
			this.setVariableDefinitions({})
			return
		}
		UpdateVariableDefinitions(this, safeVariableId)
	}
}

export { UpgradeScripts }
