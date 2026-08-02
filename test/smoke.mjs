// Shape checks for the Master Server module, driven against a fake automation
// API on a real HTTP server. What this exists to catch: presets referencing an
// action or feedback that does not exist, presets built on the 1.x `category`
// shape (which loads and then never appears), and variable definitions handed
// to base 2.x as an array (which throws and kills init()).
import http from "node:http";
import assert from "node:assert/strict";

const watchdog = setTimeout(() => {
  console.error("\nTIMED OUT — no completion within 30s.");
  process.exit(2);
}, 30000);
watchdog.unref?.();

const MOD = new URL("../src/", import.meta.url).pathname;
const UpdateActions = (await import(`${MOD}actions.js`)).default;
const UpdateFeedbacks = (await import(`${MOD}feedbacks.js`)).default;
const UpdateVariables = (await import(`${MOD}variables.js`)).default;
const UpdatePresets = (await import(`${MOD}presets.js`)).default;
const { fetchState, sendCommand } = await import(`${MOD}api.js`);

const world = {
  outputs: [
    { id: "out-stage-1", name: "Stage L", routedSourceId: "src-cam1" },
    { id: "out-stage-2", name: "Stage R", routedSourceId: null },
  ],
  sources: [
    { id: "src-cam1", name: "Camera 1" },
    { id: "src-slides", name: "Slides" },
  ],
  scenes: [{ id: "scene-open", name: "Opening" }],
  clients: [
    { id: "cli-1", name: "Lectern", app: "Keynote", online: true },
    { id: "cli-2", name: "Spare", app: "PDF", online: false },
  ],
};
const commands = [];

const body = (req) =>
  new Promise((r) => {
    let b = "";
    req.on("data", (c) => (b += c));
    req.on("end", () => r(b));
  });

