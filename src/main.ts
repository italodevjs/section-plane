import "./style.css";
import { Viewer } from "./viewer";
import { MAX_BYTES, type Analysis, type Mesh } from "./geometry";
import { samples } from "./fixtures";

const $ = <T extends HTMLElement = HTMLElement>(selector: string): T => {
  const el = document.querySelector<T>(selector);
  if (!el) throw new Error(`Missing interface element: ${selector}`);
  return el;
};
$("#app").innerHTML = `
<header class="masthead"><a class="brand" href="./" aria-label="Section Plane home"><img src="./mark.svg" alt="" width="34" height="34"><span>Section Plane<small>MESH INSPECTION WORKBENCH</small></span></a><div class="privacy">Files stay on this device<span>No account. No uploads.</span></div><button class="quiet" id="help">How to inspect</button></header>
<main>
  <div class="document-bar"><div><span class="eyebrow">CURRENT DOCUMENT</span><h1 id="filename">Stepped block</h1><p id="filemeta">Synthetic reference mesh</p></div><div class="file-actions"><input id="file" type="file" accept=".stl,.obj" hidden><button id="open" class="primary">Open mesh <span>STL / OBJ</span></button><button id="export">Export report</button></div></div>
  <div id="notice" class="notice" role="status" aria-live="polite"></div>
  <div class="workbench">
    <section class="drawing" aria-label="Mesh view">
      <div class="view-toolbar"><div class="segmented" role="group" aria-label="Standard camera views"><button data-view="iso" class="selected" aria-pressed="true">Isometric</button><button data-view="front" aria-pressed="false">Front</button><button data-view="top" aria-pressed="false">Top</button><button data-view="right" aria-pressed="false">Right</button></div><label class="check"><input id="edges" type="checkbox" checked> Feature edges</label></div>
      <div id="viewport"><div class="viewport-corner top-left">ORTHOGRAPHIC<br><span id="viewport-label">STEPPED BLOCK</span></div><div class="axis-key"><span>X</span><span>Y</span><span>Z</span></div><div class="viewport-bottom"><span>Drag to orbit · Scroll to zoom · Right drag to pan</span><button id="fit" class="quiet">Fit view</button></div><div id="busy" hidden>Inspecting geometry…</div></div>
      <div class="section-controls"><div class="section-title"><label class="check"><input id="cut" type="checkbox" checked><strong>Section plane</strong></label><span id="section-value">Z = 0.00 mm</span></div><div class="slider-row"><select id="axis" aria-label="Section axis"><option value="2">Z axis</option><option value="1">Y axis</option><option value="0">X axis</option></select><input id="slice" type="range" min="0" max="1000" value="500" aria-label="Section position"><output id="slice-percent">50%</output></div><p id="section-note">Triangle intersections, shown in orange. Coplanar faces are omitted.</p></div>
    </section>
    <aside class="inspection" aria-label="Geometry inspection"><div class="inspector-title"><h2>Inspection</h2><span id="format">OBJ</span></div><label class="unit-label">Interpret model units as <select id="units"><option value="mm">Millimetres (mm)</option><option value="cm">Centimetres (cm)</option><option value="in">Inches (in)</option><option value="unit">Unspecified units</option></select></label><p class="annotation">STL and OBJ do not declare physical units. This label is your assumption; coordinates stay unchanged.</p><section class="property-group"><h3>EXTENTS</h3><dl id="extents"></dl></section><section class="property-group"><h3>SURFACE</h3><dl id="surface"></dl></section><section class="property-group"><h3>TOPOLOGY</h3><dl id="topology"></dl><div id="verdict"></div></section><section class="property-group measurement"><h3>POINT MEASUREMENT</h3><p id="measure-value">Pick two points on the surface.</p><button id="measure" aria-pressed="false">Measure distance</button><button id="clear" class="quiet">Clear</button><p class="annotation">Straight-line distance between picked surface points. Disable the section first for unobstructed picking.</p></section></aside>
  </div>
  <section class="reference-strip" aria-label="Synthetic reference meshes"><div><h2>Start with a known shape.</h2><p>Reference meshes are generated geometry, not scans.</p></div><div class="sample-buttons"><button data-sample="bracket" class="active">Stepped block <span>Closed prism</span></button><button data-sample="cube">Calibration cube <span>40 × 40 × 40</span></button><button data-sample="open">Open shell <span>Boundary diagnostic</span></button></div></section>
  <footer><span>Geometry, without the guesswork.</span><span>Local inspection · 16 MiB / 200k triangles · <a href="https://github.com/italodevjs/section-plane" target="_blank" rel="noreferrer">Source & limitations</a></span></footer>
</main>
<dialog id="guide"><div class="dialog-head"><h2>Inspect a mesh</h2><button id="close-help" aria-label="Close instructions">Close</button></div><ol><li>Open an STL or OBJ file, or choose a synthetic reference. Parsing and topology checks run in a local worker.</li><li>Set the unit assumption. Dimensions and measures use raw coordinates; this does not rescale the file.</li><li>Orbit the surface or choose a standard orthographic view. Move the section plane to inspect an interior slice.</li><li>Read boundary, non-manifold and winding diagnostics before using the volume estimate.</li><li>Turn off the section and enable measurement. Click two surface points. Export the actual computed report as JSON.</li></ol><h3>Know the limits</h3><p>Topology uses position quantization at the reported tolerance. A closed, consistently wound mesh can still self-intersect. Self-intersections, nesting and physical accuracy are not tested. Volume is a signed-surface estimate, not a manufacturing or clinical certification.</p><p>OBJ supports triangles and convex planar polygons. Materials, textures and supplied normals are ignored; external files are never fetched. Concave polygons must be triangulated before import.</p><p>Keyboard: all controls are focusable. Standard view buttons and the section range offer camera and section control without pointer gestures. Arbitrary surface point picking requires a pointer.</p></dialog>`;

