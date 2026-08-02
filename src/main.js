import { InstanceBase, Regex, InstanceStatus } from "@companion-module/base";
import { UpgradeScripts } from "./upgrades.js";
import UpdateActions from "./actions.js";
import UpdateFeedbacks from "./feedbacks.js";
import UpdateVariableDefinitions from "./variables.js";
import UpdatePresets from "./presets.js";
import { fetchState } from "./api.js";

// The module POLLS; it does not subscribe. The Master Server has a WebSocket
// (its client hub, :9800) but that is for Client Nodes, not control surfaces —
// the automation API this module talks to is request/response only.
//
// Consequence for an operator: every feedback and variable lags reality by up
// to one interval. A route changed from the server's own UI, or by a second
// surface, does not light the corresponding button until the next poll. Worth
// remembering before pressing a button twice.
const POLL_INTERVAL_MS = 3000;

/** Companion variable ids are stripped down to safe tokens — the server's
 *  generated ids (e.g. "out-stage-1") already are, but this guards against
 *  future id formats gaining characters Companion doesn't like. */
function safeVariableId(id) {
  return String(id).replace(/[^a-zA-Z0-9_]/g, "_");
}

export default class ModuleInstance extends InstanceBase {
  constructor(internal) {
    super(internal);
    this.state = null; // last-polled OrchestratorState from GET /state
    this.pollTimer = null;
  }

  async init(config, _isFirstInit, _secrets) {
    this.config = config;
    this.updateStatus(InstanceStatus.Connecting);
    this.updateActions();
    this.updateFeedbacks();
    this.updateVariableDefinitions();
    this.updatePresets();
    this.startPolling();
  }

  async destroy() {
    this.stopPolling();
  }

  async configUpdated(config, _secrets) {
    this.config = config;
    this.stopPolling();
    this.startPolling();
  }

  getConfigFields() {
    return [
      {
        type: "static-text",
        id: "info",
        width: 12,
        label: "Connection",
        value:
          "Points at the Master Server's automation API (127.0.0.1-only by default — see the module README if Companion runs on a different machine).",
      },
      {
        type: "textinput",
        id: "host",
        label: "Master Server host",
        width: 8,
        default: "127.0.0.1",
        regex: Regex.HOSTNAME,
      },
      {
        type: "textinput",
        id: "port",
        label: "Automation API port",
        width: 4,
        default: "9700",
        regex: Regex.PORT,
      },
    ];
  }

  startPolling() {
    this.pollTimer = setInterval(() => this.poll(), POLL_INTERVAL_MS);
    this.poll();
  }

  stopPolling() {
    if (this.pollTimer) clearInterval(this.pollTimer);
    this.pollTimer = null;
  }

  /**
   * One poll: fetch state, and if anything changed, re-register everything.
   *
   * The re-registration is not incidental — it is what refreshes the dropdown
   * choice lists in actions and feedbacks as the server's sources, scenes,
   * outputs and clients come and go. Removing it leaves an operator picking
   * from a stale list.
   *
   * Change detection is JSON.stringify equality over the WHOLE state, so
   * anything the server touches (an audio level, a timestamp) counts as a
   * change and triggers a full re-register. Cheap enough at this scale; worth
   * knowing if the state object grows.
   *
   * On failure the instance goes to ConnectionFailure and connection_status
   * reads Disconnected — but note this.state is deliberately NOT cleared.
   * That keeps the dropdowns populated through a brief blip, and it means
   * both feedbacks carry on evaluating against stale state: a route button
   * stays green while the module has no idea what is actually on air. The
   * project's own principle is to prefer failing safe, so this is a
   * knowing trade rather than an oversight; the docs tell operators to put
   * connection_status on any page with routing buttons. If you make
   * feedbacks go dark on disconnect, update docs/API.md and
   * docs/USER-GUIDE.md, and weigh empty dropdowns mid-blip as the cost.
   */
  async poll() {
    try {
      const state = await fetchState(this);
      const changed = JSON.stringify(state) !== JSON.stringify(this.state);
      this.state = state;
      this.updateStatus(InstanceStatus.Ok);
      if (changed) {
        // Re-registering picks up any new/removed sources, scenes,
        // outputs, or clients in the dropdown choice lists.
        this.updateActions();
        this.updateFeedbacks();
        this.updateVariableDefinitions();
        this.updatePresets();
        this.refreshVariableValues();
        this.checkAllFeedbacks();
      }
    } catch (err) {
      this.updateStatus(InstanceStatus.ConnectionFailure, err.message);
      this.setVariableValues({ connection_status: "Disconnected" });
    }
  }

  /**
   * Push current values for every variable.
   *
   * routed_* resolves the routed id to a NAME by looking in scenes first and
   * then sources — the server keeps both in one id space on
   * MatrixOutput.routedSourceId, so anything reading that field has to check
   * both collections.
   */
  refreshVariableValues() {
    if (!this.state) return;
    const values = {
      connection_status: "Connected",
      client_count: this.state.clients.filter((c) => c.online).length,
    };
    for (const output of this.state.outputs) {
      const routedId = output.routedSourceId;
      const routed = routedId
        ? (this.state.scenes.find((s) => s.id === routedId) ??
          this.state.sources.find((s) => s.id === routedId))
        : null;
      values[`routed_${safeVariableId(output.id)}`] =
        routed?.name ?? "Unrouted";
    }
    this.setVariableValues(values);
  }

  updateActions() {
    UpdateActions(this);
  }

  updateFeedbacks() {
    UpdateFeedbacks(this);
  }

  /**
   * Presets are generated from the polled state, so they are re-registered
   * alongside the actions and feedbacks whenever it changes — a scene added
   * mid-show should appear in the preset list without a reconnect.
   */
  updatePresets() {
    UpdatePresets(this);
  }

  /**
   * Variable DEFINITIONS only — values are set in refreshVariableValues().
   *
   * Definitions can't be built before the first successful poll, because the
   * routed_* set is derived from the server's output list. Against a server
   * that has never been reachable there are therefore no routed_* variables
   * at all, rather than a set reading "Unrouted".
   */
  updateVariableDefinitions() {
    if (!this.state) {
      this.setVariableDefinitions({});
      return;
    }
    UpdateVariableDefinitions(this, safeVariableId);
  }
}

export { UpgradeScripts };