const server = http.createServer(async (req, res) => {
  const send = (code, obj) => {
    res.writeHead(code, { "Content-Type": "application/json" });
    res.end(JSON.stringify(obj));
  };
  if (req.url === "/state") return send(200, world);
  if (req.url === "/rpc") {
    const cmd = JSON.parse((await body(req)) || "{}");
    commands.push(cmd);
    if (cmd.type === "route") {
      const o = world.outputs.find((x) => x.id === cmd.outputId);
      if (!o) return send(400, { ok: false, error: "unknown output" });
      o.routedSourceId = cmd.sourceId;
    }
    if (cmd.type === "blackout") {
      const o = world.outputs.find((x) => x.id === cmd.outputId);
      if (o) o.routedSourceId = null;
    }
    if (cmd.type === "recall-preset") {
      const o = world.outputs.find((x) => x.id === cmd.outputId);
      if (o) o.routedSourceId = cmd.sceneId;
    }
    return send(200, { ok: true });
  }
  send(404, { error: "not found" });
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const PORT = server.address().port;

let actions = {};
let feedbacks = {};
let variables = null;
let presetStructure = null;
let presetDefs = null;

function safeVariableId(id) {
  return String(id).replace(/[^a-zA-Z0-9_]/g, "_");
}

const self = {
  config: { host: "127.0.0.1", port: String(PORT) },
  label: "Commander",
  state: null,
  log: () => {},
  updateStatus: () => {},
  checkFeedbacks: () => {},
  setActionDefinitions: (d) => (actions = d),
  setFeedbackDefinitions: (d) => (feedbacks = d),
  setVariableDefinitions: (d) => {
    if (Array.isArray(d))
      throw new Error("Variable definitions should be an object, not an array");
    variables = d;
  },
  setPresetDefinitions: (s, p) => {
    presetStructure = s;
    presetDefs = p;
  },
  setVariableValues: () => {},
  parseVariablesInString: async (s) => s,
};

self.state = await fetchState(self);
UpdateActions(self);
UpdateFeedbacks(self);
UpdateVariables(self, safeVariableId);
UpdatePresets(self);

let failures = 0;
const check = async (label, fn) => {
  try {
    await fn();
    console.log(`  ok   ${label}`);
  } catch (e) {
    failures++;
    console.log(`  FAIL ${label}\n       ${e.message}`);
  }
};
const fire = (id, options = {}) => actions[id].callback({ options });
const fb = (id, options = {}) => feedbacks[id].callback({ options }, {});

console.log("\n== definitions ==");
await check("6 actions, 2 feedbacks", () => {
  assert.equal(Object.keys(actions).length, 6);
  assert.equal(Object.keys(feedbacks).length, 2);
});
await check("variable definitions are an OBJECT with legal ids", () => {
  assert.ok(variables && !Array.isArray(variables));
  for (const id of Object.keys(variables))
    assert.match(id, /^[a-zA-Z0-9_]+$/, `${id} is a legal variable id`);
  assert.ok(variables["routed_out_stage_1"], "per-output variable, sanitised");
});

console.log("\n== presets ==");
await check("2.x shape: sections + type 'simple', no 1.x category", () => {
  assert.ok(Array.isArray(presetStructure));
  for (const [id, p] of Object.entries(presetDefs)) {
    assert.equal(p.type, "simple", `${id} type`);
    assert.ok(!("category" in p), `${id} must not use the 1.x category field`);
  }
});
await check("a section per output, generated from live state", () => {
  const ids = presetStructure.map((s) => s.id);
  assert.ok(ids.includes("output-out_stage_1"), ids.join(","));
  assert.ok(ids.includes("clients"));
});
await check("a crosspoint preset per output x (scene + source)", () => {
  assert.ok(presetDefs.route_out_stage_1_scene_scene_open);
  assert.ok(presetDefs.route_out_stage_1_src_src_cam1);
  assert.ok(presetDefs.blackout_out_stage_1);
});
await check("every preset action and feedback id exists", () => {
  for (const [id, p] of Object.entries(presetDefs)) {
    for (const st of p.steps)
      for (const a of st.down)
        assert.ok(actions[a.actionId], `${id} -> action ${a.actionId}`);
    for (const f of p.feedbacks)
      assert.ok(feedbacks[f.feedbackId], `${id} -> feedback ${f.feedbackId}`);
  }
});
await check("nothing orphaned or dangling in the structure", () => {
  const referenced = new Set(
    presetStructure.flatMap((s) => s.definitions.flatMap((g) => g.presets)),
  );
  for (const s of presetStructure)
    for (const g of s.definitions)
      for (const ref of g.presets) assert.ok(presetDefs[ref], `${s.id} -> ${ref}`);
  for (const id of Object.keys(presetDefs))
    assert.ok(referenced.has(id), `${id} defined but in no section`);
});
await check("preset variables use the connection label and all exist", () => {
  const texts = Object.values(presetDefs).map((p) => p.style.text).join("\n");
  assert.ok(texts.includes("$(Commander:"), "uses self.label");
  for (const m of texts.matchAll(/\$\(Commander:([a-zA-Z0-9_]+)\)/g))
    assert.ok(variables[m[1]], `${m[1]} is defined`);
});
await check("the blackout preset lights off the unrouted state", () => {
  const p = presetDefs.blackout_out_stage_1;
  assert.equal(p.feedbacks[0].feedbackId, "outputRouted");
  assert.equal(p.feedbacks[0].options.targetId, "");
});
await check("slide buttons light from client ONLINE, not from the slide", () => {
  assert.equal(presetDefs.next_cli_1.feedbacks[0].feedbackId, "clientOnline");
});

console.log("\n== behaviour ==");
await check("route lights the crosspoint tally", async () => {
  await fire("route", { outputId: "out-stage-1", sourceId: "src-slides" });
  self.state = await fetchState(self);
  assert.equal(
    fb("outputRouted", { outputId: "out-stage-1", targetId: "src-slides" }),
    true,
  );
});
await check("blackout reads as unrouted", async () => {
  await fire("blackout", { outputId: "out-stage-1" });
  self.state = await fetchState(self);
  assert.equal(
    fb("outputRouted", { outputId: "out-stage-1", targetId: "" }),
    true,
  );
});
await check("clientOnline distinguishes the two clients", () => {
  assert.equal(fb("clientOnline", { clientId: "cli-1" }), true);
  assert.equal(fb("clientOnline", { clientId: "cli-2" }), false);
});
await check("a rejected command throws rather than reporting success", async () => {
  await assert.rejects(() =>
    sendCommand(self, { type: "route", outputId: "nope", sourceId: "x" }),
  );
});

server.close();
console.log(
  failures === 0 ? "\nAll checks passed.\n" : `\n${failures} CHECK(S) FAILED.\n`,
);
process.exit(failures === 0 ? 0 : 1);
