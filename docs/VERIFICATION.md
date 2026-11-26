# Verification record

Date: 2026-11-26. These are observed checks against the static production build, not universal compatibility claims.

## Story

STL/OBJ bytes → Worker parser and topology analysis → orthographic WebGL view/section → surface picking → actual geometry report.

## Automated evidence

- 14 parser and analytic geometry tests passed locally.
- Production build passed. TypeScript projects include a strict type check.
- Isolated headless Chromium and Firefox exercised the complete flow described below without uncaught page errors.
- Isolated Windows WebKit exercised the same flow for Not After, Working Print and Section Plane. Early / Late's explicit unsupported-audio path was verified in that runtime.
- Desktop (1440 × 1000 viewport) and narrow-screen (390 × 844 viewport) screenshots were captured from actual rendered pages; document-level horizontal overflow was checked.

Known cube area/volume computed; open-shell volume withheld; real two-point surface picking produced a distance; JSON report downloaded. Regression coverage rejects a self-crossing polygon and checks stale selection/picking boundaries.

## Visual review

Real screenshots were inspected for typography, alignment, hierarchy, control density and mobile flow. The review led to external stylesheet loading for the certificate tool's security policy, a less crowded mobile photo control layout, a labelled logarithmic histogram scale and more readable mesh-inspection labels.

[Desktop capture](screenshots/desktop.png) · [Mobile capture](screenshots/mobile.png)

## Public deployment

The application is published at https://italodevjs.github.io/section-plane/ through GitHub Pages. The same Chromium flows were repeated successfully against that public origin on 2026-11-26, including real downloads and responsive captures. GitHub Actions builds and tests before publishing; no paid backend is involved.

## Remaining limits

Passing topology checks does not prove absence of self-intersection or physical accuracy. No clinical/manufacturing certification is claimed.

The screenshots and automated browser flows do not establish exhaustive accessibility, every device, perceptual audio synchronization or production reliability. Tests use synthetic public certificates/geometry, the credited NASA sample and original rhythm data, without private customer inputs.
