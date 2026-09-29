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
 * template drawn as it stands is not. Nothing here is wired up - what a window's code does with its
 * named elements (`findChildByName`) stays with that code; this is the template's look. Its texts
 * (`${key}`) are read through `resolveText`, and its bitmaps (`asset_uri`) through `imageUrl`.
 *
 * Mirrors `scripts/generate-layout-views.ts`, which turns the same XML into TSX: the same element
 * types onto the same components, a text's style, colour, wrap and alignment read from its vars the
 * same way.
 */
import { ReactNode } from 'react';

import { Border } from '../Border';
import { Box, BoxLayout } from '../Box';
import { Bubble } from '../Bubble';
import { Button } from '../Button';
import { ButtonGroupCenter } from '../ButtonGroupCenter';
import { ButtonGroupLeft } from '../ButtonGroupLeft';
import { ButtonGroupRight } from '../ButtonGroupRight';
import { ButtonThick } from '../ButtonThick';
import { CheckBox } from '../CheckBox';
import { CloseButton } from '../CloseButton';
import { ContainerButton } from '../ContainerButton';
import { Droplist } from '../Droplist';
import { HABBO_TEXT_STYLES } from '../font/flash-text';
import { Frame } from '../Frame';
import { Header } from '../Header';
import { Icon } from '../Icon';
import { IconButton } from '../IconButton';
import { RadioButton } from '../RadioButton';
import { Region } from '../Region';
import { Scaler } from '../Scaler';
import { Shape } from '../Shape';
import { TabButton } from '../TabButton';
import { TabContent } from '../TabContent';
import { TabContext } from '../TabContext';
import { ThemeImage } from '../ThemeImage';
import { ThemeText } from '../ThemeText';
import { FlashBitmapVars, TextStyleKey, themeDefaultTextStyle } from '../utils';

/** One element of a template, as its `<layout>` XML has it. */
export interface TemplateElement {
    /** The Flash window type (`container`, `text`, `button`, ...). */
    tag: string;
    name?: string;
    x: number;
    y: number;
    width: number;
    height: number;
    /** Its `style` - the theme variant. */
    style?: string;
    /** Its caption, `${key}`s unresolved. */
    caption?: string;
    /** `visible="false"`: built, and not drawn until its window's code shows it. */
    hidden?: boolean;
    /** Its `color` attribute (`0xffRRGGBB`): a skin's tint, a background's fill. */
    color?: string;
    /** `background="true"`: the window fills its rect with `color`. */
    background?: boolean;
    /** Its `blend`: its opacity. */
    blend?: number;
    /** Its `<variables>`, by key. */
    vars: Record<string, string>;
    /** A frame's content area, from its edges (`FrameController.margins`): where its children are placed. */
    margins?: readonly [ number, number, number, number ];
    children: TemplateElement[];
}

export interface Template {
    name: string;
    width: number;
    height: number;
    /** The `<window>`'s elements. */
    elements: TemplateElement[];
}

export interface TemplateViewProps {
    template: Template;
    /** A caption's `${key}`: the text it names, or `undefined` to show the key. */
    resolveText?: (key: string) => string | undefined;
    /** Where a bitmap the template names (`asset_uri`) is. */
    imageUrl?: (asset: string) => string;
    /** Draws the `visible="false"` elements too, faded. */
    showHidden?: boolean;
    /** Gives each frame an id of its own, for the window layer. */
    idPrefix?: string;
}

