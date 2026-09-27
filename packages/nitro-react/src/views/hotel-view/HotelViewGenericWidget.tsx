/**
 * `GenericWidget`: `generic_widget` - a picture and a column of elements, both configured by the
 * hotel (`landing.view.<code>.conf` / `.layout` for a widget a `widgetcontainer` shows, else
 * `landing.view.dynamic.slot.<n>.conf` / `.layout`).
 *
 * `configureLayout` puts the picture where the layout says and, in a wide slot, the column at 230
 * so it clears it; the container is the slot's pane wide and grows to whatever reaches lowest,
 * but never below `container.height` (its `resize_to_accommodate_children`). The elements stack
 * in the column in the order the conf lists them (`content_container`, spacing 0), each built from
 * its `element_<type>` layout:
 *
 * - `caption`, `subcaption`, `bodytext` (`TextElementHandler`): the text `${arg1}`, a third
 *   argument its width. `caption` is `il_heading_1` at 18, `subcaption` `il_heading_3`, the body
 *   the Illumina theme's `il_regular`, all wrapping `formatted_text`.
 * - `catalogbutton` (`CatalogButtonElementHandler`), `internallinkbutton` (`§_-VP§`): a 200x48
 *   style 100 button at x -11, opening the catalogue page `arg2` / following the client link `arg2`.
 * - `link` (`LinkElementHandler`): underlined `link_txt`; a click shows the "leaving the hotel"
 *   alert and opens `arg2`.
 *
 * Every `COLORABLE` text takes the common widget settings.
 *
 * Not drawn: `caption`'s `max_lines` of 2 (`ThemeText` has no line limit - the hotel's captions
 * are one line), `TextElementHandler`'s fourth argument (a text border no campaign sets), and the
 * element types no campaign of the hotel's uses - `customtimer` would need the `countdown` window
 * widget and `GetSecondsUntil`, which the port has neither of, and the rest (`title`, `spacing`,
 * the badge, room, competition and meter elements) have no handler here. Flash stops building the
 * column at a type it has no layout for; here such an element is simply skipped.
 */
import { Container as PixiContainer } from 'pixi.js';
import { useState } from 'react';

import { openCatalogExternalLink, openClientLink } from '#base/commands';
import { useWebSocketContext } from '#base/context/communication';
import { useConfigData, useTranslation } from '#base/context/system';
import { Box, Button, Region, ThemeImage, ThemeText, useLayoutSize } from '#base/theme';
import { configReader, LandingViewElement, landingViewPaneWidths, parseGenericWidgetLayout, parseLandingViewElements } from '#base/utils';

import { HotelViewColorable } from './hotelViewColorable';

/** `element_button`: the button hangs 11 left of the column. */
const BUTTON_X = -11;
const BUTTON_WIDTH = 200;
const BUTTON_HEIGHT = 48;

/** `TextElementHandler`'s windows are 250 wide unless the conf says otherwise. */
const TEXT_WIDTH = 250;

/** `element_link`: the 252x17 region the whole link answers in. */
const LINK_WIDTH = 252;
const LINK_HEIGHT = 17;

/** The `TextField`'s 2px gutter either side, inside the window's width. */
const TEXT_GUTTER = 4;

interface ElementProps {
    element: LandingViewElement;
    colorable: HotelViewColorable;
}

/** `TextElementHandler` over `element_caption` / `element_subcaption` / `element_bodytext`. */
const TextElement = ({ element, colorable }: ElementProps) => {
    const t = useTranslation();
    const width = (element.args.length > 2) ? parseInt(element.args[2]) : TEXT_WIDTH;
    const textStyle = (element.type === 'caption') ? 'il_heading_1' : (element.type === 'subcaption') ? 'il_heading_3' : 'il_regular';

    return (
        <ThemeText
            text={t(element.args[1])}
            markup
            textStyle={textStyle}
            textOptions={{ ...colorable.textOptions, ...((element.type === 'caption') ? { fontSize: 18 } : {}), wordWrap: true, wordWrapWidth: width - TEXT_GUTTER }}
            flashFormat={colorable.flashFormat}
            verticalAlign="top"
            layout={{ width, flexShrink: 0 }}
        />
    );
};

