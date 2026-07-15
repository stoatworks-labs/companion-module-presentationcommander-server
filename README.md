# companion-module-presentationcommander-server

> **AI-assisted project.** This module was built with the help of
> [Claude](https://claude.ai), Anthropic's AI assistant — including
> implementation and documentation. Review it accordingly before relying on
> it in production.

A [Bitfocus Companion](https://bitfocus.io/companion) connection module for
[Presentation Commander](https://github.com/allansargeant/presentation-commander-server) —
control a running Master Server from a Stream Deck or any other Companion
surface: route outputs, recall scenes, blackout, send stage notes, and
drive next/previous slide on connected Client Nodes.

It talks to the Master Server's existing JSON-RPC automation API (`:9700`)
over plain HTTP — no separate integration to install on the server side.

## What it does

- **Actions** — Route Output, Blackout Output, Recall Scene to Output, Send
  Note to Stage, Next Slide, Previous Slide. Every output/scene/source/client
  dropdown is populated live from the Master Server's current state, so the
  list always matches what's actually configured — no hand-typed ids.
- **Feedbacks** — *Output is routed to a specific source/scene* (highlight a
  button when a given output is showing what you expect) and *Client Node
  is online* (highlight while a given presentation laptop is connected).
- **Variables** — `connection_status`, `client_count`, and one
  `routed_<output-id>` variable per output holding the name of whatever
  it's currently routed to (or `Unrouted`).
- Polls the Master Server every 3 seconds; action/feedback/variable choice
  lists and values refresh automatically as outputs, scenes, sources, or
  clients change.

## Setup

1. Install and enable this module in Companion (see **Installing** below).
2. Add a new connection using it, and set:
   - **Master Server host** — the machine running Presentation Commander
     Master Server (default `127.0.0.1`, i.e. Companion running on the same
     machine as the Master Server).
   - **Automation API port** — default `9700`, matches the Master Server's
     built-in automation API.
3. The connection should go green once it can reach `GET /state`.

### If Companion runs on a different machine

The Master Server's automation API listens on `127.0.0.1` only by
design — it executes routing/scene commands with no authentication, so
exposing it to the network is a deliberate operator choice, not something
Presentation Commander defaults to. If your Stream Deck / Companion install
is on a separate machine from the Master Server, reach port `9700` via an
SSH tunnel or a reverse proxy that adds its own authentication, then point
this module's **Master Server host**/**port** fields at that tunnel/proxy
instead of the raw port.

## Installing (development / not yet in the Companion module store)

```sh
git clone https://github.com/allansargeant/companion-module-presentationcommander-server.git
cd companion-module-presentationcommander-server
npm install
```

Then in Companion: **Settings → Developer Modules** (or the equivalent for
your Companion version) → add this directory as a local module.

## Relationship to the rest of Presentation Commander

- [presentation-commander-server](https://github.com/allansargeant/presentation-commander-server) —
  the Master Server this module controls. Its `src/main/services/automationApi.ts`
  is the HTTP surface this module talks to (`GET /state`, `POST /rpc`),
  shared with the in-app Control Surface panel so both paths behave
  identically.
- [presentation-commander-client](https://github.com/allansargeant/presentation-commander-client) —
  the Client Node app that runs on each presentation laptop; `next-slide`/
  `previous-slide` actions here are forwarded to whichever Client Node you
  target.

## License

MIT
