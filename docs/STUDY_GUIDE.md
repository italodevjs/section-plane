# Study and technical defense

Use this guide to understand and change the implementation. Do not describe AI-assisted code as exclusively written unaided.

## Read in this order

1. Run the test suite and open the cube and open shell.
2. Trace `parseMesh` through the binary-size discriminator and OBJ index resolution.
3. Walk `analyze` on one triangle by hand: vertices, edge keys, area and signed volume.
4. Read the worker request/response boundary and explain transferable ownership.
5. Follow section slider input into triangle-plane intersection and line rendering.
6. Trace the JSON export and explain which values are measured and which are assumptions.

## Questions to defend

- Why can a binary STL start with `solid`, and why is its file length a better discriminator?
- Why does OBJ allow negative indices? What does `-1` mean at a face declaration?
- Why is a fan triangulation invalid for some polygons?
- What is the difference between a triangle soup and an indexed manifold mesh?
- How do edge incidence and edge direction expose different defects?
- Why do we use a hash map for welding and union-find for connected parts?
- Why can a closed mesh still produce a misleading volume?
- How does translating coordinates affect the volume sum and floating-point cancellation?
- Why should an unknown unit be shown as an assumption instead of guessed?
- Why does a worker protect responsiveness without making arbitrary input safe by itself?
- What becomes unavailable when WebGL fails, and what still works?
- Which interactions currently require a pointer? How would you provide numerical point selection?

## Exercises

1. Add a 10-unit tetrahedron fixture and independently calculate its volume. Write a test from the analytic value, not from the implementation output.
2. Reverse one face of the cube. Predict the number of conflicting edges before running analysis.
3. Add two separated cubes with opposite shell orientation. Explain why the signed-volume sum may cancel despite every component passing local edge checks.
4. Place two almost-coincident points on opposite quantization-bin boundaries. Write a test demonstrating the current welding limitation. Compare a neighboring-cell spatial hash with the current single-bin rule.
5. Add a new safe diagnostic: report Euler characteristic per component. Explain why a single global Euler number does not prove manifoldness.
6. Extend cross sections by stitching segments into loops. Handle vertex hits, duplicate coplanar edges and open contours explicitly before reporting an area.
7. Add keyboard-accessible numerical point selection and display the chosen coordinate pair in the exported report.
8. Benchmark a generated mesh at several triangle counts on your own device. Record hardware and methodology; do not generalize one measurement into a universal performance claim.

## Alternatives and next improvements

Robust geometric predicates and explicit half-edge topology would improve difficult degeneracy cases at the cost of additional code and memory. A WebAssembly geometry kernel could be appropriate for Boolean operations or repair; it is excessive for the current inspection scope. A backend could support collaboration but would introduce authentication, authorization, retention and upload risks that this local product avoids.

The next substantial engineering work should target a measured limitation: self-intersection detection using a bounding-volume hierarchy, contour stitching, exact component volume reporting, or more precise welding. Add a specification and adversarial fixtures before implementing it.