export interface HotelViewGenericWidgetProps {
    slot: number;
    /** `configurationCode`: the code a `widgetcontainer` chose, or none when the slot shows this widget itself. */
    configurationCode?: string;
    colorable: HotelViewColorable;
}

export const HotelViewGenericWidget = ({ slot, configurationCode, colorable }: HotelViewGenericWidgetProps) => {
    const config = useConfigData();
    const { send } = useWebSocketContext();
    const t = useTranslation();
    const [ contentNode, setContentNode ] = useState<PixiContainer | null>(null);
    const [ bitmapNode, setBitmapNode ] = useState<PixiContainer | null>(null);
    const contentSize = useLayoutSize(contentNode);
    const bitmapSize = useLayoutSize(bitmapNode);

    const { configString } = configReader(config);
    // `getConf`: the chosen code's keys, else the slot's own.
    const confKey = (name: string) => ((configurationCode !== undefined) ? `landing.view.${configurationCode}.${name}` : `landing.view.dynamic.slot.${slot}.${name}`);
    const elements = parseLandingViewElements(configString(confKey('conf')));
    const layout = parseGenericWidgetLayout(configString(confKey('layout')), slot, landingViewPaneWidths(configString));
    const height = Math.max(layout.minHeight, layout.contentY + contentSize.height, layout.bitmapUri ? (layout.bitmapY + bitmapSize.height) : 0);

    const renderElement = (element: LandingViewElement, index: number) => {
        switch (element.type) {
            case 'caption':
            case 'subcaption':
            case 'bodytext':
                return (
                    <TextElement
                        key={index}
                        element={element}
                        colorable={colorable}
                    />
                );
            case 'catalogbutton':
            case 'internallinkbutton': {
                const target = element.args[2];
                // `CatalogButtonElementHandler.onClick`: the page by name, else the catalogue; `§_-VP§`: `createLinkEvent`.
                const onTap = (element.type === 'catalogbutton')
                    ? () => openClientLink(send, target ? `catalog/open/${target}` : 'catalog/open')
                    : () => openClientLink(send, target);

                return (
                    <Button
                        key={index}
                        variant="100"
                        name="action_button"
                        onPointerTap={onTap}
                        layout={{ marginLeft: BUTTON_X, width: BUTTON_WIDTH, height: BUTTON_HEIGHT, flexShrink: 0 }}
                    >
                        {t(element.args[1])}
                    </Button>
                );
            }
            case 'link':
                return (
                    <Region
                        key={index}
                        cursor="pointer"
                        onPointerTap={() => openCatalogExternalLink(element.args[2] ?? '')}
                        layout={{ width: LINK_WIDTH, height: LINK_HEIGHT, flexShrink: 0 }}
                    >
                        <ThemeText
                            name="link_txt"
                            text={t(element.args[1])}
                            markup
                            textStyle="il_regular"
                            textOptions={colorable.textOptions}
                            flashFormat={{ ...colorable.flashFormat, underline: true }}
                            verticalAlign="top"
                            layout={{ position: 'absolute', left: 0, top: 0 }}
                        />
                    </Region>
                );
            default:
                return null;
        }
    };

    return (
        <Box layout={{ width: layout.width, height, flexShrink: 0 }}>
            {layout.bitmapUri && (
                <ThemeImage
                    ref={setBitmapNode}
                    name="bitmap"
                    src={layout.bitmapUri}
                    bitmap={{ stretchedX: false, stretchedY: false, fitSizeToContents: true }}
                    layout={{ position: 'absolute', left: layout.bitmapX, top: layout.bitmapY, ...((layout.bitmapWidth !== undefined) ? { width: layout.bitmapWidth } : {}), ...((layout.bitmapHeight !== undefined) ? { height: layout.bitmapHeight } : {}) }}
                />
            )}
            <Box
                ref={setContentNode}
                layout={{ position: 'absolute', left: layout.contentX, top: layout.contentY, width: layout.contentWidth, flexDirection: 'column' }}
            >
                {elements.map(renderElement)}
            </Box>
        </Box>
    );
};
