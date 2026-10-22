# Client modules

A Turbo plugin can ship JavaScript that runs inside the client: a **client module**. It is how a
hotel adds windows, toolbar icons and overlays of its own without a fork of the client. Turbo's
`docs/client-modules.md` owns the server side (how a plugin declares a module and where its files
are served); this page is the client's.

## The exchange

The client asks for the `client.modules` extension (version 1) with the others after the user
object (`registerUserInfoHandlers`). A Turbo server that accepts it sends
`TurboClientModulesMessage` (header **30009**): `int count`, then per module `string key` (the
plugin's), `string url`, `string version`, `string sha256` (hex, `''` = unchecked). It is the whole
set every time - right after the capability answer, and again whenever a plugin adds, removes or
reloads one. The set is taken only once the extension is accepted
(`handlers/client-modules/registerClientModuleHandlers.ts`); a server that declines it stops what ran.

## Loading (`commands/client-modules/clientModuleLoader.ts`)

- The URL is resolved against the page and must be `http(s)`. A module on another origin than the
  client's is refused unless its origin (`https://cdn.example.com`) or host (`cdn.example.com:8443`)
  is in the configuration value `client.modules.hosts` (a list, or one comma-separated text).
- With a SHA-256 the file is fetched, hashed with `crypto.subtle` and run from those very bytes
  through a `blob:` URL, so what runs is what was checked. A mismatch refuses it. Such a module must
  be **one file**: a relative `import` inside it has nothing to resolve against. Files beside it are
  found with `new URL('icon.png', api.baseUrl)`, not `import.meta.url`.
- The module's default export (or its named exports) has `activate(api)` and optionally
  `deactivate()`. A module whose version, URL or hash changes is deactivated and the new one
  activated; one the server no longer names is deactivated.
- A module that fails to load or throws in `activate` is left out and logged; the others run.
  Refusals are `NitroLogger.warn` lines under `ClientModules`.

## Shared libraries

A module must not bundle React: a second copy cannot draw into the client's tree. The client
hands its own over, as `api.libs` and as the global `NitroClientModuleHost` (set before the first
module is imported, so a bundled module can bind them at its top level):

| `libs.` | What |
| --- | --- |
| `react`, `reactJsxRuntime` | The client's React (`createElement`, hooks) and its JSX runtime |
| `theme` | `#base/theme`: `Frame`, `TemplateWindow`, `Box`, `ThemeText`, `Button`, ... |
| `zustand.useStore` | To read a store in a component |
| `stores.user` / `room` / `system` | The app-wide stores (read; write through the API) |

A module built with a bundler maps `react`, `react/jsx-runtime` and the theme to small shims that
re-export from `globalThis.NitroClientModuleHost`, and marks nothing else external. Pixi's elements
need no import: the client registers them, and a module names them as JSX intrinsics
(`pixiGraphics`, `pixiContainer`).

## The API (version 1, `commands/client-modules/ClientModuleApi.ts`)

| Part | What |
| --- | --- |
| `windows.register(id, Component)`, `open(id, params?)`, `close(id)`, `toggle(id)` | A window drawn in the window layer while open; the component gets `params` and `close` and draws its own `Frame` or `TemplateWindow` |
| `toolbar.add({ id, icon, tooltip?, onClick })` | An icon after the bottom bar's divider while it is expanded; the bar and the chat area make room for it |
| `meMenu.add({ id, caption, onClick })` | A me menu entry: a clone of `profile` with its own caption, before the spacer |
| `links.handle(prefix, fn)`, `links.open(link)` | In-client links `<prefix>/...` the client has no route of its own for |
| `packets.registerParser(header, parse, listener)`, `registerComposer(header)`, `send(header, ...values)` | Extension packets at 20000-32767 outside Turbo's 30000-30099, never over a header the client already has; values are ints, strings and booleans |
| `config.get(key)`, `texts.get(key, fallback?, replacements?)` | The hotel's configuration and texts |
| `sounds.play(id)` | A sample of the client's sound manager |
| `room.avatarOverlay(render)` | `render({ roomIndex, userId, name, isOwnUser })` is drawn above each user's head every frame, under the windows |
| `notifications.registerLayout(name, { template, height })`, `notifications.add(name, text, { image?, link? })` | A bubble in the client's notification stack drawn from a template of the bundles |

Every `register`/`add`/`handle` returns a function that takes that one thing out; whatever a module
added is taken out by the client when it stops, so `deactivate` only undoes what the module did
outside the API. Everything a module draws sits in an error boundary of its own.

## Example

`docs/examples/client-modules/hello/` is a module with no build step: a toolbar icon and a me
menu entry that open a window, the `hello/open` link, and a bar over the user's own avatar. Turbo's
example plugin serves the same files.
