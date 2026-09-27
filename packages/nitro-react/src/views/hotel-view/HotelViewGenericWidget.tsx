/**
 * `GenericWidget`: a reception promo built from two hotel variables. `layout` places the
 * `generic_widget` bitmap and the content column (`configureLayout`); `conf` is the column's
 * elements, one `type,args...` per `;` (`configureContentColumn`), each drawn from its
 * `element_<type>` layout and wired by its `LandingViewElementType` handler:
 *
 * - `caption`, `subcaption`, `bodytext` (`TextElementHandler`): the text `${arg}`, optionally a
 *   width. The optional `border` argument draws the layout editor's debug outline and is ignored.
 * - `spacing` (`SpacingElementHandler`): an empty row `arg` pixels tall.
 * - `catalogbutton` (`CatalogButtonElementHandler`): opens the catalogue at the page named, or
 *   where it was left.
 * - `internallinkbutton` (`InternalLinkButtonElementHandler`): follows an in-client link.
 * - `link` (`LinkElementHandler`): the "leaving the hotel" alert, and the page.
 * - `customtimer` (`CustomTimerElementHandler`): a countdown to a hotel time, captioned with its
 *   running or expired text, floating at its own position when its first argument says so.
 *
 * The remaining element types (`title`, `image`, the room, badge, habblet, VIP, community goal,
 * daily quest and concurrent-user elements) are not drawn: their handlers need windows and
 * managers the port has not got. `configureContentColumn` skips an element with no handler the
 * same way, so the column simply leaves them out. The tracking calls the handlers make
 * (`trackGoogle`, `trackEventLog`) have no receiver here.
 */
import { Container as PixiContainer } from 'pixi.js';
import { useState } from 'react';

import { openCatalogExternalLink, openClientLink } from '#base/commands';
import { useWebSocketContext, WebSocketConnection } from '#base/context/communication';
import {
    hotelViewColorableFormat, HotelViewCommonSettings, hotelViewGenericConf, hotelViewPaneWidths, HotelViewSecondsUntil, hotelViewTimerTimeStr, isWideHotelViewSlot, parseHotelViewGenericConf, parseHotelViewGenericLayout, useConfigData,
    useSystemActions, useSystemStore, useTranslation,
} from '#base/context/system';
import { useSecondsClock } from '#base/hooks';
import { Box, Button, ColorableTextFormat, CountdownWidget, Region, ThemeImage, ThemeText, useLayoutSize } from '#base/theme';

type Send = WebSocketConnection['send'];

const fillOptions = (format: ColorableTextFormat) => (format.fill ? { fill: format.fill } : {});

interface TimerProps {
    args: string[];
    colorable: ColorableTextFormat;
}

/** `AbstractTimerElementHandler.setTimer`: the countdown while time remains, and the caption for either state. */
const HotelViewTimerElement = ({ args, colorable }: TimerProps) => {
    const t = useTranslation();
    const now = useSecondsClock();
    const timeStr = hotelViewTimerTimeStr({ type: '', args });
    const received: HotelViewSecondsUntil | undefined = useSystemStore(x => x.hotelViewSecondsUntil[timeStr]);
    const floating = args[0] === 'true';
    const seconds = received ? Math.max(0, received.seconds - ((now - received.receivedAt) / 1000)) : 0;
    // `initialize` calls `setCaption(null)`: no caption until the first answer.
    const caption = received ? ((received.seconds > 0) ? args[3] : args[4]) : '';

    return (
        <Box layout={{
            width: 149, height: 56,
            ...(floating ? { position: 'absolute', left: parseInt(args[1], 10) | 0, top: parseInt(args[2], 10) | 0 } : {}),
        }}
        >
            <ThemeText
                text={caption ? t(caption) : ''}
                visible={!!caption}
                textStyle="il_heading_3"
                textOptions={{ fontSize: 9, align: 'center', ...fillOptions(colorable) }}
                flashFormat={colorable.flashFormat}
                layout={{ position: 'absolute', left: 0, top: 0, width: 146, height: 14 }}
            />
            <CountdownWidget
                seconds={seconds}
                visible={!!received && (received.seconds > 0)}
                colorableFormat={colorable}
                layout={{ position: 'absolute', left: 25, top: 19 }}
            />
        </Box>
    );
};

interface ElementProps {
    type: string;
    args: string[];
    colorable: ColorableTextFormat;
    send: Send;
}

