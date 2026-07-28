# AGENTS.md — bringing an LLM up to speed on this Companion module

Orientation for an AI assistant (or a new human) picking this project up cold. There is no
`CLAUDE.md` here; this is the entry point.

---

## 1. What this is

A **Bitfocus Companion connection module** for **Presentation Commander**. It lets a running
Master Server be driven from a **Stream Deck** (or any other Companion surface): route
outputs, recall scenes, blackout, send stage notes.

JavaScript. Small repo — 14 tracked files.

## 2. It is one of three repos sharing a protocol

| Repo | Role |
|---|---|
| **companion-module-...-server** (this) | Companion/Stream Deck control surface module |
| **presentation-commander-server** | Master control: NDI matrix routing, scenes, notes |
| **presentation-commander-client** | Presentation laptop; bespoke PDF engine |

**This is the repo people forget.** When the server's protocol changes, the client usually
gets updated because the pair is obvious — and this module quietly breaks, so a Stream Deck
button stops working during a show with no error anywhere obvious.

If you change the server's wire protocol, come here too.

## 3. What working on it involves

Companion modules follow Bitfocus's module conventions: actions, feedbacks, variables and
presets declared to the Companion runtime, plus a connection lifecycle against the target
device (here, the Master Server).

Practical notes:

- **Actions are the buttons.** Adding a server capability that operators should reach from a
  surface means adding an action here — the server gaining the feature isn't enough.
- **Feedbacks are what makes a button light up correctly.** A feedback that doesn't track
  real server state gives an operator a button that lies about what's on air.
- Keep the module's connection resilient: a control surface that doesn't reconnect after a
  server restart is, in practice, a dead surface mid-event.

## 4. Context that matters

This drives live event production. A button press here changes what an audience sees. Prefer
failing safe — don't invent a state to display when the server connection is unknown.

## 5. Conventions

- Ships a user-facing AI-assisted disclaimer; review before relying on it in production.
- "Commit" means commit **and** push.
