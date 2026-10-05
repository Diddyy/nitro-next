/**
 * What a window's code does to its template's named elements - its caption, whether it shows, what a
 * click on it does - handed to `TemplateView` as props by element name, the way Flash window code
 * reaches them with `findChildByName`.
 */
import type { ReactNode } from 'react';

import type { TemplateElement } from './templateData';
import type { TemplateRect } from './templateLayout';

const sameTemplateRect = (a: TemplateRect | undefined, b: TemplateRect | undefined) => a === b
    || (!!a && !!b && a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height && a.clip === b.clip
        && JSON.stringify(a.scroll) === JSON.stringify(b.scroll)
        && a.scrollContent?.width === b.scrollContent?.width && a.scrollContent?.height === b.scrollContent?.height);

export interface TemplateBinding {
    /** Over the layout's `visible`. */
    visible?: boolean;
    /** Over the layout's caption; a `${key}` in it is still read through the texts. */
    caption?: string;
    /** Over the layout's `tool_tip_caption`. */
    tooltip?: string;
    /**
     * `0xRRGGBB`: a text's colour (`ITextWindow.textColor`) over its `text_color`, anything else's tint
     * (`IWindow.color`) over its `color`.
     */
    color?: number;
    /**
     * A bitmap's asset, over the layout's `asset_uri` - what code sets with `IBitmapWrapperWindow.bitmap` or `assetUri`;
     * a `badge_image` widget's badge (`BadgeImageWidget.badgeId`), as its image's url.
     */
    asset?: string;
    /** A `badge_image` widget's `greyscale`. */
    greyscale?: boolean;
    /** Over the layout's `style` (`IWindow.style`) - an icon's icon-set style. */
    style?: string;
    /** `IWindow.blend`, over the layout's. */
    alpha?: number;
    disabled?: boolean;
    onPointerTap?: () => void;
    /** `WME_OVER` / `WME_OUT` on the element. */
    onPointerOver?: () => void;
    onPointerOut?: () => void;
    /**
     * A list's items that show, by name; every other item of the list is hidden. The AS3 pattern of
     * hiding every list item and showing some (`AvatarMenuView.updateButtons`).
     */
    show?: readonly string[];
    /**
     * The windows the code adds to it (`addChild`) - other templates built with `buildFromXML` and
     * placed by their own `x`/`y` - drawn over its own children.
     */
    children?: ReactNode;
}

/**
 * Bindings by element name, or by a `/`-separated path of names for a lookup scoped to a parent
 * (`panel.findChildByName("name")` is `'panel/name'`).
 */
export type TemplateBindings = Record<string, TemplateBinding>;

/**
 * Flash `WindowController.findChildByName`: the direct children first, then each child's subtree in
 * turn - the first match wins, so a name used twice finds the one this order reaches first.
 */
export const findTemplateChild = (children: readonly TemplateElement[], name: string): TemplateElement | undefined => {
    const direct = children.find(child => child.name === name);

    if (direct) return direct;

    for (const child of children) {
        const found = findTemplateChild(child.children, name);

        if (found) return found;
    }

    return undefined;
};

/** A binding key's element: each `/`-separated name looked up inside the last one's children. */
const findByKey = (elements: readonly TemplateElement[], key: string): TemplateElement | undefined => {
    let scope: readonly TemplateElement[] = elements;
    let found: TemplateElement | undefined;

    for (const name of key.split('/')) {
        found = findTemplateChild(scope, name);

        if (!found) return undefined;

        scope = found.children;
    }

    return found;
};

/**
 * Each key's element, and the keys that name none. Depends only on the template and the keys, not
 * on what is bound - so a caller memoises it on the key set and a changed caption walks no tree.
 */
export const resolveTemplateNames = (elements: readonly TemplateElement[], keys: readonly string[]) => {
    const targets = new Map<string, TemplateElement>();
    const missing: string[] = [];

    for (const key of keys) {
        const found = findByKey(elements, key);

        if (found) targets.set(key, found);
        else missing.push(key);
    }

    return { targets, missing };
};

/** Each binding's element, and the keys that name none. */
export const resolveTemplateBindings = (elements: readonly TemplateElement[], bindings: TemplateBindings | undefined) => {
    const { targets, missing } = resolveTemplateNames(elements, Object.keys(bindings ?? {}));

    return { byElement: bindElements(targets, bindings), missing };
};

