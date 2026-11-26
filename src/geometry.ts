export type Vec3 = [number, number, number];
export type Format = "Binary STL" | "ASCII STL" | "OBJ";
export interface Mesh {
  positions: Float32Array;
  format: Format;
}
export interface Analysis {
  triangles: number;
  vertices: number;
  edges: number;
  components: number;
  boundaryEdges: number;
  nonManifoldEdges: number;
  inconsistentEdges: number;
  degenerateTriangles: number;
  min: Vec3;
  max: Vec3;
  size: Vec3;
  surfaceArea: number;
  volume: number | null;
  weldTolerance: number;
}
export const MAX_BYTES = 16 * 1024 * 1024;
export const MAX_TRIANGLES = 200_000;
const MAX_COORDINATE = 1e9;
const finite = (n: number): number => {
  if (!Number.isFinite(n) || Math.abs(n) > MAX_COORDINATE)
    throw new Error(
      "Coordinates must be finite and within ±1,000,000,000 model units.",
    );
  return n;
};
const number = (s: string): number => {
  if (!/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(s))
    throw new Error("Invalid numeric value in mesh.");
  return finite(Number(s));
};
export function parseMesh(filename: string, data: ArrayBuffer): Mesh {
  if (data.byteLength === 0) throw new Error("The file is empty.");
  if (data.byteLength > MAX_BYTES)
    throw new Error("The file exceeds the 16 MiB inspection limit.");
  const ext = filename.split(".").pop()?.toLowerCase();
  if (ext === "obj")
    return {
      positions: parseObj(
        new TextDecoder("utf-8", { fatal: true }).decode(data),
      ),
      format: "OBJ",
    };
  if (ext !== "stl")
    throw new Error(
      "Choose a .stl or .obj mesh. Other formats are not supported.",
    );
  if (data.byteLength >= 84) {
    const view = new DataView(data);
    const count = view.getUint32(80, true);
    if (84 + 50 * count === data.byteLength) {
      if (count === 0 || count > MAX_TRIANGLES)
        throw new Error("STL must contain between 1 and 200,000 triangles.");
      const positions = new Float32Array(count * 9);
      for (let i = 0; i < count; i++)
        for (let j = 0; j < 9; j++)
          positions[i * 9 + j] = finite(
            view.getFloat32(84 + i * 50 + 12 + j * 4, true),
          );
      return { positions, format: "Binary STL" };
    }
  }
  return {
    positions: parseAsciiStl(
      new TextDecoder("utf-8", { fatal: true }).decode(data),
    ),
    format: "ASCII STL",
  };
}
function parseAsciiStl(text: string): Float32Array {
  const lines = text
    .trim()
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (
    !/^solid(?:\s|$)/i.test(lines[0] ?? "") ||
    !/^endsolid(?:\s|$)/i.test(lines.at(-1) ?? "")
  )
    throw new Error("Invalid STL header or truncated binary STL.");
  const values: number[] = [];
  let cursor = 1;
  const expect = (pattern: RegExp): RegExpMatchArray => {
    const match = (lines[cursor++] ?? "").match(pattern);
    if (!match)
      throw new Error(`Invalid ASCII STL structure near line ${cursor}.`);
    return match;
  };
  while (cursor < lines.length - 1) {
    const normal = expect(/^facet\s+normal\s+(\S+)\s+(\S+)\s+(\S+)$/i);
    normal.slice(1).forEach(number);
    expect(/^outer\s+loop$/i);
    for (let j = 0; j < 3; j++) {
      const vertex = expect(/^vertex\s+(\S+)\s+(\S+)\s+(\S+)$/i);
      values.push(...vertex.slice(1).map(number));
    }
    expect(/^endloop$/i);
    expect(/^endfacet$/i);
    if (values.length / 9 > MAX_TRIANGLES)
      throw new Error("The mesh exceeds 200,000 triangles.");
  }
  if (values.length === 0) throw new Error("No triangles found in STL.");
  return new Float32Array(values);
}
function parseObj(text: string): Float32Array {
  const vertices: Vec3[] = [];
  const positions: number[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.split("#")[0]!.trim();
    if (!line) continue;
    const [kind, ...parts] = line.split(/\s+/);
    if (kind === "v") {
      if (parts.length !== 3)
        throw new Error(
          "OBJ vertices require exactly x, y, z; homogeneous/color vertices are unsupported.",
        );
      vertices.push(parts.map(number) as Vec3);
      if (vertices.length > MAX_TRIANGLES * 3)
        throw new Error("Too many OBJ vertices.");
    } else if (kind === "f") {
      if (parts.length < 3 || parts.length > 128)
        throw new Error("OBJ faces require 3–128 vertices.");
      const points = parts.map((part) => {
        const token = part.split("/")[0]!;
        if (!/^-?\d+$/.test(token))
          throw new Error("Invalid OBJ vertex index.");
        const index = Number(token);
        const resolved = index < 0 ? vertices.length + index : index - 1;
        if (!Number.isSafeInteger(index) || index === 0 || !vertices[resolved])
          throw new Error("OBJ face references a missing vertex.");
        return vertices[resolved]!;
      });
      // Fan triangulation is defined only for convex planar polygons. Reject
      // ambiguous polygons instead of silently producing the wrong surface.
      if (points.length > 3) validateConvexFace(points);
      for (let j = 1; j < points.length - 1; j++)
        positions.push(...points[0]!, ...points[j]!, ...points[j + 1]!);
      if (positions.length / 9 > MAX_TRIANGLES)
        throw new Error("The mesh exceeds 200,000 triangles.");
    } else if (
      !["vn", "vt", "o", "g", "s", "usemtl", "mtllib"].includes(kind!)
    ) {
      throw new Error(
        `Unsupported OBJ directive: ${kind}. Export a triangle surface mesh.`,
      );
    }
  }
  if (positions.length === 0) throw new Error("No faces found in OBJ.");
  return new Float32Array(positions);
}
export const sub = (a: Vec3, b: Vec3): Vec3 => [
  a[0] - b[0],
  a[1] - b[1],
  a[2] - b[2],
];
export const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
export const dot = (a: Vec3, b: Vec3): number =>
  a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const magnitude = (v: Vec3): number => Math.hypot(...v);
