/**
 * A Flash window template drawn with the theme: the `<layout>` a `WindowParser` builds, as data
 * (`TemplateElement`), each element the theme component its type is - a `frame` a `Frame`, a `button` a
 * `Button`, a `text` a `ThemeText`, a `static_bitmap` a `ThemeImage` - at the rect the template gives
 * it, its `style` the variant, its `color` the tint.
 *
 * A template's one root window is drawn at its origin: its own `x`/`y` are where the designer left it
 * on screen, and the window's code places it.
 *
 * It draws a template at its own size, which is where every element's rect is exact: the scale
 * params (`relative_*_scale_*`) only say where an element goes when its parent is resized, and a
 * template drawn as it stands is not. What a window's code does with its named elements
 * (`findChildByName`) comes in as `bindings` (`templateBindings`): a caption, whether it shows, a
 * click. Its texts (`${key}`) are read through `resolveText`, and its bitmaps (`asset_uri`) through
 * `imageUrl`.
 *
 * Takes a template converted by `layoutToTemplate` (variables typed, colours numbers) or Studio's
 * preview of one (everything the XML's text).
 *
 * Mirrors `scripts/generate-layout-views.ts`, which turns the same XML into TSX: the same element
 * types onto the same components, a text's style, colour, wrap and alignment read from its vars the
 * same way.
 */
import { Graphics as PixiGraphics } from 'pixi.js';
import { createContext, memo, ReactNode, useContext, useEffect, useLayoutEffect, useMemo, useState, useSyncExternalStore } from 'react';

import { Border } from '../Border';
import { Box, BoxLayout } from '../Box';
import { Bubble, PointerDirection } from '../Bubble';
import { Button } from '../Button';
import { ButtonGroupCenter } from '../ButtonGroupCenter';
import { ButtonGroupLeft } from '../ButtonGroupLeft';
import { ButtonGroupRight } from '../ButtonGroupRight';
import { ButtonThick } from '../ButtonThick';
import { CheckBox } from '../CheckBox';
import { CloseButton } from '../CloseButton';
import { ContainerButton } from '../ContainerButton';
import { Droplist } from '../Droplist';
import { Dropmenu } from '../Dropmenu';
import { Frame, FrameProps } from '../Frame';
import { Header } from '../Header';
import { useTextureFromUrl } from '../hooks/usePixiTexture';
import { Icon } from '../Icon';
import { IconButton } from '../IconButton';
import { RadioButton } from '../RadioButton';
import { Region, RegionProps } from '../Region';
import { Scaler } from '../Scaler';
import { ScrollArea } from '../ScrollArea';
import { Shape } from '../Shape';
import { TabButton } from '../TabButton';
import { TabContent } from '../TabContent';
import { TabContext } from '../TabContext';
import { TextInput } from '../TextInput';
import { ImageProps, ThemeImage } from '../ThemeImage';
import { ThemeText } from '../ThemeText';
import { FlashBitmapVars, WindowPlacedContext } from '../utils';
import { measureTemplateText, templateFontSize, templateTextFormat, templateTextStyle, templateWrapWidth } from './measureTemplateText';
import { resolveTemplateNames, TemplateBinding, TemplateBindings, TemplateBindingStore, TemplateExpander, TemplateWindows } from './templateBindings';
import { Template, TemplateElement, templateSkinKey, TemplateValue } from './templateData';
import { layoutTemplate, LayoutWindow, linkTemplateScrollbars, TEMPLATE_LISTS, TEMPLATE_SCROLLBAR_TAGS, TemplateArrange, TemplateRect } from './templateLayout';
import { TemplateScrollbar, TemplateScrollTarget } from './TemplateScroll';
import { TemplateScrollAxis, TemplateScrollStore } from './templateScrollStore';

export type { Template, TemplateElement } from './templateData';

export interface TemplateViewProps {
    template: Template;
    /** A caption's `${key}`: the text it names, or `undefined` to show the key. */
    resolveText?: (key: string) => string | undefined;
    /** Where a bitmap the template names (`asset_uri`) is. */
    imageUrl?: (asset: string) => string;
    /** What the window's code does with its named elements. */
    bindings?: TemplateBindings;
    /** Draws the `visible="false"` elements too, faded. */
    showHidden?: boolean;
    /** Gives each frame an id of its own, for the window layer. */
    idPrefix?: string;
    /**
     * The window's size, when its code or its scaler sets one: the root window is resized to it and
     * its children follow by their relative scale. Its layout size otherwise.
     */
    width?: number;
    height?: number;
    /**
     * What the window's code does once the layout is built: moves and sizes windows by what it measures,
     * through the window model (`LayoutWindow.setRectangle`, `textWidth`). Runs on every layout.
     */
    arrange?: (windows: TemplateWindows) => void;
    /**
     * How the window manager opens the root frame, when the template is a window of its own
     * (`buildFromXML(xml, 1)`): its id on the desktop, where it opens, and what its close button
     * does (`findChildByTag("close").procedure`). It is dragged like any window. Without it, a root
     * frame is drawn where the template is, fixed.
     */
    frame?: TemplateFrameOptions;
}

