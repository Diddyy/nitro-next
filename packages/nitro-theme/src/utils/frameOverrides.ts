/**
 * Not Flash's: `frame.overrides`, the hotel variable a theme restyles windows with that Nitro draws
 * with a `Frame` of their own rather than from a template (the wired setup window) - so no template
 * patch reaches them. `{ "<frame id or window name>": { "variant": "<style>", "color": "#rrggbb" } }`,
 * the object or the object as JSON text; each plugin adds its entries (Turbo merges them per plugin, as
 * `templates.patches`). `variant` is the frame style (`FrameProps.variant`), `color` its tint: `#rrggbb`,
 * `0xRRGGBB` / `0xAARRGGBB` text or a number. `position` (`{ "x": 84, "y": 153 }`, from the desktop's
 * top left) is where the window first opens, for any window with a frame, a template's root frame too:
 * where the player left it still wins, as it does over the code's own first position. What the
 * window's code passes is the default; an entry replaces only what it gives.
 */
import { parseCssHexColor, toCssHexColor } from './cssHexColor';

/** The variable's key. */
export const FRAME_OVERRIDES_KEY = 'frame.overrides';

/**
 * Not Flash's: the frame style that draws no frame. A frameless window has no skin, shadow, header or
 * scaler and does not crop what it holds; it is still a window - raised on a press, dragged by any
 * press its content does not take (and by a `useDragTrigger` element in it), kept where it was left.
 * A theme makes a core window frameless with `frame.overrides` (`{ "variant": "none" }`) or a
 * template patch (`set: { style: 'none' }` on the window).
 */
export const FRAMELESS_VARIANT = 'none';

/** Whether a frame style is `FRAMELESS_VARIANT`. */
export const isFramelessVariant = (variant: unknown) => variant === FRAMELESS_VARIANT;

export interface FrameOverride {
    variant?: string;
    /** `#rrggbb`. */
    color?: string;
    /** Where the window first opens, in whole pixels; over the code's `defaultPosition` and `centered`. */
    position?: { x: number; y: number };
}

/** `#rgb`, `#rrggbb`, `0xRRGGBB`, `0xAARRGGBB`: what `parseCssHexColor` reads, and nothing it would half-read (`blue`). */
const HEX_COLOR = /^(#|0x)?([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

const colorOf = (value: unknown): string | undefined => {
    const number = (typeof value === 'number') ? value : (typeof value === 'string' && HEX_COLOR.test(value.trim())) ? parseCssHexColor(value) : Number.NaN;

    return Number.isFinite(number) ? toCssHexColor(number) : undefined;
};

const positionOf = (value: unknown): { x: number; y: number } | undefined => {
    if (!value || typeof value !== 'object') return undefined;

    const { x, y } = value as Record<string, unknown>;

    return (typeof x === 'number' && typeof y === 'number' && Number.isFinite(x) && Number.isFinite(y)) ? { x: Math.trunc(x), y: Math.trunc(y) } : undefined;
};

const read = (value: unknown): ReadonlyMap<string, FrameOverride> => {
    const overrides = new Map<string, FrameOverride>();
    let parsed = value;

    if (typeof parsed === 'string') {
        try {
            parsed = JSON.parse(parsed) as unknown;
        } catch {
            return overrides;
        }
    }

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return overrides;

    for (const [ key, entry ] of Object.entries(parsed as Record<string, unknown>)) {
        if (!entry || typeof entry !== 'object') continue;

        const { variant, color, position } = entry as Record<string, unknown>;
        const override: FrameOverride = {
            ...(((typeof variant === 'string' && variant.length) || typeof variant === 'number') && { variant: String(variant) }),
            ...((colorOf(color) !== undefined) && { color: colorOf(color) }),
            ...((positionOf(position) !== undefined) && { position: positionOf(position) }),
        };

        if (override.variant !== undefined || override.color !== undefined || override.position !== undefined) overrides.set(key, override);
    }

    return overrides;
};

/** The last value read and what it says: the variable is the same value render after render. */
let last: { value: unknown; overrides: ReadonlyMap<string, FrameOverride> } | undefined;

/** `frame.overrides` as a map by key; an empty one for no value or one that is not an object. */
export const parseFrameOverrides = (value: unknown): ReadonlyMap<string, FrameOverride> => {
    const cached = last;

    if (cached && cached.value === value) return cached.overrides;

    const overrides = read(value);

    last = { value, overrides };

    return overrides;
};

/** The override for a frame, by its id first, then its window's name. */
export const frameOverrideOf = (value: unknown, id: string | undefined, name?: string): FrameOverride | undefined => {
    if (value === undefined || value === null || value === '') return undefined;

    const overrides = parseFrameOverrides(value);

    return ((id !== undefined) ? overrides.get(id) : undefined) ?? ((name !== undefined) ? overrides.get(name) : undefined);
};
