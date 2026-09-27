# Room renderer verification

Verify the behavior changed by a renderer PR against the AS3 revision in `production.version`.
For floor/wall projection and water shore masks, start with `RoomPlane`, `FloorPlane`, `WallPlane`,
`FurnitureWaterAreaVisualization` and `ShoreMaskCreatorUtility`. Use the official JavaScript client
as implementation guidance. A passing unit test does not establish whole-client pixel parity.

## Deterministic checks

From the repository root:

```sh
node --test tools/plane-rasterizer.test.mjs tools/plane-material.test.mjs tools/water-rasterizer.test.mjs
```

Check signed shear, geometry scales 64 and 32, plane color rounding, water border traversal,
corner cuts, mask resizing and texture ownership. After changing cached render targets, check
reuse, sampling settings, instance isolation and disposal. Keep tests with the behavior they prove.

## Browser and GPU checks

Use a dedicated Turbo account and a room fixture that contains the affected geometry and furniture.
Record the client commit, Turbo revision, renderer backend, output resolution and fixture setup.
Use the WebSocket endpoint configured for that Turbo environment and a Turbo-issued SSO ticket.

Browser/GPU runners under `tools/rendering/` and native fixtures under `tools/references/rendering/`
are optional pending tooling; confirm they exist on the branch before following their README or
running them. They also require matching client diagnostic instrumentation. If unavailable, report
that limitation instead of treating an earlier WIP run as proof for the current change.

Where available, `measure-plane-rendering.mjs` and `measure-plane-webgpu.mjs` compare rendering
primitives, while `check-room-rendering.mjs` exercises room re-entry and scale transitions. Check
each runner's prerequisites before use. Keep generated reports under ignored `tmp/` and attach
relevant sanitized results to the PR. Reopen diagnostic pages after changes to imported modules.

## Live scene checklist

- Exercise geometry 64/32/64 and display zoom changes; verify nonempty avatar and plane textures,
  correctly sized masks, sorting, clipping and pointer interaction after returning to normal zoom.
- Include stairs, raised floors and cutouts where the change affects height or coverage.
- For water, test placement, movement, rotation and pickup through Turbo. Check reciprocal neighbour
  updates, different furniture definitions, different heights and room re-entry. Client state
  overrides test rendering only, not server-generated adjacency or persistence.
- Compare matched regions at the same room geometry, output resolution and configuration. Record
  any deliberate visual difference from AS3 separately from parity results.
- If an extra render pass is introduced, measure performance separately; visual correctness does
  not establish better frame time or lower GPU memory use.

## Evidence and limits

Native AIR captures must identify their source hash, runtime/platform, stage quality and descriptor
settings. Keep reviewed expected-output fixtures separate from generated measurements. Do not
regenerate a baseline merely to make a failing check pass. Reproduction against a retained fixture
and recapturing that fixture are different checks.

Report the exact checks run, mismatch counts/tolerances, unavailable backends and untested cases.
Do not carry historical room IDs, local account details or results from a mixed WIP into a new PR
as current evidence. Bitmap export/photo behavior, other material families and large-room performance
need their own checks when affected. Rerun relevant checks on the extracted PR candidate.
