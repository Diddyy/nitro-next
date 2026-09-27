# Widget views from Flash layouts

`packages/nitro-react/scripts/layouts/` holds the Flash window layouts already converted to React.
Read the generated layout for geometry and text styles, then write the view by hand under
`views/`, keeping the numbers and dropping the scaffolding (lorem-ipsum defaults, per-element
`visible*` props, one-file-per-region). Bitmaps come from the owning component's folder under
`scripts/flash-js-resources/` into `public/assets/<component>/<name>.png`, referenced with
`LayoutImage('<component>/<name>.png')` - which is the *asset name* of the bitmap in its `.nitro`
bundle, not a url. See Asset bundles.

The component is the client's own, kebab-cased, one folder per library beside the theme's own art:
`room-ui`, `catalog`, `toolbar`, `navigator` (`navigator` + `newnavigator`), `wired`
(`userdefinedroomevents`), `window-manager` (`windowmanager` + the `window/utils` layouts),
`friend-bar`, `friend-list`, `avatar-editor`, `quest-engine`, `help`, `games`, `groups`,
`inventory`, `messenger`, `moderation`, `notifications`, `discord`, `communication-demo` -
`ASSET_FOLDERS` in the generator maps a layout's folder onto it. A bitmap two components draw is
in `shared/` (one copy, never two), and a new layout bitmap goes in the folder of the component
that names it. The file name stays the Flash asset name.

An asset name is **not unique across the client**: every library embeds its own art, so there are
a dozen `heart_png`, four `camera_png`, three `slider_obj_png`. `flash-js-resources` answers that
by construction - an asset sits in the folder of the library that embeds it, so `zoom_in` under
`habbo-room-ui-com` is the room tools' own and nothing else. Take a bitmap from the folder of the
component whose layout names it, never from whichever folder happens to have the name.

That question used to be a guess, and it is worth knowing why the auditing exists: the art used to
arrive as one flat dump of the whole SWF, every file prefixed with the decompiler's running number,
which names no library and orders nothing. "Whichever file readdir yielded last" lost seventeen
times - the room tools toolbar drew the 43x44 camera-mode `zoom_in` beside its own 18x18
`zoom_out`. So `public/assets/layout-images.json` records the bundle file behind every bitmap
written (`<component>/<file>` -> `<library>/<file>`), and `layout_images.py` holds the shipped bytes
to it and checks that where a bundle carries the exact name, that is the file shipped. A name that
still settles neither way needs a `known.LAYOUT_IMAGES_AMBIGUOUS` reason: a wrong bitmap fails
nothing, it just draws wrong.

The conversions follow the component XML under `scripts/flash-js-resources/`: after a refresh of
that, regenerate them with `yarn workspace @nitrodevco/nitro-react generate-layout-views` and read
the diff - it is the list of what the client changed, and the views written from those layouts are
what has to follow.
`layouts.py` compares each registry entry's `xml` hash with the asset it came from, so a
conversion that is a revision behind is drift.

How the generator finds a bitmap, in order (`resolveImage`):

1. **The exact name.** A bundle file *is* the published asset name, so `newnavigator_create_room`
   is `newnavigator_create_room.png` and that is the client's own answer. Where several components
   carry it, the one owning the layout wins (`RESOURCE_FOR_FOLDER`, the inverse of `ASSET_FOLDERS`).
2. **The libraries' alias table**, only for a name no bundle carries. Its right-hand side is the
   *embedded* file (`roomtools_zoom_in` -> `zoom_in_png$<hash>`), and without the hash - which the
   bundles drop - an embedded name is shared by several libraries' art. Trying it first shipped a
   23x23 icon for the 187x59 `newnavigator_create_room`; that is why it comes second.
3. Token stripping (`avatar_editor_tabs_ae_tabs_head` -> `ae_tabs_head`), then a manifest region.

The alias table and the class that builds each layout (which files its art under a component) are
read from the decompiled client, whose root the generator derives from `production.version` the
way `known.py` does. A bitmap no layout names statically but a view draws goes in `RUNTIME_IMAGES`
- the floor plan editor's tool art is there because its own layout is not in the bundles.

**The bundles and the decompiled client are not the same build.** `binary_data.py` holds one
against the other, and the assets that differ - 22 catalog page layouts, and the element
description, icon set and illumina border the theme is cut from - are listed in
`known.REFERENCE_BUILD_SKEW` with which side the port follows. Regenerating from the bundles is
fine for everything else; for those, the drift checks and the theme follow `scripts-deob`.

The generator owns its output folder and rewrites it whole: an edit made to a converted layout is
gone on the next run, so a fix belongs in the generator or in the hand-written view. What it does
protect is the art under `public/assets/<component>/`, which holds hand-placed bitmaps beside the
ones it copies (a view names many of them at runtime, out of a table). It prunes only what
`public/assets/layout-images.json` says it wrote - by that file's `<component>/<file>` path - and
leaves a hand-placed file untouched even when an asset of the same name exists in the reference
material.
