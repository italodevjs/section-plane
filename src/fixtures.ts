import type { Vec3 } from "./geometry";
const cubeVertices: Vec3[] = [
  [-20, -20, -20],
  [20, -20, -20],
  [20, 20, -20],
  [-20, 20, -20],
  [-20, -20, 20],
  [20, -20, 20],
  [20, 20, 20],
  [-20, 20, 20],
];
const cubeFaces = [
  [0, 2, 1],
  [0, 3, 2],
  [4, 5, 6],
  [4, 6, 7],
  [0, 1, 5],
  [0, 5, 4],
  [3, 7, 6],
  [3, 6, 2],
  [0, 4, 7],
  [0, 7, 3],
  [1, 2, 6],
  [1, 6, 5],
];
function obj(vertices: Vec3[], faces: number[][]): string {
  return (
    vertices.map((v) => `v ${v.join(" ")}`).join("\n") +
    "\n" +
    faces.map((f) => `f ${f.map((i) => i + 1).join(" ")}`).join("\n")
  );
}
export const samples = {
  cube: {
    name: "Calibration cube",
    filename: "calibration-cube.obj",
    text: obj(cubeVertices, cubeFaces),
    note: "Synthetic 40 × 40 × 40 cube. Expected area 9,600 and volume 64,000 model units.",
  },
  open: {
    name: "Open shell",
    filename: "open-shell.obj",
    text: obj(cubeVertices, cubeFaces.slice(0, 10)),
    note: "Synthetic cube with one side removed. Four boundary edges; enclosed volume is unavailable.",
  },
  bracket: {
    name: "Stepped block",
    filename: "stepped-block.obj",
    text: steppedBlock(),
    note: "Synthetic closed stepped prism. The section exposes the change in profile.",
  },
};
function steppedBlock(): string {
  const outline: [
    [number, number],
    [number, number],
    [number, number],
    [number, number],
    [number, number],
    [number, number],
  ] = [
    [-30, -20],
    [30, -20],
    [30, 0],
    [0, 0],
    [0, 25],
    [-30, 25],
  ];
  const v: Vec3[] = [];
  for (const z of [-12, 12]) for (const [x, y] of outline) v.push([x, y, z]);
  const front = [
    [0, 1, 3],
    [1, 2, 3],
    [0, 3, 5],
    [3, 4, 5],
  ];
  const f = front
    .map((t) => [t[0]!, t[2]!, t[1]!])
    .concat(front.map((t) => t.map((i) => i + 6)));
  for (let i = 0; i < 6; i++) {
    const j = (i + 1) % 6;
    f.push([i, j, j + 6], [i, j + 6, i + 6]);
  }
  return obj(v, f);
}