/** A Flash colour (`0xAARRGGBB`, `0xRRGGBB`) as `#rrggbb` and its alpha. */
const flashColor = (value: string | undefined): { hex: string; alpha: number } | undefined => {
    const digits = value?.replace(/^0x/i, '').replace(/^#/, '');

    if (!digits || !/^[0-9a-f]{1,8}$/i.test(digits)) return undefined;

    const padded = digits.padStart(digits.length > 6 ? 8 : 6, '0');
    const alpha = padded.length === 8 ? Number.parseInt(padded.slice(0, 2), 16) / 255 : 1;

    return { hex: `#${padded.slice(-6).toLowerCase()}`, alpha };
};

const flashBool = (value: string | undefined) => value === 'true' || value === '1';

/** A tint: a colour that changes anything (white, and none, leave a skin as it is). */
const tintOf = (element: TemplateElement) => {
    const color = flashColor(element.color);

    return color && color.hex !== '#ffffff' ? color.hex : undefined;
};

/**
 * The lists (`ItemListController`, `ItemGridController`): they place their items themselves, one after
 * another down or along, or in rows - not at the items' own x/y.
 */
const LISTS: Record<string, { direction: 'column' | 'row'; wrap?: boolean; scroll?: boolean }> = {
    itemlist: { direction: 'column' },
    itemlist_vertical: { direction: 'column' },
    itemlist_horizontal: { direction: 'row' },
    itemgrid_vertical: { direction: 'row', wrap: true },
    scrollable_itemlist_vertical: { direction: 'column', scroll: true },
    scrollable_itemgrid_vertical: { direction: 'row', wrap: true, scroll: true },
    selector_list: { direction: 'row' },
};

/** How a list places its items: along its axis, or in rows. */
type Flow = { direction: 'column' | 'row'; wrap: boolean };

const TEXT_TAGS = new Set([ 'text', 'label', 'formatted_text', 'html', 'link' ]);
const BITMAP_TAGS = new Set([ 'bitmap', 'static_bitmap' ]);
const KNOWN_TEXT_STYLES = new Set(Object.keys(HABBO_TEXT_STYLES));

/** The flag a bitmap var turns from its default, as `FlashBitmapVars` takes it. */
const bitmapVars = (vars: Record<string, string>): FlashBitmapVars => {
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

    if (vars.pivot_point) bitmap.pivot = vars.pivot_point;

    return bitmap;
};

interface Context {
    resolveText: (caption: string | undefined) => string;
    imageUrl?: (asset: string) => string;
    showHidden: boolean;
    idPrefix: string;
}

/**
 * An element's box in its parent: at its rect - or, an item of a list, in the list's flow at its own
 * size, only its cross-axis coordinate kept (`ItemListController.updateScrollAreaRegion` sets the other).
 */
const rectOf = (element: TemplateElement, flow?: Flow): BoxLayout => (flow
    ? {
            position: 'relative',
            width: element.width,
            height: element.height,
            flexShrink: 0,
            ...(!flow.wrap && flow.direction === 'column' && element.x ? { marginLeft: element.x } : {}),
            ...(!flow.wrap && flow.direction === 'row' && element.y ? { marginTop: element.y } : {}),
        }
    : { position: 'absolute', left: element.x, top: element.y, width: element.width, height: element.height });

/** The box an element's own face fills: the whole of its rect. */
const FILL: BoxLayout = { position: 'absolute', left: 0, top: 0, width: '100%', height: '100%' };

const textOf = (element: TemplateElement, context: Context): ReactNode => {
    const label = element.tag === 'label';
    const style = element.vars.text_style && KNOWN_TEXT_STYLES.has(element.vars.text_style) ? element.vars.text_style as TextStyleKey : themeDefaultTextStyle(element.style);
    const color = (label ? element.vars.text_color !== undefined : !!flashColor(element.vars.text_color)?.hex && element.vars.text_color !== '0x0') ? flashColor(element.vars.text_color)?.hex : undefined;
    const wordWrap = !label && flashBool(element.vars.word_wrap);
    const autoSize = element.vars.auto_size ?? (label ? 'left' : 'none');
    const align = autoSize === 'center' || autoSize === 'right' ? autoSize : undefined;
    const text = context.resolveText(element.caption);

    if (!text) return null;

    return (
        <ThemeText
            text={text}
            textStyle={style}
            textOptions={{ fill: color, wordWrap: wordWrap || undefined, wordWrapWidth: wordWrap ? Math.max(1, element.width - 4) : undefined, align }}
            markup={element.tag === 'formatted_text' || element.tag === 'html' ? true : undefined}
            clip={!label && autoSize === 'none' ? true : undefined}
            layout={{ position: 'absolute', left: 0, top: 0, width: element.width, ...(label ? {} : { height: element.height }) }}
        />
    );
};

/** What an element draws of its own, filling its rect, under its children. */
const faceOf = (element: TemplateElement, context: Context): ReactNode => {
    const variant = element.style;
    const tintColor = tintOf(element);
    const caption = context.resolveText(element.caption);
    const text = caption ? <ThemeText text={caption} /> : undefined;

    if (TEXT_TAGS.has(element.tag)) return textOf(element, context);

    if (BITMAP_TAGS.has(element.tag)) {
        const asset = element.vars.asset_uri || element.vars.bitmap_asset_name;

        if (!asset || asset.includes('$') || !context.imageUrl) return null;

        return (
            <ThemeImage
                src={context.imageUrl(asset)}
                bitmap={bitmapVars(element.vars)}
                layout={{ ...FILL, width: element.width, height: element.height }}
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
        case 'bubble': return (
            <Bubble
                variant={variant}
                usePointer={false}
                layout={FILL}
            />
        );
        case 'button': return (
            <Button
                variant={variant}
                tintColor={tintColor}
                layout={FILL}
            >
                {text}
            </Button>
        );
        case 'button_thick': return (
            <ButtonThick
                variant={variant}
                tintColor={tintColor}
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
                layout={FILL}
            >
                {text}
            </TabButton>
        );
        case 'tab_context': return (
            <TabContext
                variant={variant}
                layout={FILL}
            />
        );
        case 'tab_content': return (
            <TabContent
                variant={variant}
                layout={FILL}
            />
        );
        case 'droplist':
        case 'dropmenu': return (
            <Droplist
                variant={variant}
                layout={FILL}
            >
                {text}
            </Droplist>
        );
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

const ElementView = ({ element, context, id, flow }: { element: TemplateElement; context: Context; id: string; flow?: Flow }) => {
    if (element.hidden && !context.showHidden) return null;

    const alpha = (element.hidden ? 0.4 : 1) * (element.blend ?? 1);
    const list = LISTS[element.tag];
    const childFlow = list ? { direction: list.direction, wrap: !!list.wrap } : undefined;
    const children = element.children.map((child, index) => (
        <ElementView
            key={`${id}.${index}`}
            element={child}
            context={context}
            id={`${id}.${index}`}
            flow={childFlow}
        />
    ));

    // A frame is a window: its skin and title, and its children in its content area - placed from there,
    // as the client adds a frame's children to its `_CONTENT` container.
    if (element.tag === 'frame') {
        return (
            <Box
                layout={rectOf(element, flow)}
                alpha={alpha}
            >
                <Frame
                    id={`${context.idPrefix}${id}`}
                    variant={element.style}
                    caption={context.resolveText(element.caption)}
                    tintColor={tintOf(element)}
                    margins={element.margins ?? [ 0, 0, 0, 0 ]}
                    defaultPosition={{ x: 0, y: 0 }}
                    rememberPosition={false}
                    draggable={false}
                    resizeDirection="none"
                    layout={{ width: element.width, height: element.height }}
                >
                    {children}
                </Frame>
            </Box>
        );
    }

    // A list's items in its flow, `spacing` apart; a scrollable one shows what fits.
    if (list) {
        const spacing = Number(element.vars.spacing);

        return (
            <Box
                layout={{ ...rectOf(element, flow), flexDirection: list.direction, flexWrap: list.wrap ? 'wrap' : undefined, gap: Number.isFinite(spacing) && spacing > 0 ? spacing : undefined, overflow: list.scroll ? 'hidden' : undefined }}
                alpha={alpha}
            >
                {faceOf(element, context)}
                {children}
            </Box>
        );
    }

    return (
        <Box
            layout={rectOf(element, flow)}
            alpha={alpha}
        >
            {faceOf(element, context)}
            {children}
        </Box>
    );
};

/** A template drawn with the theme, at its own size. */
export const TemplateView = ({ template, resolveText, imageUrl, showHidden = false, idPrefix = 'template-' }: TemplateViewProps) => {
    const context: Context = {
        // A text may name another (`${key}` in its value): read through, a few levels deep.
        resolveText: (caption) => {
            let text = caption ?? '';

            for (let depth = 0; depth < 4 && text.includes('${'); depth++) text = text.replace(/\$\{([^}]+)\}/g, (whole, key: string) => resolveText?.(key) ?? whole);

            return text;
        },
        imageUrl,
        showHidden,
        idPrefix,
    };

    return (
        <Box layout={{ position: 'relative', width: template.width, height: template.height }}>
            {template.elements.map((element, index) => (
                <ElementView
                    key={String(index)}
                    element={template.elements.length === 1 ? { ...element, x: 0, y: 0 } : element}
                    context={context}
                    id={String(index)}
                />
            ))}
        </Box>
    );
};
