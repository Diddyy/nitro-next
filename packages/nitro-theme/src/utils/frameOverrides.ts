/**
 * Not Flash's: `frame.overrides`, the hotel variable a theme restyles windows with that Nitro draws
 * with a `Frame` of their own rather than from a template (the wired setup window) - so no template
 * patch reaches them. `{ "<frame id or window name>": { "variant": "<style>", "color": "#rrggbb" } }`,
 * the object or the object as JSON text; each plugin adds its entries (Turbo merges them per plugin, as
 * `templates.patches`). `variant` is the frame style (`FrameProps.variant`), `color` its tint: `#rrggbb`,
 * `0xRRGGBB` / `0xAARRGGBB` text or a number. What the window's code passes is the default; an entry
 * replaces only what it gives.
 */
import { parseCssHexColor, toCssHexColor } from './cssHexColor';

/** The variable's key. */
export const FRAME_OVERRIDES_KEY = 'frame.overrides';

export interface FrameOverride {
    variant?: string;
    /** `#rrggbb`. */
    color?: string;
}

/** `#rgb`, `#rrggbb`, `0xRRGGBB`, `0xAARRGGBB`: what `parseCssHexColor` reads, and nothing it would half-read (`blue`). */
const HEX_COLOR = /^(#|0x)?([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

const colorOf = (value: unknown): string | undefined => {
    const number = (typeof value === 'number') ? value : (typeof value === 'string' && HEX_COLOR.test(value.trim())) ? parseCssHexColor(value) : Number.NaN;

    return Number.isFinite(number) ? toCssHexColor(number) : undefined;
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

        const { variant, color } = entry as Record<string, unknown>;
        const override: FrameOverride = {
            ...(((typeof variant === 'string' && variant.length) || typeof variant === 'number') && { variant: String(variant) }),
            ...((colorOf(color) !== undefined) && { color: colorOf(color) }),
        };

        if (override.variant !== undefined || override.color !== undefined) overrides.set(key, override);
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