export type TemplateFrameOptions = Required<Pick<FrameProps, 'id'>> & Pick<FrameProps, 'defaultPosition' | 'centered' | 'onClose' | 'resizeDirection'>;

type FrameSize = { width: number; height: number };

export type { TemplateItem, TemplateWindows } from './templateBindings';

/**
 * A Flash colour as `#rrggbb` and its alpha: a converted `0xAARRGGBB` number, or the attribute's text
 * (`0xAARRGGBB`, `0xRRGGBB`).
 */
const flashColor = (value: TemplateValue | undefined): { hex: string; alpha: number } | undefined => {
    if (typeof value === 'number') return { hex: `#${(value & 0xffffff).toString(16).padStart(6, '0')}`, alpha: (value >>> 24) / 255 };
    if (typeof value !== 'string') return undefined;

    const digits = value.replace(/^0x/i, '').replace(/^#/, '');

    if (!digits || !/^[0-9a-f]{1,8}$/i.test(digits)) return undefined;

    const padded = digits.padStart(digits.length > 6 ? 8 : 6, '0');
    const alpha = padded.length === 8 ? Number.parseInt(padded.slice(0, 2), 16) / 255 : 1;

    return { hex: `#${padded.slice(-6).toLowerCase()}`, alpha };
};

/** A colour as the `0xAARRGGBB` number Flash's `uint(...)` makes of it. */
const flashUint = (value: TemplateValue | undefined): number | undefined => {
    if (typeof value === 'number') return value >>> 0;
    if (typeof value !== 'string' || !/^0x[0-9a-f]+$/i.test(value)) return undefined;

    return Number(BigInt.asUintN(32, BigInt(value)));
};

const flashBool = (value: TemplateValue | undefined) => value === true || value === 'true' || value === '1';

const flashString = (value: TemplateValue | undefined) => (typeof value === 'string' ? value : undefined);

/** A tint: a colour that changes anything (white, and none, leave a skin as it is). */
const tintOf = (element: TemplateElement, binding?: TemplateBinding) => {
    const color = flashColor(binding?.color ?? element.color);

    return color && color.hex !== '#ffffff' ? color.hex : undefined;
};

/** How a list places its items: along its axis, or in rows. */
type Flow = { direction: 'column' | 'row'; wrap: boolean };

/**
 * The flow of each list the layout does not arrange (grids, selectors), made once: a memoised item
 * compares it by identity. An arranged list's items are drawn at the rects the layout gives them.
 */
const FLOWS: Record<string, Flow> = Object.fromEntries(Object.entries(TEMPLATE_LISTS)
    .filter(([ , list ]) => !list.arranged)
    .map(([ tag, list ]) => [ tag, { direction: list.direction, wrap: !!list.wrap } ]));

const TEXT_TAGS = new Set([ 'text', 'label', 'formatted_text', 'html', 'link' ]);
const BITMAP_TAGS = new Set([ 'bitmap', 'static_bitmap' ]);

/** The flag a bitmap var turns from its default, as `FlashBitmapVars` takes it. */
const bitmapVars = (vars: Record<string, TemplateValue>): FlashBitmapVars => {
    const bitmap: Record<string, unknown> = {};
    const flag = (key: string, field: string, fallback: boolean) => {
        if (vars[key] !== undefined && flashBool(vars[key]) !== fallback) bitmap[field] = !fallback;
    };
    const number = (key: string, field: string, fallback: number) => {
        if (vars[key] !== undefined && Number.isFinite(Number(vars[key])) && Number(vars[key]) !== fallback) bitmap[field] = Number(vars[key]);
    };

    flag('stretched_x', 'stretchedX', true);
    flag('stretched_y', 'stretchedY', true);
    number('zoom_x', 'zoomX', 1);
    number('zoom_y', 'zoomY', 1);
    flag('wrap_x', 'wrapX', false);
    flag('wrap_y', 'wrapY', false);
    flag('flip_x', 'flipX', false);
    flag('flip_y', 'flipY', false);
    number('rotation', 'rotation', 0);
    flag('fit_size_to_contents', 'fitSizeToContents', false);

    const etching = flashUint(vars.etching_color);

    if (etching) bitmap.etchingColor = etching;
    if (flashString(vars.pivot_point)) bitmap.pivot = vars.pivot_point;

    return bitmap;
};

/** A widget's own vars, `<type>:`-prefixed in the layout (`badge_image:zoom_x`), without the prefix. */
const widgetVars = (vars: Record<string, TemplateValue>, type: string): Record<string, TemplateValue> => {
    const prefix = `${type}:`;

    return Object.fromEntries(Object.entries(vars).filter(([ key ]) => key.startsWith(prefix)).map(([ key, value ]) => [ key.slice(prefix.length), value ]));
};

/**
 * What every element of one `TemplateView` shares. Kept the same object while its inputs are, so a
 * memoised element only redraws when its own binding changes - or when this does (the texts changed
 * language), which redraws them all.
 */
interface Context {
    resolveText: (caption: string | undefined) => string;
    imageUrl?: (asset: string) => string;
    store: TemplateBindingStore;
    showHidden: boolean;
    idPrefix: string;
    frame?: TemplateFrameOptions;
    /** The scroll each standalone scrollbar shares with its target. */
    scroll: TemplateScrollStore;
    /** The window's frame resized by the user, which the template is laid out at. */
    onFrameResize: (size: FrameSize | null) => void;
}

/** Each standalone scrollbar's target (`linkTemplateScrollbars`), each target's axes, and the targets. */
interface ScrollLinks {
    scrollbars: ReadonlyMap<TemplateElement, TemplateElement>;
    scrollAxes: ReadonlyMap<TemplateElement, ReadonlySet<TemplateScrollAxis>>;
    scrollTargets: ReadonlySet<TemplateElement>;
}

/**
 * The scroll links of the elements drawn, handed to them apart from `Context`: they change with the
 * elements - when clones come or go - which `Context` does not.
 */
const ScrollLinksContext = createContext<ScrollLinks>({ scrollbars: new Map(), scrollAxes: new Map(), scrollTargets: new Set() });

/** A `#icon` / `#bg` tag: the part of its `dynamicStyle` host's look it takes. */
const dynamicRoleOf = (element: TemplateElement) => (element.tags?.includes('#icon') ? 'icon' : element.tags?.includes('#bg') ? 'bg' : undefined);

/** Its caption: the binding's over the layout's. */
const captionOf = (element: TemplateElement, context: Context, binding: TemplateBinding | undefined) => context.resolveText(binding?.caption ?? element.caption);

/** Its tooltip: the binding's over the layout's `tool_tip_caption`. */
const tooltipOf = (element: TemplateElement, context: Context, binding: TemplateBinding | undefined) => {
    const tooltip = binding?.tooltip ?? flashString(element.vars.tool_tip_caption);

    return tooltip ? context.resolveText(tooltip) : undefined;
};

/**
 * An element's box in its parent: at its rect - or, an item of a list, in the list's flow at its own
 * size, only its cross-axis coordinate kept (`ItemListController.updateScrollAreaRegion` sets the other).
 */
const rectOf = (rect: TemplateRect, flow?: Flow): BoxLayout => (flow
    ? {
            position: 'relative',
            width: rect.width,
            height: rect.height,
            flexShrink: 0,
            ...(!flow.wrap && flow.direction === 'column' && rect.x ? { marginLeft: rect.x } : {}),
            ...(!flow.wrap && flow.direction === 'row' && rect.y ? { marginTop: rect.y } : {}),
        }
    : { position: 'absolute', left: rect.x, top: rect.y, width: rect.width, height: rect.height });

/** The box an element's own face fills: the whole of its rect. */
const FILL: BoxLayout = { position: 'absolute', left: 0, top: 0, width: '100%', height: '100%' };

const textOf = (element: TemplateElement, rect: TemplateRect, context: Context, binding: TemplateBinding | undefined): ReactNode => {
    const label = element.tag === 'label';
    const style = templateTextStyle(element);
    const textColor = binding?.color ?? element.vars.text_color;
    const color = (label ? textColor !== undefined : !!flashColor(textColor)?.hex && textColor !== '0x0' && textColor !== 0) ? flashColor(textColor)?.hex : undefined;
    const wordWrap = !label && flashBool(element.vars.word_wrap);
    const autoSize = flashString(element.vars.auto_size) ?? (label ? 'left' : 'none');
    const align = autoSize === 'center' || autoSize === 'right' ? autoSize : undefined;
    const { fontFamily, flash } = templateTextFormat(element);
    const text = captionOf(element, context, binding);

    if (!text) return null;

    return (
        <ThemeText
            text={text}
            textStyle={style}
            textOptions={{ fill: color, fontFamily, fontSize: templateFontSize(element), wordWrap: wordWrap || undefined, wordWrapWidth: wordWrap ? templateWrapWidth(rect.width) : undefined, align }}
            flashFormat={flash.etchingColor ? { ...flash, etchingPosition: flash.etchingPosition ?? 'bottom' } : flash}
            markup={element.tag === 'formatted_text' || element.tag === 'html' ? true : undefined}
            clip={!label && autoSize === 'none' ? true : undefined}
            dynamicRole={dynamicRoleOf(element)}
            verticalAlign="top"
            layout={{ position: 'absolute', left: 0, top: 0, width: rect.width, height: rect.height }}
        />
    );
};

/** A drop menu's entries: the code's, or the layout's `item_array` (`DropMenuController` populates from it). */
const optionsOf = (element: TemplateElement, binding: TemplateBinding | undefined): readonly string[] | undefined => binding?.options
    ?? (Array.isArray(element.vars.item_array) ? element.vars.item_array.filter((item): item is string => typeof item === 'string') : undefined);

/** What an element draws of its own, filling its rect, under its children. */
const faceOf = (element: TemplateElement, rect: TemplateRect, context: Context, binding: TemplateBinding | undefined): ReactNode => {
    const variant = binding?.style ?? element.style;
    const tintColor = tintOf(element, binding);
    const caption = captionOf(element, context, binding);
    // A caption as plain text: the component draws it in its variant's text style (`wrapTextChildren`).
    const text = caption || undefined;

    if (TEXT_TAGS.has(element.tag)) return textOf(element, rect, context, binding);

    // `TextFieldController`: the field its code reads and writes - its caption the text, its colour
    // and italic the code's (a search field's grey italic placeholder).
    if (element.tag === 'input') {
        const color = flashColor(binding?.color ?? element.vars.text_color);
        const { fontFamily, flash } = templateTextFormat(element);

        return (
            <TextInput
                value={caption}
                onChange={text => binding?.onChange?.(text)}
                onEnter={() => binding?.onEnter?.()}
                onFocusChange={focused => (focused ? binding?.onFocus?.() : undefined)}
                textStyle={templateTextStyle(element)}
                fontFamily={fontFamily}
                fontSize={templateFontSize(element)}
                textColor={color?.hex ?? '#000000'}
                flashFormat={{ ...flash, ...(binding?.italic !== undefined && { italic: binding.italic }) }}
                flashPlacement
                backgroundColor={null}
                focusedBackgroundColor={null}
                layout={FILL}
            />
        );
    }

    if (BITMAP_TAGS.has(element.tag)) {
        const layoutAsset = flashString(element.vars.asset_uri) || flashString(element.vars.bitmap_asset_name);
        const asset = binding?.asset ?? layoutAsset;
        // A `${key}` in it is the client's to fill (`${image.library.questing.url}`); any other `$` is
        // an embedded asset's hashed name, which no bundle carries.
        const drawable = (name: string | undefined) => (name && !/\$(?!\{)/.test(name) && context.imageUrl ? context.imageUrl(name) : undefined);
        const src = drawable(asset);

        if (!src) return null;

        return (
            <TemplateBitmap
                src={src}
                previous={drawable(layoutAsset)}
                // A colour the code sets (`IWindow.color`); the layout's own is not drawn on a bitmap.
                tint={binding?.color !== undefined ? flashColor(binding.color)?.hex : undefined}
                bitmap={bitmapVars(element.vars)}
                dynamicRole={dynamicRoleOf(element)}
                layout={{ ...FILL, width: rect.width, height: rect.height }}
            />
        );
    }

    // `BadgeImageWidget`: the badge the code names, drawn with the widget's `badge_image:` bitmap vars.
    if (element.tag === 'widget' && element.vars.widget_type === 'badge_image') {
        if (!binding?.asset || !context.imageUrl) return null;

        return (
            <ThemeImage
                src={context.imageUrl(binding.asset)}
                greyscale={binding.greyscale}
                bitmap={bitmapVars(widgetVars(element.vars, 'badge_image'))}
                layout={{ ...FILL, width: rect.width, height: rect.height }}
            />
        );
    }

    switch (element.tag) {
        case 'border': return (
            <Border
                variant={variant}
                tintColor={tintColor}
                layout={FILL}
            />
        );
        case 'header': return (
            <Header
                variant={variant}
                caption={caption}
                layout={FILL}
            />
        );
        case 'button': return (
            <Button
                variant={variant}
                tintColor={tintColor}
                tooltip={tooltipOf(element, context, binding)}
                disabled={binding?.disabled}
                onPointerTap={binding?.onPointerTap}
                layout={FILL}
            >
                {text}
            </Button>
        );
        case 'button_thick': return (
            <ButtonThick
                variant={variant}
                tintColor={tintColor}
                tooltip={tooltipOf(element, context, binding)}
                disabled={binding?.disabled}
                onPointerTap={binding?.onPointerTap}
                layout={FILL}
            >
                {text}
            </ButtonThick>
        );
        case 'button_group_left': return (
            <ButtonGroupLeft
                variant={variant}
                layout={FILL}
            >
                {text}
            </ButtonGroupLeft>
        );
        case 'button_group_center': return (
            <ButtonGroupCenter
                variant={variant}
                layout={FILL}
            >
                {text}
            </ButtonGroupCenter>
        );
        case 'button_group_right': return (
            <ButtonGroupRight
                variant={variant}
                layout={FILL}
            >
                {text}
            </ButtonGroupRight>
        );
        case 'container_button': return (
            <ContainerButton
                variant={variant}
                tintColor={tintColor}
                tooltip={tooltipOf(element, context, binding)}
                disabled={binding?.disabled}
                onPointerTap={binding?.onPointerTap}
                layout={FILL}
            />
        );
        case 'iconbutton': return (
            <IconButton
                variant={variant}
                layout={FILL}
            />
        );
        case 'closebutton': return (
            <CloseButton
                variant={variant}
                layout={{ position: 'absolute', left: 0, top: 0 }}
            />
        );
        case 'checkbox': return (
            <CheckBox
                variant={variant}
                layout={{ position: 'absolute', left: 0, top: 0 }}
            >
                {text}
            </CheckBox>
        );
        case 'radiobutton': return (
            <RadioButton
                variant={variant}
                layout={{ position: 'absolute', left: 0, top: 0 }}
            >
                {text}
            </RadioButton>
        );
        case 'tab_button':
        case 'tab_container_button': return (
            <TabButton
                variant={variant}
                selected={binding?.selected}
                tooltip={tooltipOf(element, context, binding)}
                onPointerTap={binding?.onPointerTap}
                layout={FILL}
            >
                {text}
            </TabButton>
        );
        case 'tab_content': return (
            <TabContent
                variant={variant}
                layout={FILL}
            />
        );
        case 'droplist':
        case 'dropmenu': {
            const options = optionsOf(element, binding);
            const selection = binding?.selection ?? 0;

            return options
                ? (
                        // `DropMenuController`: the entries its code populates, the selected one its caption.
                        <Dropmenu
                            variant={variant}
                            tooltip={tooltipOf(element, context, binding)}
                            caption={context.resolveText(options[selection])}
                            options={options.map((option, index) => ({
                                key: index,
                                label: context.resolveText(option),
                                selected: index === selection,
                                onSelect: () => binding?.onSelect?.(index),
                            }))}
                            layout={FILL}
                        />
                    )
                : (
                        <Droplist
                            variant={variant}
                            layout={FILL}
                        >
                            {text}
                        </Droplist>
                    );
        }
        case 'scaler': return (
            <Scaler
                variant={variant}
                layout={{ position: 'absolute', right: 0, bottom: 0 }}
            />
        );
        case 'icon': return (
            <Icon
                variant={variant ?? '0'}
                tintColor={tintColor}
                layout={{ position: 'absolute', left: 0, top: 0 }}
            />
        );
        case 'shape': {
            const color = flashColor(element.color);

            return (
                <Shape
                    color={color?.hex}
                    alpha={color?.alpha}
                    layout={FILL}
                />
            );
        }
        default: {
            // A plain window: its rect filled with its colour where it asks for a background.
            const color = element.background || element.tag === 'background' ? flashColor(element.color) : undefined;

            return color
                ? (
                        <Region
                            backgroundColor={color.hex}
                            backgroundAlpha={color.alpha}
                            layout={FILL}
                        />
                    )
                : null;
        }
    }
};

/**
 * A window drawn as a `Region` rather than a plain box: one with a look that follows the pointer
 * (`dynamic_style`), a tooltip, or a click its window's code handles.
 */
const isRegion = (element: TemplateElement, binding: TemplateBinding | undefined) => element.tag === 'region'
    || !!element.dynamicStyle
    || !!binding?.onPointerOver
    || !!binding?.onPointerOut
    || (!!binding?.onPointerTap && !CLICKABLE_FACES.has(element.tag));

const CLICKABLE_FACES = new Set([ 'button', 'button_thick', 'container_button', 'tab_button', 'tab_container_button' ]);

/** Each standalone scrollbar's target, each target's axes, and the targets - by the elements, which stay the same array while nothing changes. */
const SCROLL_LINKS = new WeakMap<readonly TemplateElement[], ScrollLinks>();

const scrollLinksOf = (elements: readonly TemplateElement[]): ScrollLinks => {
    let links = SCROLL_LINKS.get(elements);

    if (!links) {
        const scrollbars = linkTemplateScrollbars(elements);
        const scrollAxes = new Map<TemplateElement, Set<TemplateScrollAxis>>();

        for (const [ scrollbar, target ] of scrollbars) scrollAxes.set(target, new Set([ ...(scrollAxes.get(target) ?? []), TEMPLATE_SCROLLBAR_TAGS[scrollbar.tag] ]));

        links = { scrollbars, scrollAxes, scrollTargets: new Set(scrollAxes.keys()) };
        SCROLL_LINKS.set(elements, links);
    }

    return links;
};

const isUrl = (src: string) => /^(https?:)?\/\//.test(src);

/**
 * `StaticBitmapWrapperController.assetUri`: a new asset is asked for, and the bitmap shows what it
 * had until it arrives - for good when it never does (a room with no camera thumbnail keeps the
 * layout's `newnavigator_default_room`). What it had is the layout's own asset.
 */
const TemplateBitmap = ({ src, previous, ...image }: ImageProps & { src: string; previous: string | undefined }) => {
    const texture = useTextureFromUrl(isUrl(src) ? src : undefined);
    const shown = (!isUrl(src) || texture) ? src : previous;

    return shown
        ? (
                <ThemeImage
                    src={shown}
                    {...image}
                />
            )
        : null;
};

/** A bubble's `direction` var: the side its pointer is on. */
const POINTER_DIRECTIONS = new Set<PointerDirection>([ 'up', 'down', 'left', 'right' ]);

/** The frame's own outline, which nothing of its content draws over. */
const FRAME_OUTLINE = 1;

interface FrameContentClipProps {
    /** The frame's size and its content area's insets (`margins`). */
    width: number;
    height: number;
    margins: readonly [ number, number, number, number ];
    children: ReactNode;
}

/**
 * A frame's children, cut as the client shows them: to the content area at its sides and bottom -
 * `navigator_frame_2`'s pale border at (-3, -3) stops there rather than covering the frame's edge
 * columns - and, above the content area, out to the frame's one-pixel outline, where that layout's
 * white strip and tabs run up to the title bar and across to the edge.
 */
const FrameContentClip = ({ width, height, margins, children }: FrameContentClipProps) => {
    const [ mask, setMask ] = useState<PixiGraphics | null>(null);
    const [ left, top, right, bottom ] = margins;
    const contentWidth = Math.max(0, width - left - right);
    const contentHeight = Math.max(0, height - top - bottom);
    const toOutline = (margin: number) => Math.max(0, margin - FRAME_OUTLINE);

    return (
        <pixiContainer
            mask={mask ?? undefined}
            layout={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%' }}
        >
            <pixiGraphics
                ref={setMask}
                eventMode="none"
                draw={(g) => {
                    g.clear();
                    g.rect(-toOutline(left), -top, contentWidth + toOutline(left) + toOutline(right), top).fill(0xFFFFFF);
                    g.rect(0, 0, contentWidth, contentHeight).fill(0xFFFFFF);
                }}
            />
            {children}
        </pixiContainer>
    );
};

/** The view id of a template's (first) root element - the window, when it is a frame. */
const ROOT_ID = '0';

interface ElementViewProps {
    element: TemplateElement;
    context: Context;
    id: string;
    flow?: Flow;
    /** A list's `show` over this item: whether it is one of the names shown. */
    shown?: boolean;
}

/**
 * One element and its subtree. Memoised: every prop is the template's own data or stable, and the
 * element reads its binding and laid-out rect from the store itself - so a changed caption redraws
 * that text alone, not its parent or its siblings.
 */
const ElementView = memo(({ element, context, id, flow, shown }: ElementViewProps) => {
    const state = useSyncExternalStore(context.store.subscribe, () => context.store.get(element));
    const scrollLinks = useContext(ScrollLinksContext);
    const binding = state?.binding;
    const rect: TemplateRect = state?.rect ?? element;
    // A list's `show` decides for its items; otherwise the binding, over the layout.
    const hidden = !(shown ?? binding?.visible ?? !element.hidden);

    if (hidden && !context.showHidden) return null;

    const alpha = (hidden ? 0.4 : 1) * (binding?.alpha ?? element.blend ?? 1);
    const list = TEMPLATE_LISTS[element.tag];
    const childFlow = FLOWS[element.tag];
    const show = list ? binding?.show : undefined;
    const children = (
        <>
            {element.children.map((child, index) => (
                <ElementView
                    key={child.itemKey ?? String(index)}
                    element={child}
                    context={context}
                    id={`${id}.${child.itemKey ?? index}`}
                    flow={childFlow}
                    shown={show ? show.includes(child.name ?? '') : undefined}
                />
            ))}
            {binding?.children}
        </>
    );

    // A layout's own scrollbar, and the list it scrolls (`ScrollBarController.resolveScrollTarget`).
    const scrollTarget = scrollLinks.scrollbars.get(element);

    if (scrollTarget) {
        return (
            <TemplateScrollbar
                element={element}
                target={scrollTarget}
                axis={TEMPLATE_SCROLLBAR_TAGS[element.tag]}
                store={context.scroll}
                layout={rectOf(rect, flow)}
                alpha={alpha}
            />
        );
    }

    const scrollAxes = scrollLinks.scrollAxes.get(element);

    if (scrollAxes && rect.scrollContent) {
        return (
            <TemplateScrollTarget
                element={element}
                rect={rect}
                content={rect.scrollContent}
                axes={scrollAxes}
                store={context.scroll}
                layout={rectOf(rect, flow)}
                alpha={alpha}
                face={faceOf(element, rect, context, binding)}
            >
                {children}
            </TemplateScrollTarget>
        );
    }

    if (isRegion(element, binding)) {
        return (
            <Region
                name={element.name}
                tooltip={tooltipOf(element, context, binding)}
                dynamicStyle={element.dynamicStyle as RegionProps['dynamicStyle']}
                interactive={element.params?.events?.includes('input') || undefined}
                disabled={binding?.disabled}
                onPointerTap={binding?.onPointerTap}
                onPointerOver={binding?.onPointerOver}
                onPointerOut={binding?.onPointerOut}
                alpha={alpha}
                layout={{ ...rectOf(rect, flow), overflow: rect.clip ? 'hidden' : undefined }}
            >
                {faceOf(element, rect, context, binding)}
                {children}
            </Region>
        );
    }

    // A frame is a window: its skin and title, and its children in its content area - placed from there,
    // as the client adds a frame's children to its `_CONTENT` container. The root one opens as the
    // window `frame` describes, when there is one.
    if (element.tag === 'frame') {
        const window = id === ROOT_ID ? context.frame : undefined;
        const resizeDirection = window?.resizeDirection ?? 'none';
        const [ minWidth, maxWidth, minHeight, maxHeight ] = element.limits ?? [ null, null, null, null ];
        // The axis the user resizes takes the layout's limits; the other is the template's size, which
        // the window's code sets (`width` while it hides a pane).
        const axisLayout = (resizes: boolean, size: number, min: number | null, max: number | null) => (resizes
            ? { min: min ?? undefined, max: max ?? undefined }
            : { min: size, max: size });
        const horizontal = axisLayout(resizeDirection === 'x' || resizeDirection === 'all', rect.width, minWidth, maxWidth);
        const vertical = axisLayout(resizeDirection === 'y' || resizeDirection === 'all', rect.height, minHeight, maxHeight);
        const frame = (
            <Frame
                id={window?.id ?? `${context.idPrefix}${id}`}
                variant={element.style}
                caption={captionOf(element, context, binding)}
                tintColor={tintOf(element, binding)}
                margins={element.margins ?? [ 0, 0, 0, 0 ]}
                defaultPosition={window ? window.defaultPosition : { x: 0, y: 0 }}
                centered={window?.centered}
                rememberPosition={!!window}
                draggable={!!window}
                onClose={window?.onClose}
                resizeDirection={resizeDirection}
                onResize={resizeDirection !== 'none' ? context.onFrameResize : undefined}
                layout={{ width: rect.width, height: rect.height, minWidth: horizontal.min, maxWidth: horizontal.max, minHeight: vertical.min, maxHeight: vertical.max }}
            >
                <FrameContentClip
                    width={rect.width}
                    height={rect.height}
                    margins={element.margins ?? [ 0, 0, 0, 0 ]}
                >
                    {children}
                </FrameContentClip>
            </Frame>
        );

        return (
            <Box
                layout={rectOf(rect, flow)}
                alpha={alpha}
            >
                {/* A window is the desktop's own child, sorted among the others as it is activated: not
                    placed here, so the frame moves its container onto the desktop. */}
                {window ? <WindowPlacedContext.Provider value={false}>{frame}</WindowPlacedContext.Provider> : frame}
            </Box>
        );
    }

    // A tab context holds its tab buttons (`TabContextController`'s selector): drawn in it, which
    // crops them - not beside it, where its art would lie over them and take their clicks.
    if (element.tag === 'tab_context') {
        return (
            <Box
                layout={rectOf(rect, flow)}
                alpha={alpha}
            >
                <TabContext
                    variant={element.style}
                    layout={FILL}
                >
                    {children}
                </TabContext>
            </Box>
        );
    }

    // A bubble is a frame (`BubbleController` extends `FrameController`): its children in its content area.
    if (element.tag === 'bubble') {
        return (
            <Bubble
                variant={element.style}
                pointer={POINTER_DIRECTIONS.has(element.vars.direction as PointerDirection) ? element.vars.direction as PointerDirection : undefined}
                tintColor={tintOf(element, binding)}
                margins={element.margins ?? [ 0, 0, 0, 0 ]}
                alpha={alpha}
                layout={rectOf(rect, flow)}
            >
                {children}
            </Bubble>
        );
    }

    // A scrollable list or grid (`ScrollableItemListWindow`): its items in its inner list, which
    // scrolls, the scrollbar beside it while there is more than fits - each where its window layout
    // put it (`TemplateScroll`); the scroll itself, the wheel and the thumb are the theme's.
    if (rect.scroll) {
        const { viewport, scrollbar, content } = rect.scroll;

        return (
            <Box
                layout={rectOf(rect, flow)}
                alpha={alpha}
            >
                {faceOf(element, rect, context, binding)}
                <ScrollArea
                    orientation="vertical"
                    variant={scrollbar?.style}
                    hideDisabledScrollbar={binding?.autoHideScrollBar ?? true}
                    layout={{ position: 'absolute', left: 0, top: 0, width: rect.width, height: rect.height, gap: 0 }}
                    viewportLayout={{ position: 'absolute', left: viewport.x, top: viewport.y, width: viewport.width, height: viewport.height }}
                    scrollbarLayout={scrollbar
                        ? { position: 'absolute', left: scrollbar.x, top: scrollbar.y, width: scrollbar.width, height: scrollbar.height }
                        : { position: 'absolute', left: rect.width, top: 0, width: 0, height: rect.height }}
                    contentLayout={{ position: 'relative', width: content.width, height: content.height }}
                >
                    {children}
                </ScrollArea>
            </Box>
        );
    }

    // A list's items in its flow, `spacing` apart; a scrollable one shows what fits.
    if (list) {
        const spacing = Number(binding?.spacing ?? element.vars.spacing);

        return (
            <Box
                layout={{ ...rectOf(rect, flow), flexDirection: list.direction, flexWrap: list.wrap ? 'wrap' : undefined, gap: Number.isFinite(spacing) && spacing > 0 ? spacing : undefined, overflow: (list.scroll || rect.clip) ? 'hidden' : undefined }}
                alpha={alpha}
            >
                {faceOf(element, rect, context, binding)}
                {children}
            </Box>
        );
    }

    return (
        <Box
            layout={{ ...rectOf(rect, flow), overflow: rect.clip ? 'hidden' : undefined }}
            alpha={alpha}
        >
            {faceOf(element, rect, context, binding)}
            {children}
        </Box>
    );
});

ElementView.displayName = 'TemplateElementView';

/**
 * A template drawn with the theme, at its own size.
 *
 * `bindings` may be a new object every render - an inline literal is the expected use. Its keys are
 * resolved to elements once per set of keys (`resolveTemplateNames`), and only the elements whose
 * binding draws differently redraw (`TemplateBindingStore`). `resolveText` and `imageUrl` should be
 * stable: a new one redraws every element, which is what a change of language needs.
 */
export const TemplateView = ({ template, resolveText, imageUrl, bindings, showHidden = false, idPrefix = 'template-', width, height, arrange, frame }: TemplateViewProps) => {
    const [ store ] = useState(() => new TemplateBindingStore());
    // The size the user dragged the window to; the template is laid out at it.
    const [ frameSize, setFrameSize ] = useState<FrameSize | null>(null);
    // A template's one root window is drawn at its origin; the copy is made once, so it stays the
    // element bindings resolve to and a memoised view keeps.
    const sources = useMemo(() => (template.elements.length === 1 ? [ { ...template.elements[0], x: 0, y: 0 } ] : template.elements), [ template ]);
    // The clones the code adds, made into elements of their own; the rest are the template's.
    const [ expander ] = useState(() => new TemplateExpander());
    const { elements, byElement, missing: missingKeys, arranges } = expander.expand(sources, bindings);
    const [ scroll ] = useState(() => new TemplateScrollStore());
    const scrollLinks = scrollLinksOf(elements);
    const missing = missingKeys.join('\n');

    const context = useMemo<Context>(() => ({
        // A text may name another (`${key}` in its value): read through, a few levels deep.
        resolveText: (caption) => {
            let text = caption ?? '';

            for (let depth = 0; depth < 4 && text.includes('${'); depth++) text = text.replace(/\$\{([^}]+)\}/g, (whole, key: string) => resolveText?.(key) ?? whole);

            return text;
        },
        imageUrl,
        store,
        showHidden,
        idPrefix,
        frame,
        scroll,
        onFrameResize: setFrameSize,
    }), [ resolveText, imageUrl, store, showHidden, idPrefix, frame, scroll ]);

    // A list's `show` over its items; otherwise the binding, over the layout.
    const shownBy = new Map<TemplateElement, boolean>();

    for (const [ element, binding ] of byElement) {
        if (binding.show && TEMPLATE_LISTS[element.tag]) {
            for (const child of element.children) shownBy.set(child, binding.show.includes(child.name ?? ''));
        }
    }

    // The window's size: the user's along the axis they resize, else the code's.
    const resizes = frame?.resizeDirection ?? 'none';
    const layoutWidth = ((resizes === 'x' || resizes === 'all') ? frameSize?.width : undefined) ?? width;
    const layoutHeight = ((resizes === 'y' || resizes === 'all') ? frameSize?.height : undefined) ?? height;

    const windowsIn = (scope: readonly TemplateElement[], windowOf: (element: TemplateElement) => LayoutWindow | undefined): TemplateWindows => ({
        find: (key) => {
            const element = resolveTemplateNames(scope, [ key ]).targets.get(key);

            return element ? windowOf(element) : undefined;
        },
        root: () => windowOf(scope[0]),
    });
    // Each clone as its code sets it up, before its own clones are added to it; once the layout is
    // built, the window's own code.
    const setups = new Map(arranges.map(({ scope, arrange: setup }) => [ scope, (windowOf: (element: TemplateElement) => LayoutWindow | undefined) => setup(windowsIn([ scope ], windowOf)) ]));
    const arrangeAll: TemplateArrange | undefined = arrange ? windowOf => arrange(windowsIn(elements, windowOf)) : undefined;

    // The rects the window's rules settle on, the texts measured as they will draw (cached by text).
    const rects = layoutTemplate(elements, {
        captionOf: element => context.resolveText(byElement.get(element)?.caption ?? element.caption),
        measure: measureTemplateText,
        visibleOf: element => shownBy.get(element) ?? byElement.get(element)?.visible ?? !element.hidden,
        skinOf: element => template.skins?.[templateSkinKey(element.tag, element.style)],
        scrollTargets: scrollLinks.scrollTargets,
        autoHideScrollBarOf: element => byElement.get(element)?.autoHideScrollBar ?? true,
        spacingOf: element => byElement.get(element)?.spacing,
        setupOf: element => setups.get(element),
    }, (layoutWidth !== undefined || layoutHeight !== undefined) ? { width: layoutWidth ?? template.width, height: layoutHeight ?? template.height } : undefined, arrangeAll);
    const rootRect = elements.length === 1 ? rects.get(elements[0]) : undefined;

    // The root window is where its code puts it: drawn at its origin whatever its resize alignment did.
    if (rootRect) rects.set(elements[0], { ...rootRect, x: 0, y: 0 });

    // During render, so the elements that draw in this pass read this render's state; the ones
    // memoised past it are told in the layout effect, before the frame is shown.
    store.update(byElement, rects);

    useLayoutEffect(() => store.commit());

    // A bound name the loaded template does not have: the layout changed under the code that binds it.
    useEffect(() => {
        if (missing) console.warn(`Template "${template.name}" has no element for binding ${missing.split('\n').map(key => `"${key}"`).join(', ')}`);
    }, [ template.name, missing ]);

    return (
        // Opened as a window, the frame is on the desktop and this box holds nothing in its flow.
        <Box layout={{ position: frame ? 'absolute' : 'relative', width: rootRect?.width ?? template.width, height: rootRect?.height ?? template.height }}>
            <ScrollLinksContext.Provider value={scrollLinks}>
                {elements.map((element, index) => (
                    <ElementView
                        key={String(index)}
                        element={element}
                        context={context}
                        id={String(index)}
                    />
                ))}
            </ScrollLinksContext.Provider>
        </Box>
    );
};
