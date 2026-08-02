# Companion Module — Developing

A Bitfocus Companion connection module for Presentation Commander. JavaScript, small repo —
15 tracked files.

---

## 1. ⚠ This is the repo people forget

It is one of three sharing a protocol:

| Repo                                 | Role                                              |
| ------------------------------------ | ------------------------------------------------- |
| **companion-module-…-server** (this) | Companion/Stream Deck control surface module      |
| **presentation-commander-server**    | Master control: NDI matrix routing, scenes, notes |
| **presentation-commander-client**    | Presentation laptop; bespoke PDF engine           |

> **When the server's protocol changes, the client usually gets updated because the pair is
> obvious — and this module quietly breaks, so a Stream Deck button stops working during a show
> with no error anywhere obvious.**
>
> **If you change the server's wire protocol, come here too.**

The contract this module depends on is the server's `AutomationCommand` union and the
`OrchestratorState` shape returned by `GET /state`
(`presentation-commander-server/src/shared/types.ts`). Nothing is imported across repos — it is
kept in sync by hand.

---

## 2. What working on it involves

Companion modules follow Bitfocus's conventions: **actions, feedbacks, variables and presets**
declared to the Companion runtime, plus a connection lifecycle against the target device.

Practical notes:

- **Actions are the buttons.** Adding a server capability that operators should reach from a
  surface means **adding an action here — the server gaining the feature isn't enough.**
- **Feedbacks are what makes a button light up correctly.** **A feedback that doesn't track real
  server state gives an operator a button that lies about what's on air.**
- **Keep the module's connection resilient**: a control surface that doesn't reconnect after a
  server restart is, in practice, a dead surface mid-event. The poll loop is what provides that
  today — it keeps retrying and recovers on its own.

**No presets are currently shipped** — there is no `src/presets.js`. Adding a preset set would be
a straightforward improvement for anyone building a surface from scratch.

---

## 3. Layout

```
src/
  main.js        InstanceBase: lifecycle, config fields, the 3 s poll loop,
                 variable values, safeVariableId()
  api.js         fetchState / sendCommand over the server's automation API
  actions.js     six actions
  feedbacks.js   two boolean feedbacks
  variables.js   variable DEFINITIONS (values live in main.js)
  choices.js     dropdown choice lists, shared by actions and feedbacks
  upgrades.js    Companion upgrade scripts
companion/manifest.json
```

**`choices.js` is shared by `actions.js` and `feedbacks.js` deliberately**, so both stay in sync
with whatever the server's current sources, scenes, outputs and clients actually are. Keep new
dropdowns going through it.

Node 22's **global `fetch`** — no HTTP dependency. Don't add one.

---

## 4. The poll loop, and what depends on it

`POLL_INTERVAL_MS = 3000`. There is **no push channel**; the server has a WebSocket, this module
doesn't use it.

On each poll:

1. `GET /state`
2. compare via **`JSON.stringify` equality on the whole state**
3. if changed: **re-register actions, feedbacks and variable definitions**, refresh values, and
   `checkFeedbacks()`
4. on failure: `InstanceStatus.ConnectionFailure` + `connection_status = 'Disconnected'`

Things to know before changing it:

- **Re-registering on change is what refreshes the dropdowns** as the server's lists change. It
  is not incidental.
- **The stringify comparison is coarse** — any field the server touches (an audio level, a
  timestamp) counts as a change and triggers a full re-registration. Cheap enough at this scale;
  worth knowing if the state grows.
- **`this.state` is deliberately _not_ cleared on failure.** That keeps dropdowns populated
  through a blip — but it also means **both feedbacks keep evaluating against stale state while
  disconnected**, so a route button stays green when the module has no idea what's on air.

  That sits in tension with §5's "don't invent a state to display when the connection is
  unknown". It is documented in [API.md](API.md) and [USER-GUIDE.md](USER-GUIDE.md) as current
  behaviour, with the advice to surface `connection_status` on the same page. **If you make
  feedbacks go dark on disconnect, update both docs** — and consider that empty dropdowns mid-blip
  is the cost.

- **Variable definitions are only registered once `self.state` exists** — before the first
  successful poll, `setVariableDefinitions({})` is called, so `routed_*` variables don't exist at
  all against a server that has never been reachable.
- **`setVariableDefinitions` takes an object keyed by id, not an array** —
  `@companion-module/base` throws _"Variable definitions should be an object, not an array"_
  otherwise. The comment in `variables.js` records this; keep it.

---

## 5. Context that matters

> **This drives live event production. A button press here changes what an audience sees. Prefer
> failing safe — don't invent a state to display when the server connection is unknown.**

Two specific places that principle applies:

- **Slide actions can succeed without moving anything.** If the target Client Node isn't
  connected, the server steps its own counter and returns success; this module cannot tell the
  difference. Don't build anything on the action's return value — the _Client Node is online_
  feedback is the real signal.
- **`routedSourceId` holds either a scene id or a source id in one field.** `routeTargetChoices`
  merges both lists with `Scene:` / `Source:` prefixes, and `refreshVariableValues` resolves
  **scene-first, then source**. Any new code touching routing has to handle both.

---

## 6. Conventions

- `safeVariableId()` strips ids to `[a-zA-Z0-9_]`. The server's generated ids are already safe;
  it's a guard against future id formats.
- Module id `presentationcommander-server`, manufacturer _Presentation Commander_.
- Not yet in the Companion module store — installed from a packaged release or as a local
  developer module. See the README.
- "Commit" means commit **and** push.

---

## See also

- [API.md](API.md) — actions, feedbacks, variables, config, the poll loop
- [USER-GUIDE.md](USER-GUIDE.md) — building a surface that fails safe
- [README](../README.md) — setup and installation
- [`AGENTS.md`](../AGENTS.md) — LLM onboarding
