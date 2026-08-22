# Presentation Commander Server

Drives a Presentation Commander **Master Server** from a control surface — route
outputs, recall scenes, blackout, send stage notes and step slides.

## Connection

**Master Server host**, default `127.0.0.1`, and the **automation API port**,
default `9700`. The connection goes green once it can reach `GET /state`.

**That API has no authentication**, which is why it binds loopback only. If
Companion is on another machine, reach port 9700 through an SSH tunnel or a
reverse proxy that adds authentication of its own and point this module at
*that* — do not simply open the port. Anyone who can reach it can re-route every
output on a running show.

Every output, scene, source and client dropdown is filled from the server's
current state, so the lists always match what is really configured.

## What a press does

**It changes what the audience sees, immediately.** No confirmation, no undo.

## Three things that will mislead you

**Slide buttons can succeed without moving anything.** Next and Previous are
passed to the Client Node — *if that client is connected*. If it is not, the
server steps its own counter and reports success anyway, and this module cannot
tell the difference. The button behaves exactly as though it worked while the
projector does not move. **Put the *Client Node is online* feedback on those
buttons**; it is the only warning available.

**Feedbacks keep showing the last thing they saw.** If the connection drops, the
module marks itself failed and sets `connection_status` to `Disconnected` — but
the routing and client feedbacks go on displaying stale state. A green "on air"
button can be green while the module has no idea what is on air. **Put
`$(<instance>:connection_status)` somewhere visible on every page with routing
buttons.** That variable is the honest one.

**Everything lags by up to 3 seconds.** The module polls; there is no live push.
A route changed from the server's own UI or another surface will not light here
until the next poll — so a button that has not lit *yet* is not a failed command.

## Variables

`connection_status`, `client_count`, and one `routed_<output-id>` per output
holding the name of whatever it is currently showing, or `Unrouted`.