let viewer: Viewer | null = null;
try {
  viewer = new Viewer($("#viewport"));
} catch {
  $("#notice").textContent =
    "WebGL is unavailable. Geometry inspection and report export still work; the 3D view requires a WebGL-capable browser.";
}
let current: {
  mesh: Mesh;
  report: Analysis;
  name: string;
  synthetic: boolean;
  bytes: number;
} | null = null;
let worker: Worker | null = null,
  request = 0,
  timer: ReturnType<typeof setTimeout> | null = null;
let measurement: number | null = null;
const unit = () => $("#units") as HTMLSelectElement;
const fmt = (n: number) =>
  new Intl.NumberFormat("en", { maximumFractionDigits: 3 }).format(n);
const unitName = () => (unit().value === "unit" ? "units" : unit().value);
const numberUnits = (n: number, power = 1) =>
  `${fmt(n)} ${unitName()}${power === 2 ? "²" : power === 3 ? "³" : ""}`;
function rows(selector: string, values: [string, string][]): void {
  $(selector).replaceChildren(
    ...values.flatMap(([label, value]) => {
      const dt = document.createElement("dt"),
        dd = document.createElement("dd");
      dt.textContent = label;
      dd.textContent = value;
      return [dt, dd];
    }),
  );
}
function updateReport(): void {
  if (!current) return;
  const a = current.report;
  rows("#extents", [
    ["X width", numberUnits(a.size[0])],
    ["Y depth", numberUnits(a.size[1])],
    ["Z height", numberUnits(a.size[2])],
  ]);
  rows("#surface", [
    ["Triangles", fmt(a.triangles)],
    ["Area", numberUnits(a.surfaceArea, 2)],
    [
      "Volume estimate",
      a.volume === null ? "Unavailable" : numberUnits(a.volume, 3),
    ],
  ]);
  rows("#topology", [
    ["Welded vertices", fmt(a.vertices)],
    ["Connected parts", fmt(a.components)],
    ["Boundary edges", fmt(a.boundaryEdges)],
    ["Non-manifold edges", fmt(a.nonManifoldEdges)],
    ["Winding conflicts", fmt(a.inconsistentEdges)],
    ["Degenerate faces", fmt(a.degenerateTriangles)],
  ]);
  const clean = a.volume !== null;
  $("#verdict").className = clean ? "verdict clean" : "verdict issue";
  $("#verdict").textContent = clean
    ? "Closed, consistently wound surface. Self-intersections are not tested."
    : "Surface needs review. Volume is withheld because topology checks did not pass.";
  updateMeasurement();
  updateCut();
}
function updateMeasurement(): void {
  $("#measure-value").textContent =
    measurement === null
      ? "Pick two points on the surface."
      : numberUnits(measurement);
}
if (viewer)
  viewer.onMeasure = (n) => {
    measurement = n;
    updateMeasurement();
  };