const HotelViewGenericElement = ({ type, args, colorable, send }: ElementProps) => {
    const t = useTranslation();
    const { showWindow, hideWindow } = useSystemActions();
    const width = (args.length > 1) ? (parseInt(args[1], 10) | 0) : 250;

    switch (type) {
        case 'caption':
            return (
                <ThemeText
                    text={t(args[0])}
                    textStyle="il_heading_1"
                    textOptions={{ fontSize: 18, wordWrap: true, wordWrapWidth: width - 4, ...fillOptions(colorable) }}
                    flashFormat={{ letterSpacing: -0.6, ...colorable.flashFormat }}
                    markup
                    layout={{ width, flexShrink: 0 }}
                />
            );
        case 'subcaption':
            return (
                <ThemeText
                    text={t(args[0])}
                    textStyle="il_heading_3"
                    textOptions={{ wordWrap: true, wordWrapWidth: width - 4, ...fillOptions(colorable) }}
                    flashFormat={colorable.flashFormat}
                    markup
                    layout={{ width, flexShrink: 0 }}
                />
            );
        case 'bodytext':
            return (
                <ThemeText
                    text={t(args[0])}
                    textStyle="il_regular"
                    textOptions={{ wordWrap: true, wordWrapWidth: width - 4, ...fillOptions(colorable) }}
                    flashFormat={colorable.flashFormat}
                    markup
                    layout={{ width, flexShrink: 0 }}
                />
            );
        case 'spacing':
            return <Box layout={{ width: 250, height: parseInt(args[0], 10) | 0 }} />;
        case 'catalogbutton':
        case 'internallinkbutton':
            return (
                <Button
                    variant="100"
                    name="action_button"
                    onPointerTap={() => {
                        if (type === 'internallinkbutton') {
                            openClientLink(send, args[1] ?? '');

                            return;
                        }

                        // `HabboCatalog.openCatalogPage` / `openCatalog`: the normal catalogue replaces the Builders Club one.
                        hideWindow('builders_catalog');

                        if (args[1]) showWindow('catalog', { pageName: args[1] });
                        else showWindow('catalog');
                    }}
                    layout={{ marginLeft: -11, width: 200, height: 48, flexShrink: 0 }}
                >
                    {t(args[0])}
                </Button>
            );
        case 'link':
            return (
                <Region
                    onPointerTap={() => openCatalogExternalLink(args[1] ?? '')}
                    layout={{ width: 252, height: 17 }}
                >
                    <ThemeText
                        text={t(args[0])}
                        textStyle="il_regular"
                        textOptions={fillOptions(colorable)}
                        flashFormat={{ underline: true, ...colorable.flashFormat }}
                        markup
                    />
                </Region>
            );
        case 'customtimer':
            return (
                <HotelViewTimerElement
                    args={args}
                    colorable={colorable}
                />
            );
        default:
            return null;
    }
};

export interface HotelViewGenericWidgetProps {
    slot: number;
    /** The configuration code a `WidgetContainerWidget` chose, or null for a slot's own generic widget. */
    code: string | null;
    settings: HotelViewCommonSettings;
}

export const HotelViewGenericWidget = ({ slot, code, settings }: HotelViewGenericWidgetProps) => {
    const config = useConfigData();
    const { send } = useWebSocketContext();
    const [ contentNode, setContentNode ] = useState<PixiContainer | null>(null);
    const [ bitmapNode, setBitmapNode ] = useState<PixiContainer | null>(null);
    const contentSize = useLayoutSize(contentNode);
    const bitmapSize = useLayoutSize(bitmapNode);
    const panes = hotelViewPaneWidths(config);
    const wide = isWideHotelViewSlot(slot);
    const elements = parseHotelViewGenericConf(hotelViewGenericConf(config, slot, code, 'conf'));
    const layout = parseHotelViewGenericLayout(hotelViewGenericConf(config, slot, code, 'layout'));
    const colorable = hotelViewColorableFormat(settings);
    const inColumn = elements.filter(element => !((element.type === 'customtimer') && (element.args[0] === 'true')));
    const floating = elements.filter(element => (element.type === 'customtimer') && (element.args[0] === 'true'));

    const floatingBottom = Math.max(0, ...floating.map(element => (parseInt(element.args[2], 10) | 0) + 56));
    const height = Math.max(layout.containerHeight, layout.contentY + contentSize.height, layout.bitmapUri ? layout.bitmapY + bitmapSize.height : 0, floatingBottom);

    // The container accommodates its children (`params` 0x24000), so it is at least
    // `container.height` and otherwise as tall as the bitmap or the column reaches.
    return (
        <Box layout={{ width: wide ? panes.left : panes.right, height, flexShrink: 0 }}>
            {layout.bitmapUri && (
                <ThemeImage
                    ref={setBitmapNode}
                    name="bitmap"
                    src={layout.bitmapUri}
                    layout={{ position: 'absolute', left: layout.bitmapX, top: layout.bitmapY, ...((layout.bitmapWidth !== null) ? { width: layout.bitmapWidth } : {}), ...((layout.bitmapHeight !== null) ? { height: layout.bitmapHeight } : {}) }}
                    bitmap={{ stretchedX: false, stretchedY: false, fitSizeToContents: true }}
                    eventMode="none"
                />
            )}
            <Box
                ref={setContentNode}
                layout={{
                    position: 'absolute',
                    flexDirection: 'column',
                    left: layout.contentX ?? (wide ? 230 : 0),
                    top: layout.contentY,
                    width: layout.contentWidth,
                }}
            >
                {inColumn.map((element, index) => (
                    <HotelViewGenericElement
                        key={index}
                        type={element.type}
                        args={element.args}
                        colorable={colorable}
                        send={send}
                    />
                ))}
            </Box>
            {floating.map((element, index) => (
                <HotelViewGenericElement
                    key={`floating-${index}`}
                    type={element.type}
                    args={element.args}
                    colorable={colorable}
                    send={send}
                />
            ))}
        </Box>
    );
};
