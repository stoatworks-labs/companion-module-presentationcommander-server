# Companion Module — Interfaces

What the module exposes to Companion (actions, feedbacks, variables, config), and what it
consumes from the Master Server.

| §                        | Interface        | Source                            |
| ------------------------ | ---------------- | --------------------------------- |
| [1](#1-config-fields)    | Config fields    | `src/main.js`                     |
| [2](#2-actions)          | Actions          | `src/actions.js`                  |
| [3](#3-feedbacks)        | Feedbacks        | `src/feedbacks.js`                |
| [4](#4-variables)        | Variables        | `src/variables.js`, `src/main.js` |
| [5](#5-what-it-consumes) | What it consumes | `src/api.js`                      |
| [6](#6-the-poll-loop)    | The poll loop    | `src/main.js`                     |

Module id `presentationcommander-server`, manufacturer _Presentation Commander_.

---

## 1. Config fields

| Field  | Default     | Validation       |
| ------ | ----------- | ---------------- |
| `host` | `127.0.0.1` | `Regex.HOSTNAME` |
| `port` | `9700`      | `Regex.PORT`     |

The default host is `127.0.0.1` because **the Master Server's automation API binds loopback
only** — deliberately, since it executes commands with no authentication. If Companion runs on a
different machine you need a tunnel or an authenticating proxy; the README covers it.

---

## 2. Actions

Six. Each posts a single command object to the server's `POST /rpc`.

| Action                     | Options              | Command sent                                   |
| -------------------------- | -------------------- | ---------------------------------------------- |
| **Route Output**           | Output, Source/Scene | `{ type: 'route', outputId, sourceId }`        |
| **Blackout Output**        | Output               | `{ type: 'blackout', outputId }`               |
| **Recall Scene to Output** | Output, Scene        | `{ type: 'recall-preset', outputId, sceneId }` |
| **Send Note to Stage**     | Message (text)       | `{ type: 'send-note', message }`               |
| **Next Slide**             | Client Node          | `{ type: 'next-slide', clientId }`             |
| **Previous Slide**         | Client Node          | `{ type: 'previous-slide', clientId }`         |

**Every dropdown is populated from the last-polled server state** (`src/choices.js`), so an
operator picks real names rather than knowing generated ids by heart. The route target list
combines **`Scene: <name>`** and **`Source: <name>`** entries plus a leading **`— Unrouted —`**,
because an output's `routedSourceId` can hold either a scene id or a source id.

Behaviours worth knowing:

- **Route with the empty choice sends `sourceId: null`** — the same thing as Blackout. Both
  actions exist because they read differently on a button.
- **Defaults are `choices[0]` at registration time.** If the server had no outputs when the
  module last registered, a newly created button's Output field defaults to empty.
- **Next/Previous Slide are forwarded to the server, which may or may not reach a real deck.**
  If the target Client Node isn't connected, the server simulates locally and still reports
  success — see the server's API doc. **This module cannot tell the difference**, so a lit,
  successful button does not prove the projector moved. Pair those buttons with the _Client Node
  is online_ feedback (§3).

---

## 3. Feedbacks

Two, both boolean, both defaulting to a green background.

| Feedback                                        | Options              | True when                                                               |
| ----------------------------------------------- | -------------------- | ----------------------------------------------------------------------- |
| **Output is routed to a specific source/scene** | Output, Source/Scene | that output's `routedSourceId` equals the chosen target (`''` ⇒ `null`) |
| **Client Node is online**                       | Client Node          | that client's `online` flag is set                                      |

Both read from `self.state`, the **last-polled** `OrchestratorState`.

> **⚠ `self.state` is not cleared when the connection drops.** On a failed poll the module sets
> its Companion status to `ConnectionFailure` and the `connection_status` variable to
> `Disconnected` — but **it keeps the last state, so both feedbacks carry on evaluating against
> it.**
>
> In practice: **a button keeps showing green for a route that may no longer be on air**, and the
> only signal is the instance status and the `connection_status` variable. If a surface must fail
> safe, put `$(…:connection_status)` somewhere visible on the same page.

---

## 4. Variables

| Variable            | Value                                              |
| ------------------- | -------------------------------------------------- |
| `connection_status` | `Connected` / `Disconnected`                       |
| `client_count`      | number of **online** Client Nodes                  |
| `routed_<outputId>` | the routed scene or source **name**, or `Unrouted` |

`routed_*` ids are sanitised: any character outside `[a-zA-Z0-9_]` becomes `_`. The server's
generated ids (`out-stage-1`) already are safe; the guard is for future id formats.

**The name is resolved scene-first, then source** — matching how `routedSourceId` shares one id
space across both.

Two implementation notes that affect behaviour:

- **Variable _definitions_ are only registered once `self.state` is populated.** Before the first
  successful poll, `setVariableDefinitions({})` is called — so on a server that has never been
  reachable, no `routed_*` variables exist at all.
- **`setVariableDefinitions` takes an object keyed by variable id, not an array.**
  `@companion-module/base` throws _"Variable definitions should be an object, not an array"_
  otherwise.

---

## 5. What it consumes

A thin wrapper over the Master Server's automation API
(`presentation-commander-server/src/main/services/automationApi.ts`), using Node 22's global
`fetch` — **no extra dependency.**

| Call                     | Endpoint                                                         |
| ------------------------ | ---------------------------------------------------------------- |
| `fetchState(self)`       | `GET http://<host>:<port>/state` → the whole `OrchestratorState` |
| `sendCommand(self, cmd)` | `POST http://<host>:<port>/rpc`                                  |

**`sendCommand` treats `body.ok === false` as a failure even on HTTP 200**, then prefers
`body.error` over the status code for the message. `GET /state` failing non-2xx throws
`GET /state failed: HTTP <status>`.

> **The wire protocol is shared by three repos and kept in sync by hand.** See
> [DEVELOPING.md](DEVELOPING.md) §1.

---

## 6. The poll loop

**Polling, every 3000 ms.** There is no push channel and no WebSocket — the server has one, but
this module doesn't use it.

Consequences:

- **Feedback and variables lag reality by up to 3 seconds.** A route changed from the server's
  own UI won't light the corresponding button immediately.
- **The poll fires once immediately on start and on `configUpdated`**, so a config change takes
  effect without waiting a cycle.
- **On any change, the module re-registers actions, feedbacks and variable definitions**, then
  refreshes values and calls `checkFeedbacks()`. That is what picks up new or removed sources,
  scenes, outputs and clients in the dropdowns — **including while a button's edit dialog is
  open.**
- **Change detection is `JSON.stringify` equality on the whole state.** Anything the server
  touches — an audio level, a timestamp — counts as a change and triggers a full re-registration.

---

## See also

- [USER-GUIDE.md](USER-GUIDE.md) — building a surface with it
- [DEVELOPING.md](DEVELOPING.md) — the three-repo protocol and the module conventions
- [README](../README.md) — setup, remote Companion, installing
