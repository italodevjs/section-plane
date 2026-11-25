# Section Plane

A browser-local workbench for inspecting STL and OBJ surface meshes. Open a file, inspect its topology, move an orthographic section plane, measure between surface points, and export the computed report. No account, API key or database is required.

The project explores a practical geometry question: **what can a triangle mesh tell us reliably, and where should a tool refuse to give an answer?** Volume is withheld when boundary, winding, non-manifold or degenerate-face checks fail. Passing these checks does not prove a surface is free of self-intersections.

## Run locally

Use Node.js 22 or newer.

```sh
npm ci
npm run dev
```

Open the local address printed by Vite. `npm run build` performs strict TypeScript checking and produces the static site in `dist/`. `npm run preview` serves that build. `npm test` runs the geometry suite without a browser or network.

## What works

- Binary and ASCII STL; OBJ triangles and convex planar polygons, including negative face indices.
- Worker-based parsing and analysis, with a 16 MiB input limit, 200,000-triangle limit and 20-second worker deadline.
- Bounds, triangle and welded vertex counts, connected components, surface area, boundary edges, non-manifold edges, winding conflicts and degenerate faces.
- Conditional signed-surface volume estimate, with explicit validity limits.
- Orthographic orbit, pan, zoom and standard camera views; feature-edge display.
- An axis-aligned section slider showing actual triangle/plane intersections.
- Two-point straight-line surface measurement and selectable unit interpretation.
- JSON export of the actual inspection, unit assumption, optional measurement and limitations.
- Three synthetic reference meshes: a closed cube, an open shell and a stepped prism.

Files are processed in the browser and never uploaded. The application does not fetch materials, textures or OBJ material libraries. It uses system fonts and has no analytics. After the static assets load, mesh inspection does not need an internet connection; offline installation and service-worker caching are not implemented.

## Use the reference shapes

The 40-unit cube has area **9,600** square units and volume **64,000** cubic units. The open shell has **four boundary edges** and no reported volume. The stepped prism has volume **46,800** cubic units. These are generated fixtures, not scans or customer data.

STL and OBJ do not define physical units. Selecting millimetres, centimetres or inches changes the label, not the coordinates. A 40-unit object stays 40 units wide. Use the unspecified-unit option when the export convention is unknown.

## Boundaries

This is a surface inspection tool, not a CAD repair system, slicer, medical device or manufacturing certification. It does not detect self-intersections, shell nesting, dimensional accuracy or material properties. Quantized positional welding can merge nearby vertices or leave near-coincident vertices in different bins. Volume is the absolute signed sum across all shells; nested or inconsistently oriented disconnected shells can make it physically misleading.

OBJ materials and normals are ignored. Concave or non-planar polygons must be triangulated before importing. PLY, DICOM, STEP and assemblies are unsupported. Cross sections contain raw segments, not stitched, ordered contours; coplanar triangles are omitted. Measurement picks points on the rendered triangles rather than snapping to exact CAD entities.

WebGL is required for the 3D view and point picking. Parsing, topology analysis and report export remain available if renderer initialization fails. Standard views and section controls work with the keyboard; arbitrary surface picking requires a pointer. See [architecture](docs/ARCHITECTURE.md), [study guide](docs/STUDY_GUIDE.md) and [security](SECURITY.md).

## Validation and authorship

The automated suite checks analytic cube/tetrahedron/prism results, translation invariance, disconnected components, open surfaces, duplicate and reversed faces, binary/ASCII parsing, OBJ indices and malformed input. Passing these tests is not evidence of clinical or manufacturing suitability.

This project was developed with substantial AI assistance for architecture, implementation, tests and documentation. It is a fresh implementation prompted by the practical problem of inspecting exported meshes; no private medical records, proprietary scans or code from the earlier private platform are included. Repository commits record the work performed; no usage, professional experience or exclusive human authorship is claimed.

Released under the [MIT license](LICENSE). Three.js is MIT-licensed; dependencies retain their own licenses.
