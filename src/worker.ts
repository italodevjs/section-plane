import { analyze, parseMesh } from "./geometry";
self.onmessage = (
  event: MessageEvent<{ id: number; name: string; data: ArrayBuffer }>,
) => {
  const { id, name, data } = event.data;
  try {
    const mesh = parseMesh(name, data);
    const report = analyze(mesh.positions);
    self.postMessage(
      { id, ok: true, mesh, report },
      { transfer: [mesh.positions.buffer] },
    );
  } catch (error) {
    self.postMessage({
      id,
      ok: false,
      error: error instanceof Error ? error.message : "Mesh inspection failed.",
    });
  }
};