function validateConvexFace(points: Vec3[]): void {
  const normal = cross(
    sub(points[1]!, points[0]!),
    sub(points[2]!, points[0]!),
  );
  const length = magnitude(normal);
  if (length === 0)
    throw new Error(
      "OBJ polygon has a collinear leading edge; triangulate it before import.",
    );
  const scale = Math.max(
    ...points.map((p) => magnitude(sub(p, points[0]!))),
    1e-12,
  );
  for (let j = 0; j < points.length; j++) {
    if (
      Math.abs(dot(sub(points[j]!, points[0]!), normal)) / length >
      scale * 1e-6
    )
      throw new Error("Non-planar OBJ polygon; triangulate it before import.");
    const a = points[j]!,
      b = points[(j + 1) % points.length]!;
    // A simple convex polygon lies in the same half-plane of every edge.
    // Checking only consecutive turns misses star polygons with crossings.
    for (const p of points) {
      if (
        dot(cross(sub(b, a), sub(p, a)), normal) <
        -length * scale * scale * 1e-9
      )
        throw new Error(
          "Concave or self-crossing OBJ polygon; triangulate it before import.",
        );
    }
  }
}
export function pointAt(p: Float32Array, index: number): Vec3 {
  return [p[index]!, p[index + 1]!, p[index + 2]!];
}
export function analyze(positions: Float32Array): Analysis {
  if (
    !positions.length ||
    positions.length % 9 !== 0 ||
    positions.length / 9 > MAX_TRIANGLES
  )
    throw new Error("Invalid triangle buffer.");
  const min: Vec3 = [Infinity, Infinity, Infinity],
    max: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < positions.length; i++) {
    const n = finite(positions[i]!);
    const axis = i % 3;
    min[axis] = Math.min(min[axis]!, n);
    max[axis] = Math.max(max[axis]!, n);
  }
  const size = sub(max, min);
  const scale = Math.max(...size);
  const weldTolerance = Math.max(scale * 1e-7, 1e-12);
  const ids = new Map<string, number>();
  const parent: number[] = [];
  const find = (n: number): number => {
    while (parent[n] !== n) {
      parent[n] = parent[parent[n]!]!;
      n = parent[n]!;
    }
    return n;
  };
  const vertexId = (p: Vec3): number => {
    const key = p
      .map((n, i) => Math.round((n - min[i]!) / weldTolerance))
      .join(",");
    let id = ids.get(key);
    if (id === undefined) {
      id = ids.size;
      ids.set(key, id);
      parent.push(id);
    }
    return id;
  };
  const edges = new Map<string, { count: number; direction: number }>();
  let surfaceArea = 0,
    signedVolume = 0,
    degenerateTriangles = 0;
  for (let i = 0; i < positions.length; i += 9) {
    const a = pointAt(positions, i),
      b = pointAt(positions, i + 3),
      c = pointAt(positions, i + 6);
    const area = magnitude(cross(sub(b, a), sub(c, a))) / 2;
    surfaceArea += area;
    if (area <= weldTolerance * weldTolerance) degenerateTriangles++;
    // Translate to the model bounds to reduce cancellation far from origin.
    signedVolume += dot(sub(a, min), cross(sub(b, min), sub(c, min))) / 6;
    const v = [vertexId(a), vertexId(b), vertexId(c)];
    for (let j = 0; j < 3; j++) {
      const x = v[j]!,
        y = v[(j + 1) % 3]!;
      parent[find(x)] = find(y);
      const key = x < y ? `${x}:${y}` : `${y}:${x}`;
      const edge = edges.get(key) ?? { count: 0, direction: 0 };
      edge.count++;
      edge.direction += x < y ? 1 : -1;
      edges.set(key, edge);
    }
  }
  let boundaryEdges = 0,
    nonManifoldEdges = 0,
    inconsistentEdges = 0;
  for (const e of edges.values()) {
    if (e.count === 1) boundaryEdges++;
    if (e.count > 2) nonManifoldEdges++;
    if (e.count === 2 && e.direction !== 0) inconsistentEdges++;
  }
  const volume =
    boundaryEdges ||
    nonManifoldEdges ||
    inconsistentEdges ||
    degenerateTriangles
      ? null
      : Math.abs(signedVolume);
  return {
    triangles: positions.length / 9,
    vertices: ids.size,
    edges: edges.size,
    components: new Set(parent.map((_, i) => find(i))).size,
    boundaryEdges,
    nonManifoldEdges,
    inconsistentEdges,
    degenerateTriangles,
    min,
    max,
    size,
    surfaceArea,
    volume,
    weldTolerance,
  };
}
/** Triangle/plane intersections. Coplanar triangles are deliberately omitted. */
export function section(
  positions: Float32Array,
  axis: 0 | 1 | 2,
  value: number,
  epsilon: number,
): Float32Array {
  const segments: number[] = [];
  for (let i = 0; i < positions.length; i += 9) {
    const p = [
      pointAt(positions, i),
      pointAt(positions, i + 3),
      pointAt(positions, i + 6),
    ];
    const d = p.map((v) => v[axis] - value);
    if (d.every((v) => Math.abs(v) <= epsilon)) continue;
    const hits: Vec3[] = [];
    for (let j = 0; j < 3; j++) {
      const k = (j + 1) % 3,
        a = p[j]!,
        b = p[k]!,
        da = d[j]!,
        db = d[k]!;
      if (Math.abs(da) <= epsilon) hits.push(a);
      if ((da < -epsilon && db > epsilon) || (da > epsilon && db < -epsilon)) {
        const t = da / (da - db);
        hits.push([
          a[0] + t * (b[0] - a[0]),
          a[1] + t * (b[1] - a[1]),
          a[2] + t * (b[2] - a[2]),
        ]);
      }
    }
    const unique = hits.filter(
      (p, j) => hits.findIndex((q) => magnitude(sub(p, q)) <= epsilon) === j,
    );
    if (unique.length === 2) segments.push(...unique[0]!, ...unique[1]!);
  }
  return new Float32Array(segments);
}
