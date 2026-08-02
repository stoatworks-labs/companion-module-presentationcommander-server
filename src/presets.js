// Variable references in preset text use `self.label`, the CONNECTION's label,
// not the module id. Companion resolves $(label:variable) against whatever the
// operator named this connection — hardcoding the module id produces buttons
// that render the raw $(...) text on any connection that has been renamed, and
// on a second instance of the same module.
//
// Routing presets are GENERATED from the Master Server's live outputs, sources,
// scenes and clients, because those are the show — a fixed preset list would be
// wrong for every event. One section per output containing a button per routable
// target is the matrix an operator already has in front of them.
//
// Nothing exists before the first successful poll. That is honest: the module
// does not yet know what outputs there are, and a "Route Output 1" button
// against a server that has no Output 1 routes nothing, silently.

const WHITE = 0xffffff;
const BLACK = 0x000000;
const GREY = 0x333333;
const RED = 0xcc0000;
const GREEN = 0x009900;
const AMBER = 0xcc7a00;
const DARKGREEN = 0x003300;
const BRIGHTGREEN = 0x00ff00;

/** Companion preset ids have to be stable across rebuilds or a button an
 *  operator already placed loses its link. The server's ids are already
 *  token-safe ("out-stage-1"), but sanitise anyway — the same guard main.js
 *  applies to variable ids. */
function safeId(id) {
  return String(id).replace(/[^a-zA-Z0-9_]/g, "_");
}

function preset({
  name,
  text,
  size = "14",
  color = WHITE,
  bgcolor = GREY,
  actions = [],
  feedbacks = [],
}) {
  return {
    type: "simple",
    name,
    style: { text, size, color, bgcolor, show_topbar: false },
    steps: [{ down: actions, up: [] }],
    feedbacks,
  };
}