/** The bindings by element, from keys already resolved; two keys naming one element are merged. */
export const bindElements = (targets: ReadonlyMap<string, TemplateElement>, bindings: TemplateBindings | undefined) => {
    const byElement = new Map<TemplateElement, TemplateBinding>();

    for (const [ key, binding ] of Object.entries(bindings ?? {})) {
        const element = targets.get(key);

        if (element) byElement.set(element, { ...byElement.get(element), ...binding });
    }

    return byElement;
};

/** The handlers a binding carries: each is handed to the element as one stable function that calls the latest. */
const HANDLERS = [ 'onPointerTap', 'onPointerOver', 'onPointerOut' ] as const;

type TemplateHandler = typeof HANDLERS[number];

/**
 * Whether two bindings draw the same: every value equal, `show` by its names, a handler only by
 * whether there is one - the store hands elements a stable handler that calls the latest.
 */
export const sameTemplateBinding = (a: TemplateBinding | undefined, b: TemplateBinding | undefined): boolean => {
    if (a === b) return true;
    if (!a || !b) return false;

    return a.visible === b.visible
        && a.caption === b.caption
        && a.tooltip === b.tooltip
        && a.asset === b.asset
        && a.greyscale === b.greyscale
        && a.style === b.style
        && a.alpha === b.alpha
        && a.color === b.color
        && a.disabled === b.disabled
        && a.children === b.children
        && HANDLERS.every(handler => !a[handler] === !b[handler])
        && (a.show === b.show || (!!a.show && !!b.show && a.show.length === b.show.length && a.show.every((name, index) => name === b.show?.[index])));
};

/** What one element of a drawn template reads: its binding, and the rect its window's rules gave it. */
export interface TemplateElementState {
    binding?: TemplateBinding;
    rect?: TemplateRect;
}

/**
 * What a `TemplateView` hands its elements - each one's binding and laid-out rect - each element
 * reading only its own (`useSyncExternalStore`), so a changed caption redraws that one text and not
 * the template.
 *
 * `update` takes a render's bindings and rects: an element whose state draws the same keeps the
 * object it had, and a handler is replaced by one stable function per element that calls the latest
 * - an inline arrow in the caller is new every render and would otherwise count as a change.
 * `commit` tells the elements whose state did change.
 */
export class TemplateBindingStore {
    private _current = new Map<TemplateElement, TemplateElementState>();
    private _latest = new Map<TemplateElement, TemplateBinding>();
    private _handlers = new Map<TemplateElement, Partial<Record<TemplateHandler, () => void>>>();
    private _listeners = new Set<() => void>();
    private _changed = false;

    public readonly subscribe = (listener: () => void) => {
        this._listeners.add(listener);

        return () => {
            this._listeners.delete(listener);
        };
    };

    public get(element: TemplateElement): TemplateElementState | undefined {
        return this._current.get(element);
    }

    public update(byElement: ReadonlyMap<TemplateElement, TemplateBinding>, rects: ReadonlyMap<TemplateElement, TemplateRect> = new Map()): void {
        const next = new Map<TemplateElement, TemplateElementState>();

        this._latest = new Map(byElement);

        for (const element of new Set([ ...byElement.keys(), ...rects.keys() ])) {
            const previous = this._current.get(element);
            const binding = byElement.get(element);
            const stableBinding = binding && HANDLERS.some(handler => binding[handler]) ? this.stabilise(element, binding) : binding;
            const rect = rects.get(element);
            const keptBinding = sameTemplateBinding(previous?.binding, stableBinding) ? previous?.binding : stableBinding;
            const keptRect = sameTemplateRect(previous?.rect, rect) ? previous?.rect : rect;

            next.set(element, previous && previous.binding === keptBinding && previous.rect === keptRect ? previous : { binding: keptBinding, rect: keptRect });
        }

        this._changed ||= next.size !== this._current.size || [ ...next ].some(([ element, state ]) => this._current.get(element) !== state);
        this._current = next;
    }

    /** Tells the elements to read again, when `update` changed anything since the last commit. */
    public commit(): void {
        if (!this._changed) return;

        this._changed = false;

        for (const listener of this._listeners) listener();
    }

    /** The binding with each of its handlers swapped for the element's stable one. */
    private stabilise(element: TemplateElement, binding: TemplateBinding): TemplateBinding {
        const stable = { ...binding };

        for (const handler of HANDLERS) {
            if (binding[handler]) stable[handler] = this.handlerFor(element, handler);
        }

        return stable;
    }

    private handlerFor(element: TemplateElement, kind: TemplateHandler): () => void {
        let handlers = this._handlers.get(element);

        if (!handlers) {
            handlers = {};
            this._handlers.set(element, handlers);
        }

        return handlers[kind] ??= () => this._latest.get(element)?.[kind]?.();
    }
}
