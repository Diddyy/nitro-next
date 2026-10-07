# Text

All UI text goes through `ThemeText` (and `TextInput`) with a `textStyle` key, and
`theme/font/flash-text` draws it exactly as the Flash client did.

**A style is named the way the client names it** - `u_regular`, `il_button`, `id_heading_1`. That
one spelling is the key of `HABBO_TEXT_STYLES`, the `textStyle` prop a view passes, and the value a
layout's `text_style` var carries. `TEXT_STYLES` in `theme/utils/textStyles.ts` is derived from
`HABBO_TEXT_STYLES` rather than listed beside it (it only adds the browser-text face each style
falls back to), so a style added to the generated table is a theme style the moment it lands. There
is no second `text-style-*` spelling any more.

**A text's format is its style plus the `TextField` vars its layout declares over it**, the way
`TextController.setTextFormatting` layers them. Three of those vars have Pixi equivalents and ride
in `textOptions` - `font_face` as `fontFamily`, `font_size` as `fontSize`, `text_color` as `fill`.
The rest have none, so they ride in `flashFormat`: `bold`, `italic`, `underline`, `spacing`,
`leading`, `antialias_type`, `grid_fit_type`, `thickness`, `sharpness`, `kerning`, `etching_color`
and `etching_position`. `ThemeText` folds both onto the style before rasterising, so an override is
still Flash-exact - it does **not** drop the text to the browser's canvas, which is what made a
`fontSize: 11` room-tools label the only blurry text on the bar. Only a face none of the captured
fonts covers still falls back.

Three things about those vars that are easy to get wrong, and that `generate-layout-views.ts`
encodes:

- **A text with no `text_style` var is not `regular`.** The window's `style` id picks a theme, and
  `ThemeManager`'s three real themes each default `text_style` differently: Volter (ids 0-2)
  `regular`, Ubuntu (3-7) and Misc (10000-10007) `u_regular`, Illumina Light and Dark (100-199,
  200-299) `il_regular`. The layout editor writes a var out only where it differs from that
  default, so reading a missing `text_style` as `regular` put Volter 9 under the 1,708 texts the
  Ubuntu and Illumina themes cover.
- **A falsy var is usually no var at all.** `setTextFormatting` re-applies the style over every
  property whose recorded value is falsy (`if(!_loc2_.sharpness)`), so the `sharpness="0"`,
  `leading="0"`, `spacing="0"`, `kerning="false"` and `text_color="0x0"` the layout editor writes
  on almost every text are the *style's* values, not zeroes. The setters that record a string
  escape that - `setBold` writes `"bold"` whether the var is true or false, and `setItalic` and
  `setUnderline` likewise - so `bold`, `italic` and `underline` count either way, and
  `setEtchingColor` is guarded by `== null`, so `0x0` counts too.
- **`grid_fit_type` is the one setter that records nothing**, so a `text_style` var listed after it
  puts an advanced style's grid fit back to `pixel` over it. Vars apply in document order.
  `advanced` + `subpixel` has no exact rendering - Sulake's own build throws on it - so those texts
  draw in canvas text, here and in the client this renderer came from.

`UbuntuThick` is a fourth embedded face (`UbuntuThick-Bold.ttf`) that 39 layout texts name and the
port has captured neither an AIR bundle nor a `.ttf` for. The generator emits the var and prints
the face at the end of a run rather than dropping it, so the gap stays visible.


- `flash-text/air32/` is a port of Sulake's bit-exact re-implementation of Adobe AIR's text
  rasterizer. Its arithmetic is deliberately literal: every `Math.fround`, every rounding helper
  and the order of operations reproduce 32-bit float behaviour. Do not "simplify" it; a change
  there is only safe if the rendered pixels stay identical: run
  `node scripts/flash-text-golden/run-check-ts.mjs` from `packages/nitro-react`, which hashes 7,832
  renders against the original renderer's output (`scripts/` is git-ignored, so the harness and
  the original in `scripts/flash-text-renderer` are local only). That original is the rasterizer
  `flash-js/runtime/` carries, extracted - so when a text question outgrows the port, read it
  there in its own context.
- `habboTextStyles.ts` is generated from the client's `styles.css` by
  `scripts/generate-habbo-text-styles.ts`. Regenerate it, never edit it; it is the whole list of
  theme styles, so a style it gains is one a view can name that day and one it loses is a
  `textStyle` that stops typechecking - never a hand-written font beside it.
- Fonts are captured bundles in `public/assets/fonts/*.air51.json`, shipped in `fonts.nitro` and
  registered once at boot by `preloadFlashFonts()`. They cover printable ASCII; typographic quotes,
  dashes, the acute accent used as an apostrophe and the no-break space are drawn as their ASCII
  look-alikes (`GLYPH_STAND_INS` in `FlashTextRenderer.ts`, one character for one). A string with any
  other character - or a raw `fontFamily`/`fontSize` override - falls back to the browser's text
  in the same `.ttf` faces, so never assume a text is a Flash bitmap. Those faces are
  `font-faces.nitro`, added to `document.fonts` from the archive's own bytes by
  `registerBrowserFonts` - started by `preloadFlashFonts` at boot but never awaited, because they are only the fallback.
- A rendered text is a bitmap with Flash's 2px `TextField` gutter on every side; caret and
  selection geometry (`flashTextCaretRect`) is in that same space.
- The `il_*` styles are etched: a translucent white line under every glyph, made for dark text
  on a light panel. Never put a light `fill` on one - the etch shows through as a smear. Flash
  has separate un-etched styles for that (`il_button_white`, `il_frame_title_white`,
  `il_regular_white`, ...); use those.
- For anything that is not a `ThemeText` - chat bubbles, a texture you own - use
  `renderFlashTextCanvas` (plain text or `parseFlashTextMarkup` runs) and fall back to
  `renderBrowserTextCanvas`, the way `chat/ChatBubbleText.ts` does.

The words come from two files, loaded in Flash's order by `useLocalizationLoader` and parsed the
way `CoreLocalizationManager.parseLocalizationData` does (`utils/localizationData.ts`: the key ends
at the first `=`, `\n` is a line break):

1. `gamedata.urls.defaultLocalizations` - the client's embedded `default_localizations` with the
   language's file over it. Most `wiredmenu.*` texts exist only here.
2. `gamedata.urls.externalTexts` - the hotel's texts, which override the first.

Both come from Nitro Studio (`packages/nitro-studio`): the hotel's texts from its Habbo
import, the default localizations from the client release (Changes, From Habbo, Client data);
a text that is wrong or cut off is fixed there, never patched in the client. Use Flash's
key and Flash's parameter names (`t('infostand.text.badges_rank', '', { rank: '#3' })` fills
`%rank%`). A key that neither file has and no Flash class or layout names is one the port made up:
it only ever shows as the bare key. `localization_keys.py` lists them.
