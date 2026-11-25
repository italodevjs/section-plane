import { test } from "node:test";
import assert from "node:assert/strict";
import { analyze, parseMesh, section, MAX_BYTES } from "../src/geometry.ts";
import { samples } from "../src/fixtures.ts";
const buffer = (s: string) => new TextEncoder().encode(s).buffer;
const close = (actual: number, expected: number) =>
  assert.ok(Math.abs(actual - expected) < 1e-6, `${actual} != ${expected}`);
test("closed cube has known area, volume and edge connectivity", () => {
  const a = analyze(parseMesh("cube.obj", buffer(samples.cube.text)).positions);
  assert.equal(a.triangles, 12);
  assert.equal(a.vertices, 8);
  assert.equal(a.edges, 18);
  assert.equal(a.components, 1);
  assert.equal(a.boundaryEdges, 0);
  assert.equal(a.inconsistentEdges, 0);
  close(a.surfaceArea, 9600);
  close(a.volume!, 64000);
  assert.deepEqual(a.size, [40, 40, 40]);
});
test("open shell withholds volume and reports four boundary edges", () => {
  const a = analyze(parseMesh("open.obj", buffer(samples.open.text)).positions);
  assert.equal(a.boundaryEdges, 4);
  assert.equal(a.volume, null);
});
test("tetrahedron signed volume is translation invariant", () => {
  const obj =
    "v 0 0 0\nv 1 0 0\nv 0 1 0\nv 0 0 1\nf 1 3 2\nf 1 2 4\nf 1 4 3\nf 2 3 4";
  const mesh = parseMesh("t.obj", buffer(obj));
  close(analyze(mesh.positions).volume!, 1 / 6);
  const translated = mesh.positions.map((n) => n + 10000);
  close(analyze(translated).volume!, 1 / 6);
});
test("reversed face flags winding conflicts and invalid volume", () => {
  const broken = samples.cube.text.replace("f 1 3 2", "f 1 2 3");
  const a = analyze(parseMesh("cube.obj", buffer(broken)).positions);
  assert.equal(a.inconsistentEdges, 3);
  assert.equal(a.volume, null);
});
test("duplicate face produces nonmanifold edges", () => {
  const a = analyze(
    parseMesh("cube.obj", buffer(samples.cube.text + "\nf 1 3 2")).positions,
  );
  assert.equal(a.nonManifoldEdges, 3);
  assert.equal(a.volume, null);
});
test("section intersects cube at known plane and extent", () => {
  const p = parseMesh("cube.obj", buffer(samples.cube.text)).positions;
  const lines = section(p, 2, 0, 1e-6);
  assert.equal(lines.length / 6, 8);
  for (let i = 2; i < lines.length; i += 3) close(lines[i]!, 0);
  assert.equal(section(p, 2, 21, 1e-6).length, 0);
});
test("closed stepped prism computes analytic extrusion volume", () => {
  const a = analyze(
    parseMesh("block.obj", buffer(samples.bracket.text)).positions,
  );
  assert.equal(a.boundaryEdges, 0);
  assert.equal(a.inconsistentEdges, 0);
  close(a.volume!, 46800);
});
test("binary STL ignores unreliable solid header and validates exact byte length", () => {
  const b = new ArrayBuffer(134),
    v = new DataView(b);
  new Uint8Array(b).set(new TextEncoder().encode("solid header"));
  v.setUint32(80, 1, true);
  [0, 0, 0, 1, 0, 0, 0, 1, 0].forEach((n, i) =>
    v.setFloat32(96 + i * 4, n, true),
  );
  const m = parseMesh("a.stl", b);
  assert.equal(m.format, "Binary STL");
  close(analyze(m.positions).surfaceArea, 0.5);
  assert.throws(() => parseMesh("a.stl", b.slice(0, 133)));
});
test("strict ASCII STL parses triangles and rejects partial facets", () => {
  const s =
    "solid triangle\nfacet normal 0 0 1\nouter loop\nvertex 0 0 0\nvertex 1 0 0\nvertex 0 1 0\nendloop\nendfacet\nendsolid triangle";
  assert.equal(parseMesh("a.stl", buffer(s)).positions.length, 9);
  assert.throws(() =>
    parseMesh("a.stl", buffer(s.replace("vertex 0 1 0\n", ""))),
  );
});
test("OBJ supports negative indices and planar convex polygons", () => {
  const o = "v 0 0 0\nv 1 0 0\nv 1 1 0\nv 0 1 0\nf -4 -3 -2 -1";
  const m = parseMesh("quad.obj", buffer(o));
  assert.equal(m.positions.length, 18);
  close(analyze(m.positions).surfaceArea, 1);
});
test("OBJ rejects concave and nonplanar polygons instead of wrong triangulation", () => {
  const o = "v 0 0 0\nv 2 0 0\nv 1 1 0\nv 2 2 0\nv 0 2 0\nf 1 2 3 4 5";
  assert.throws(() => parseMesh("bad.obj", buffer(o)), /Concave/);
  assert.throws(
    () =>
      parseMesh(
        "bad.obj",
        buffer("v 0 0 0\nv 1 0 0\nv 1 1 1\nv 0 1 0\nf 1 2 3 4"),
      ),
    /Non-planar/,
  );
});
test("input rejects unsupported formats, missing vertices and nonfinite coordinates", () => {
  assert.throws(() => parseMesh("x.ply", buffer("x")), /not supported/);
  assert.throws(
    () => parseMesh("x.obj", buffer("v 0 0 0\nf 1 2 3")),
    /missing vertex/,
  );
  assert.throws(() => parseMesh("x.obj", buffer("v NaN 0 0")), /numeric/);
  assert.throws(
    () => parseMesh("x.obj", new ArrayBuffer(MAX_BYTES + 1)),
    /16 MiB/,
  );
  assert.throws(
    () => analyze(new Float32Array([Infinity, 0, 0, 1, 0, 0, 0, 1, 0])),
    /finite/,
  );
});
test("disconnected closed parts remain distinct", () => {
  const a = parseMesh("cube.obj", buffer(samples.cube.text)).positions;
  const joined = new Float32Array(a.length * 2);
  joined.set(a);
  joined.set(
    a.map((n, i) => (i % 3 === 0 ? n + 100 : n)),
    a.length,
  );
  const r = analyze(joined);
  assert.equal(r.components, 2);
  close(r.volume!, 128000);
});
