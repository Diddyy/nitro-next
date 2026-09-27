/**
 * `WidgetContainerLayout`'s default reception background, from
 * `landing_view_default_dynamic_layout_xml` (pinned in tools/references/hotel-view.json).
 * The toolbar supplies navigation. `AvatarImageWidget` supplies the full self figure, and
 * `DynamicLayoutManager` the widget slots (`HotelViewWidgetGrid`), which the layout draws above
 * the horizon and under the hotel top and the left backdrop.
 *
 * The layout's `widget_placeholder_bottom_slot` takes `landing.view.dynamic.slot.6.widget`
 * (`setupBottomSlotWidgetName`) when that names a fixed widget; none of the fixed widgets that
 * can go there (the catalogue promos, daily quest, competition and moderation promos, the
 * community goal as a fixed widget) are ported, so it stays empty, as it does for this hotel.
 */
import { AvatarImage } from '#base/components/AvatarImage';
import { hotelViewProperty, useConfigData, useSystemStore } from '#base/context/system';
import { useOwnUserFigure, useOwnUserGender } from '#base/context/user';
import { useViewportSize } from '#base/hooks';
import { BoxLayout, ImageProps, Region, ThemeImage } from '#base/theme';

import { HotelViewWidgetGrid } from './HotelViewWidgetGrid';

export const HotelView = () => {
    const { width, height } = useViewportSize();
    const config = useConfigData();
    const backgrounds = useSystemStore(x => x.hotelViewBackgrounds);
    const imageLibrary = hotelViewProperty(config, 'image.library.url');
    const figure = useOwnUserFigure();
    const gender = useOwnUserGender();
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
            {/* `moving_objects_container` (MovingBackgroundObjects) is not ported; it sits here, under the slots. */}
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
