/**
 * `WidgetContainerLayout`'s default reception background, from
 * `landing_view_default_dynamic_layout_xml` (pinned in tools/references/hotel-view.json).
 * The toolbar supplies navigation. `AvatarImageWidget` supplies the full self figure, and
 * `DynamicLayoutManager` the widget slots (`HotelViewWidgetGrid`), which the layout draws above
 * the horizon and under the hotel top and the left backdrop.
 *
 * The layout's `widget_placeholder_bottom_slot` takes `landing.view.dynamic.slot.6.widget`
 * (`setupBottomSlotWidgetName`) when that names a fixed widget the port draws
 * (`BOTTOM_SLOT_LANDING_VIEW_WIDGETS`); otherwise it stays empty, as it does for this hotel. Like
 * the avatar's placeholder it keeps its distance from the bottom of the window. The moving
 * background objects (`HotelViewMovingObjects`) go in `moving_objects_container`, under the slots.
 */
import { AvatarImage } from '#base/components/AvatarImage';
import { BOTTOM_SLOT_LANDING_VIEW_WIDGETS, HOTEL_VIEW_BOTTOM_SLOT, hotelViewCommonSettings, hotelViewProperty, hotelViewSlotWidget, useConfigData, useSystemStore } from '#base/context/system';
import { useOwnUserFigure, useOwnUserGender } from '#base/context/user';
import { useViewportSize } from '#base/hooks';
import { Box, BoxLayout, ImageProps, Region, ThemeImage } from '#base/theme';

import { HotelViewMovingObjects } from './HotelViewMovingObjects';
import { HotelViewSlotWidget } from './HotelViewSlotWidget';
import { HotelViewWidgetGrid } from './HotelViewWidgetGrid';

/** `widget_placeholder_bottom_slot`'s place in the 1172x822 layout: 120 in, 252 up from the bottom. */
const BOTTOM_SLOT_X = 120;
const BOTTOM_SLOT_FROM_BOTTOM = 252;

export const HotelView = () => {
    const { width, height } = useViewportSize();
    const config = useConfigData();
    const backgrounds = useSystemStore(x => x.hotelViewBackgrounds);
    const imageLibrary = hotelViewProperty(config, 'image.library.url');
    const figure = useOwnUserFigure();
    const gender = useOwnUserGender();
    const bottomWidget = hotelViewSlotWidget(config, HOTEL_VIEW_BOTTOM_SLOT);
    const layer = (name: string, layout: BoxLayout, bitmap: ImageProps['bitmap']) => {
        const background = backgrounds[name];

        if (!background?.visible || !background.uri) return null;

        return (
            <ThemeImage
                src={background.uri}
                layout={{ position: 'absolute', ...layout }}
                bitmap={bitmap}
                eventMode="none"
            />
        );
    };

    return (
        <Region
            backgroundColor="#aae0f0"
            pointerTransparent
            layout={{ position: 'absolute', left: 0, top: 0, width, height, overflow: 'hidden' }}
        >
            {layer('background_gradient_top', { left: 0, top: -175, width, height: Math.max(0, height - 821) }, { pivot: 'bottom left' })}
            {layer('background_gradient', { left: 0, bottom: 38, width, height: 1150 }, { pivot: 'bottom left', stretchedY: false })}
            {layer('background_right', { right: 1, bottom: 38 }, { pivot: 'bottom right', stretchedX: false, stretchedY: false, fitSizeToContents: true })}
            {layer('background_horizon', { left: 0, bottom: 38 }, { pivot: 'bottom left', stretchedX: false, stretchedY: false, fitSizeToContents: true })}
            <HotelViewMovingObjects
                width={width}
                height={height}
            />
            <HotelViewWidgetGrid />
            {layer('background_hotel_top', { left: 0, top: 0, width: 123, height: Math.max(0, height - 821) }, { pivot: 'bottom left', stretchedX: false })}
            {layer('background_left', { left: 0, bottom: 38 }, { pivot: 'bottom left', stretchedX: false, stretchedY: false, fitSizeToContents: true })}
            {figure && (
                <AvatarImage
                    figure={figure}
                    gender={gender}
                    direction={2}
                    scale={1}
                    layout={{ position: 'absolute', left: 109, top: Math.max(0, height - 202) }}
                />
            )}
            {BOTTOM_SLOT_LANDING_VIEW_WIDGETS.has(bottomWidget) && (
                <Box layout={{ position: 'absolute', left: BOTTOM_SLOT_X, top: Math.max(0, height - BOTTOM_SLOT_FROM_BOTTOM) }}>
                    <HotelViewSlotWidget
                        type={bottomWidget}
                        slot={HOTEL_VIEW_BOTTOM_SLOT}
                        code={null}
                        settings={hotelViewCommonSettings(config)}
                    />
                </Box>
            )}
            <Region
                backgroundColor="#333333"
                pointerTransparent
                layout={{ position: 'absolute', left: 0, bottom: 0, width, height: 50 }}
            />
            {imageLibrary && (
                <ThemeImage
                    src={`${imageLibrary}reception/reception_logo_drape.png`}
                    layout={{ position: 'absolute', left: 100, top: 0, width: 145, height: 200 }}
                    bitmap={{ pivot: 'bottom left', stretchedX: false, stretchedY: false }}
                    eventMode="none"
                />
            )}
        </Region>
    );
};
