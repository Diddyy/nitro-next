# Development setup

Use the repository-pinned Yarn release through Corepack. From the repository root:

```sh
corepack yarn install
corepack yarn workspace @nitrodevco/nitro-react dev
```

Open the URL printed by Vite. Use a dedicated test account and Turbo's configured WebSocket
endpoint with a Turbo-issued SSO ticket. Each developer supplies their own endpoint, credentials
and reference locations; do not commit tickets, personal paths, or captured account data.
For missing server behavior, work in the Turbo checkout used by your development environment.
AS3 packet contracts and executable checks determine correctness.
See [Nitro and Turbo development](turbo-development.md) for server startup, connection settings,
packet ownership and verification across both repositories.

## External prerequisites

| Resource | Purpose |
| --- | --- |
| AS3 decompile for `production.version` | Behavioral source of truth: methods, layouts, constants and packet fields |
| Official JavaScript client for the corresponding release | Implementation guidance; locate classes by surviving layout/config/asset strings |
| Extracted component resources | Layout/skin XML, fonts and images grouped by their owning library |
| Hotel external variables and localization data | Feature gating, text keys and configuration values |
| Packet generator output | Candidate parser/composer bodies; validate against AS3 |
| Asset manager checkout and configured workspace | Import and manage hotel assets, gamedata, localization and versions; see [asset manager workflow](asset-manager.md) |
| Turbo checkout and running server | Verify packet exchanges and implement server behavior |

These resources are supplied separately. Paths in the topic guides are repository-relative unless
specified otherwise; `src/`, `public/` and `scripts/` generally refer to `packages/nitro-react/`.
Read the tool's supported arguments or configuration before assigning reference paths. Do not
assume every generator supports the same environment variables.

## Tool availability

The asset manager is useful shared tooling even when it is absent from a developer's checkout.
Keep its workflow and integration contracts documented; local availability does not determine
whether a tool belongs in the project. Use its own README for setup and version-specific commands.

Find shared tools and their usage guides in the [tools directory](../tools/).
The topic guides also explain asset generation, packet synchronization and drift auditing; some
of those scripts or external inputs may be absent from a checkout. Check that the named script
exists before running it. Obtain missing tooling/inputs, or report that verification was not run.
A package script alone does not guarantee its underlying generator is included.

`tools/local/` is optional and not covered by `.gitignore`; keep it uncommitted. Brief generators and Jev helpers there must not become a
requirement for another developer. Trace AS3 and packet contracts directly when those helpers are
unavailable. Browser/GPU diagnostics and their runtime instrumentation must be present together;
work parked on a WIP branch is not part of a clean checkout.

Keep generated captures, reports and task notes under ignored `tmp/`. Use test fixtures without
personal information when adding shared regression tests. Follow the code gates in
[AGENTS.md](../AGENTS.md); for UI changes, also verify the running client against Turbo.

## Porting and verification notes

For a feature port, identify the reachable AS3 entry point and corresponding official JavaScript
implementation. Record the relevant methods, layouts, configuration and packet contracts, then use
the nearest existing component/store/handler as a starting point. Optional brief generators and Jev
can help locate gaps; AS3 and executable evidence decide behavior. Jev is not a pixel-accuracy check.

For UI work, verify visible behavior, interaction, packet handling and state reset against Turbo.
The dev server is `yarn dev` on port 3000; packets can also be replayed against the client without
a server by delivering them through the socket layer. For a new or substantially changed window,
follow [the layout reference workflow](../tools/layout-reference.md) before writing the view.
When a bubble or widget never appears, check `RoomRenderedEvent` dispatch and packet registration.
After moving modules, restart Vite if stale import URLs prevent loading. Describe missing downstream
behavior explicitly rather than claiming feature parity - say what depends on a subsystem that does
not exist yet (trading, profile, group info, messenger conversations, report/help).

Files use LF. When writing scripts on Windows, select LF explicitly and avoid shell quoting that
interprets code unexpectedly; a script file is preferable for complex content. Use Corepack if the
global Yarn version differs from the repository's pinned version.