function updateCut(): void {
  if (!current) return;
  const enabled = $<HTMLInputElement>("#cut").checked,
    axis = Number($<HTMLSelectElement>("#axis").value) as 0 | 1 | 2,
    ratio = Number($<HTMLInputElement>("#slice").value) / 1000;
  const a = current.report,
    value = a.min[axis] + a.size[axis] * ratio;
  const count = viewer?.cut(enabled, axis, ratio) ?? 0;
  $("#section-value").textContent = enabled
    ? `${"XYZ"[axis]} = ${numberUnits(value)}`
    : "Section off";
  $("#slice-percent").textContent = `${Math.round(ratio * 100)}%`;
  $("#section-note").textContent = enabled
    ? `${fmt(count)} triangle intersection segments · Coplanar faces omitted`
    : "Full surface visible. Enable the plane to inspect a slice.";
  $<HTMLInputElement>("#slice").disabled = !enabled;
  $<HTMLSelectElement>("#axis").disabled = !enabled;
}
function inspect(
  name: string,
  data: ArrayBuffer,
  synthetic: boolean,
  selection?: number,
): void {
  const id = selection ?? ++request;
  if (id !== request) return;
  if (data.byteLength > MAX_BYTES) {
    $("#notice").textContent = "Choose a file no larger than 16 MiB.";
    return;
  }
  worker?.terminate();
  if (timer) clearTimeout(timer);
  const bytes = data.byteLength;
  $("#busy").hidden = false;
  $("#notice").textContent = "";
  $("#export").setAttribute("disabled", "");
  worker = new Worker(new URL("./worker.ts", import.meta.url), {
    type: "module",
  });
  const fail = (message: string) => {
    if (id !== request) return;
    $("#busy").hidden = true;
    $("#notice").textContent = message;
    $("#export").toggleAttribute("disabled", !current);
    worker?.terminate();
    if (timer) clearTimeout(timer);
  };
  worker.onerror = () =>
    fail("The inspection worker stopped unexpectedly. Try another mesh.");
  worker.onmessage = (
    event: MessageEvent<{
      id: number;
      ok: boolean;
      error?: string;
      mesh: Mesh;
      report: Analysis;
    }>,
  ) => {
    if (event.data.id !== request) return;
    if (!event.data.ok) {
      fail(event.data.error ?? "Could not read this mesh.");
      return;
    }
    if (timer) clearTimeout(timer);
    worker?.terminate();
    worker = null;
    current = {
      name,
      bytes,
      synthetic,
      mesh: event.data.mesh,
      report: event.data.report,
    };
    $("#busy").hidden = true;
    $("#filename").textContent = name;
    $("#viewport-label").textContent = name.toUpperCase();
    $("#filemeta").textContent =
      `${synthetic ? "Synthetic reference mesh" : "Local file"} · ${fmt(bytes / 1024)} KiB · ${fmt(current.report.triangles)} triangles`;
    $("#format").textContent = current.mesh.format;
    $("#export").removeAttribute("disabled");
    viewer?.load(current.mesh.positions, current.report);
    viewer?.edges($<HTMLInputElement>("#edges").checked);
    updateReport();
    document.querySelectorAll<HTMLButtonElement>("[data-view]").forEach((b) => {
      b.classList.toggle("selected", b.dataset.view === "iso");
      b.setAttribute("aria-pressed", String(b.dataset.view === "iso"));
    });
  };
  timer = setTimeout(
    () =>
      fail(
        "Inspection exceeded the 20-second budget. Reduce the mesh complexity and try again.",
      ),
    20_000,
  );
  worker.postMessage({ id, name, data }, [data]);
}
function sample(key: keyof typeof samples): void {
  const s = samples[key];
  inspect(s.filename, new TextEncoder().encode(s.text).buffer, true);
  document
    .querySelectorAll("[data-sample]")
    .forEach((b) =>
      b.classList.toggle("active", (b as HTMLElement).dataset.sample === key),
    );
}
$("#open").onclick = () => $<HTMLInputElement>("#file").click();
const openFile = async (file: File): Promise<void> => {
  const selection = ++request;
  worker?.terminate();
  if (timer) clearTimeout(timer);
  $("#busy").hidden = true;
  $("#export").toggleAttribute("disabled", !current);
  if (file.size > MAX_BYTES) {
    $("#notice").textContent = "Choose a file no larger than 16 MiB.";
    return;
  }
  try {
    const data = await file.arrayBuffer();
    if (selection !== request) return;
    inspect(file.name, data, false, selection);
    document
      .querySelectorAll("[data-sample]")
      .forEach((b) => b.classList.remove("active"));
  } catch {
    if (selection !== request) return;
    $("#notice").textContent =
      "The file could not be read. Check that it is accessible and try again.";
  }
};
$("#file").onchange = () => {
  const f = $<HTMLInputElement>("#file").files?.[0];
  if (f) void openFile(f);
  $<HTMLInputElement>("#file").value = "";
};
$("#viewport").ondragover = (e) => {
  e.preventDefault();
  $("#viewport").classList.add("dropping");
};
$("#viewport").ondragleave = () => $("#viewport").classList.remove("dropping");
$("#viewport").ondrop = (e) => {
  e.preventDefault();
  $("#viewport").classList.remove("dropping");
  const f = e.dataTransfer?.files[0];
  if (f) void openFile(f);
};
document
  .querySelectorAll<HTMLButtonElement>("[data-sample]")
  .forEach(
    (b) => (b.onclick = () => sample(b.dataset.sample as keyof typeof samples)),
  );