export default function UpdatePresets(self) {
  const presets = {};
  const structure = [];

  const outputs = self.state?.outputs ?? [];
  const sources = self.state?.sources ?? [];
  const scenes = self.state?.scenes ?? [];
  const clients = self.state?.clients ?? [];

  // --- One section per output ---------------------------------------------
  for (const output of outputs) {
    const okey = safeId(output.id);
    const refs = [];

    // Scenes first, then bare sources — the same order the route dropdown
    // uses, because the server keeps both in one id space on
    // MatrixOutput.routedSourceId and an operator picking from a mixed list
    // needs the two groups to stay where they were last time.
    for (const scene of scenes) {
      const id = `route_${okey}_scene_${safeId(scene.id)}`;
      presets[id] = preset({
        name: `${output.name} <- scene ${scene.name}`,
        text: `${scene.name}`,
        bgcolor: BLACK,
        actions: [
          {
            actionId: "recallPreset",
            options: { outputId: output.id, sceneId: scene.id },
          },
        ],
        feedbacks: [
          {
            feedbackId: "outputRouted",
            options: { outputId: output.id, targetId: scene.id },
            style: { bgcolor: RED, color: WHITE },
          },
        ],
      });
      refs.push(id);
    }

    for (const source of sources) {
      const id = `route_${okey}_src_${safeId(source.id)}`;
      presets[id] = preset({
        name: `${output.name} <- ${source.name}`,
        text: `${source.name}`,
        bgcolor: BLACK,
        actions: [
          {
            actionId: "route",
            options: { outputId: output.id, sourceId: source.id },
          },
        ],
        feedbacks: [
          {
            feedbackId: "outputRouted",
            options: { outputId: output.id, targetId: source.id },
            style: { bgcolor: RED, color: WHITE },
          },
        ],
      });
      refs.push(id);
    }

    const blackId = `blackout_${okey}`;
    presets[blackId] = preset({
      name: `${output.name}: blackout`,
      text: `${output.name}\nBLACK`,
      bgcolor: BLACK,
      actions: [{ actionId: "blackout", options: { outputId: output.id } }],
      // The server represents "unrouted" as a null routedSourceId, and the
      // route feedback compares against the empty option — so the same feedback
      // that lights a crosspoint lights this one, with no separate definition.
      feedbacks: [
        {
          feedbackId: "outputRouted",
          options: { outputId: output.id, targetId: "" },
          style: { bgcolor: RED, color: WHITE },
        },
      ],
    });
    refs.push(blackId);

    const displayId = `routed_${okey}`;
    presets[displayId] = preset({
      name: `${output.name}: what is on it (no action)`,
      text: `${output.name}\n$(${self.label}:routed_${okey})`,
      bgcolor: BLACK,
      color: AMBER,
    });
    refs.push(displayId);

    structure.push({
      id: `output-${okey}`,
      name: `Output: ${output.name}`,
      description: `Route ${output.name}. Red is on air.`,
      definitions: [
        {
          id: `output-${okey}-main`,
          type: "simple",
          name: output.name,
          presets: refs,
        },
      ],
      keywords: ["route", "output", output.name],
    });
  }

  // --- One section per Client Node ----------------------------------------
  const clientRefs = [];
  for (const client of clients) {
    const ckey = safeId(client.id);
    presets[`next_${ckey}`] = preset({
      name: `${client.name}: next slide`,
      text: `${client.name}\nNEXT`,
      size: "18",
      bgcolor: GREEN,
      actions: [{ actionId: "nextSlide", options: { clientId: client.id } }],
      // Online, not "the slide advanced" — the server forwards next-slide to a
      // client only if it is connected, and otherwise steps its own counter and
      // still reports success. Online is the only honest signal here.
      feedbacks: [
        {
          feedbackId: "clientOnline",
          options: { clientId: client.id },
          style: { bgcolor: GREEN, color: WHITE },
        },
      ],
    });
    presets[`prev_${ckey}`] = preset({
      name: `${client.name}: previous slide`,
      text: `${client.name}\nPREV`,
      size: "18",
      actions: [{ actionId: "previousSlide", options: { clientId: client.id } }],
      feedbacks: [
        {
          feedbackId: "clientOnline",
          options: { clientId: client.id },
          style: { bgcolor: GREY, color: WHITE },
        },
      ],
    });
    presets[`online_${ckey}`] = preset({
      name: `${client.name}: online (no action)`,
      text: `${client.name}\nOFFLINE`,
      bgcolor: RED,
      feedbacks: [
        {
          feedbackId: "clientOnline",
          options: { clientId: client.id },
          style: {
            bgcolor: DARKGREEN,
            color: BRIGHTGREEN,
            text: `${client.name}\nONLINE`,
          },
        },
      ],
    });
    clientRefs.push(`next_${ckey}`, `prev_${ckey}`, `online_${ckey}`);
  }

  if (clientRefs.length > 0) {
    structure.push({
      id: "clients",
      name: "Client Nodes",
      description:
        "Slide buttons light from whether the Client Node is ONLINE, not from whether the slide advanced — the server forwards next/previous only to a connected client, and otherwise steps its own counter and still reports success.",
      definitions: [
        {
          id: "clients-main",
          type: "simple",
          name: "Client Nodes",
          presets: clientRefs,
        },
      ],
      keywords: ["slide", "next", "previous", "client"],
    });
  }

  // --- Stage notes and status ----------------------------------------------
  presets.note_clear = preset({
    name: "Clear the stage note",
    text: "CLEAR\nNOTE",
    actions: [{ actionId: "sendNote", options: { message: "" } }],
  });
  presets.note_wrap = preset({
    name: 'Stage note: "WRAP UP" (edit the text)',
    text: "NOTE\nWRAP UP",
    bgcolor: AMBER,
    color: BLACK,
    actions: [{ actionId: "sendNote", options: { message: "WRAP UP" } }],
  });
  presets.note_time = preset({
    name: 'Stage note: "5 MINUTES" (edit the text)',
    text: "NOTE\n5 MIN",
    bgcolor: AMBER,
    color: BLACK,
    actions: [{ actionId: "sendNote", options: { message: "5 MINUTES" } }],
  });

  presets.connected = preset({
    name: "Master Server is connected",
    text: `SERVER\n$(${self.label}:connection_status)`,
    bgcolor: RED,
    feedbacks: [
      // There is no feedback definition for the connection itself, so this
      // reads the variable through the button text and uses colour only for
      // the client count — keeping it honest without inventing a definition
      // the rest of the module does not have.
    ],
  });
  presets.client_count = preset({
    name: "Connected Client Nodes (no action)",
    text: `CLIENTS\n$(${self.label}:client_count)`,
    bgcolor: BLACK,
  });

  structure.push({
    id: "notes",
    name: "Stage notes and status",
    description:
      "The module polls; every feedback here lags reality by up to one interval, and keeps its last value if the server goes away. Keep the connection button on any page carrying routing colour.",
    definitions: [
      {
        id: "notes-main",
        type: "simple",
        name: "Notes and status",
        presets: ["note_wrap", "note_time", "note_clear", "connected", "client_count"],
      },
    ],
    keywords: ["note", "stage", "status"],
  });

  self.setPresetDefinitions(structure, presets);
}