document.querySelectorAll<HTMLButtonElement>("[data-view]").forEach(
  (b) =>
    (b.onclick = () => {
      viewer?.view(b.dataset.view as "iso" | "front" | "top" | "right");
      document
        .querySelectorAll<HTMLButtonElement>("[data-view]")
        .forEach((x) => {
          x.classList.toggle("selected", x === b);
          x.setAttribute("aria-pressed", String(x === b));
        });
    }),
);
$("#fit").onclick = () => viewer?.view("iso");
$("#edges").onchange = () =>
  viewer?.edges($<HTMLInputElement>("#edges").checked);
$("#cut").onchange = () => {
  if ($<HTMLInputElement>("#cut").checked) {
    $("#measure").setAttribute("aria-pressed", "false");
    $("#measure").textContent = "Measure distance";
    viewer?.measure(false);
  }
  updateCut();
};
$("#axis").onchange = updateCut;
$("#slice").oninput = updateCut;
$("#units").onchange = updateReport;
$("#measure").onclick = () => {
  const enabled = $("#measure").getAttribute("aria-pressed") !== "true";
  $("#measure").setAttribute("aria-pressed", String(enabled));
  $("#measure").textContent = enabled
    ? "Measuring · pick two points"
    : "Measure distance";
  if (enabled) {
    $<HTMLInputElement>("#cut").checked = false;
    updateCut();
  }
  viewer?.measure(enabled);
};
$("#clear").onclick = () => viewer?.clearMeasurement();
$("#help").onclick = () => $<HTMLDialogElement>("#guide").showModal();
$("#close-help").onclick = () => $<HTMLDialogElement>("#guide").close();
$("#export").onclick = () => {
  if (!current) return;
  const report = {
    schema: "section-plane/1",
    source: {
      filename: current.name,
      bytes: current.bytes,
      format: current.mesh.format,
      synthetic: current.synthetic,
    },
    unitAssumption: unitName(),
    analysis: current.report,
    measurement:
      measurement === null
        ? null
        : { distance: measurement, units: unitName() },
    limitations: [
      "Quantized position welding; tolerance in analysis.weldTolerance.",
      "Self-intersections, nested shells and dimensional accuracy are not validated.",
      "Volume is the absolute signed-surface sum; not a certification.",
      "Coplanar faces are omitted from cross sections.",
    ],
  };
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(report, null, 2)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = current.name.replace(/\.[^.]*$/, "") + "-inspection.json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
window.addEventListener("beforeunload", () => {
  worker?.terminate();
  viewer?.destroy();
});
sample("bracket");
