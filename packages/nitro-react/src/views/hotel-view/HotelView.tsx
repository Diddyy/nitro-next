/**
 * The hotel view - `HabboLandingView`'s `WidgetContainerLayout` over
 * `landing_view_default_dynamic_layout`, sized to the desktop (`resizeDynamicLayout`).
 *
 * The layout is 1172x822; each piece keeps the place its `params` give it as the desktop grows or
 * shrinks. The pale blue `content_background` fills everything; the pictures lie over it, bottom
 * up: `background_gradient_top` and `background_gradient` across the whole width, the right-hand
 * `background_right` and `background_horizon` sized to their pictures and held 38 above the
 * bottom, then the widget grid, `background_hotel_top` and `background_left` (which draw over the
 * grid, as in Flash), the user's avatar, the 50 high `0x333333` bar along the bottom and the logo.
 *
 * The pictures are the hotel's: `setBackgroundGraphics` sets each from
 * `landing.view.<code.>background_<name>.uri` (and hides one whose `.visible` is `false`) once the
 * server has said which code the `landing.view.bgtiming` schedule is on - `code.` is left out for
 * the empty code, the hotel's everyday one. Until that answer the layout's own pictures stand, and
 * only `background_hotel_top` and the logo have one.
 *
 * `avatarimage` is the one fixed widget this layout has a place for (`widget_placeholder_avatarimage`,
 * 202 above the bottom): `AvatarImageWidget`, the user's full figure facing south-east at its own
 * size, redrawn whenever the figure changes. `widget_placeholder_bottom_slot` shows the fixed widget
 * `landing.view.dynamic.slot.6.widget` names; the hotel names none, and it is hidden.
 *
 * Not ported: the moving background objects (`MovingBackgroundObjects`, `landing.view.bgobject.<n>`
 * - the hotel sets every one empty), the other layouts `landing.view.layoutxml` can pick (the hotel
 * picks none), the new-identity override of the slots, and `OnBoardingHcFlow`, the new-user flow
 * shown instead of the landing view when the login suggests it.
 */

import { AvatarImage } from '#base/components/AvatarImage';
import { useLandingViewStore } from '#base/context/landing-view';
import { useConfigData } from '#base/context/system';
import { useOwnUserFigure, useOwnUserGender } from '#base/context/user';
import { useViewportSize } from '#base/hooks';
import { Region, ThemeImage } from '#base/theme';
import { configReader, landingViewCommonSettings } from '#base/utils';

import { hotelViewColorable } from './hotelViewColorable';
import { HotelViewDynamicGrid } from './HotelViewDynamicGrid';

/** `landing_view_default_dynamic_layout`'s own size. */
const LAYOUT_WIDTH = 1172;
const LAYOUT_HEIGHT = 822;

/** `content_background`'s colour. */
const CONTENT_BACKGROUND = '#aae0f0';

/** How far above the layout's bottom the bottom-anchored pictures stop (822 - 784). */
const PICTURE_BOTTOM = 38;

/** `widget_placeholder_avatarimage`: 109 across, 202 above the bottom. */
const AVATAR_X = 109;
const AVATAR_BOTTOM = LAYOUT_HEIGHT - 620;

/** `AvatarImageWidget`'s default direction, `southeast`. */
const AVATAR_DIRECTION = 2;

/** The bar along the bottom: `0x333333`, 50 high. */
const BOTTOM_BAR_HEIGHT = 50;
const BOTTOM_BAR_COLOR = '#333333';

/** `WidgetContainerLayout`'s background pictures, in `setBackgroundGraphics`' order. */
type BackgroundName = 'background_gradient_top' | 'background_hotel_top' | 'background_gradient' | 'background_right' | 'background_horizon' | 'background_left';

const BACKGROUND_NAMES: BackgroundName[] = [ 'background_gradient_top', 'background_hotel_top', 'background_gradient', 'background_right', 'background_horizon', 'background_left' ];

/** The layout's own `asset_uri`s - every other picture is empty until the hotel's arrive. */
const LAYOUT_BACKGROUNDS: Partial<Record<BackgroundName, string>> = {
    background_hotel_top: '${image.library.url}reception/reception_backdrop_hotel_top_stretch.png',
};

/** `logo`'s picture. */
const LOGO_URI = '${image.library.url}reception/reception_logo_drape.png';

export const HotelView = () => {
    const config = useConfigData();
    const { width, height } = useViewportSize();
    const figure = useOwnUserFigure();
    const gender = useOwnUserGender();
    const { configString, resolve } = configReader(config);
    const code = useLandingViewStore(x => x.timingCodes[configString('landing.view.bgtiming')]);

    const colorable = hotelViewColorable(landingViewCommonSettings(configString));
    const dh = height - LAYOUT_HEIGHT;

    /** `setBackgroundGraphics(code)` for one picture: its uri, or `undefined` when hidden or unset. */
    const background = (name: BackgroundName): string | undefined => {
        if (code === undefined) return LAYOUT_BACKGROUNDS[name] ? resolve(LAYOUT_BACKGROUNDS[name]) : undefined;

        const prefix = (code === '') ? '' : `${code}.`;

        if (configString(`landing.view.${prefix}${name}.visible`) === 'false') return undefined;

        const uri = configString(`landing.view.${prefix}${name}.uri`);

        return (uri !== '') ? uri : (LAYOUT_BACKGROUNDS[name] ? resolve(LAYOUT_BACKGROUNDS[name]) : undefined);
    };

    const pictures = Object.fromEntries(BACKGROUND_NAMES.map(name => [ name, background(name) ])) as Record<BackgroundName, string | undefined>;

    return (
        <Region
            name="content_background"
            backgroundColor={CONTENT_BACKGROUND}
            layout={{ position: 'absolute', left: 0, top: 0, width, height }}
        >
            {pictures.background_gradient_top && ((1 + dh) > 0) && (
                <ThemeImage
                    name="background_gradient_top"
                    src={pictures.background_gradient_top}
                    bitmap={{ pivot: 'bottom left' }}
                    layout={{ position: 'absolute', left: 0, top: -175, width, height: 1 + dh }}
                />
            )}
            {pictures.background_gradient && (
                <ThemeImage
                    name="background_gradient"
                    src={pictures.background_gradient}
                    bitmap={{ pivot: 'bottom left', stretchedY: false }}
                    layout={{ position: 'absolute', left: 0, top: -366 + dh, width, height: 1150 }}
                />
            )}
            {pictures.background_right && (
                <ThemeImage
                    name="background_right"
                    src={pictures.background_right}
                    bitmap={{ pivot: 'bottom right', stretchedX: false, stretchedY: false, fitSizeToContents: true }}
                    layout={{ position: 'absolute', right: LAYOUT_WIDTH - 1171, bottom: PICTURE_BOTTOM }}
                />
            )}
            {pictures.background_horizon && (
                <ThemeImage
                    name="background_horizon"
                    src={pictures.background_horizon}
                    bitmap={{ pivot: 'bottom left', stretchedX: false, stretchedY: false, fitSizeToContents: true }}
                    layout={{ position: 'absolute', left: 0, bottom: PICTURE_BOTTOM }}
                />
            )}
            <HotelViewDynamicGrid
                width={width}
                height={height}
                colorable={colorable}
            />
            {pictures.background_hotel_top && ((1 + dh) > 0) && (
                <ThemeImage
                    name="background_hotel_top"
                    src={pictures.background_hotel_top}
                    bitmap={{ pivot: 'bottom left', stretchedX: false }}
                    layout={{ position: 'absolute', left: 0, top: 0, width: 123, height: 1 + dh }}
                />
            )}
            {pictures.background_left && (
                <ThemeImage
                    name="background_left"
                    src={pictures.background_left}
                    bitmap={{ pivot: 'bottom left', stretchedX: false, stretchedY: false, fitSizeToContents: true }}
                    layout={{ position: 'absolute', left: 0, bottom: PICTURE_BOTTOM }}
                />
            )}
            {figure && (
                <AvatarImage
                    figure={figure}
                    gender={gender}
                    direction={AVATAR_DIRECTION}
                    layout={{ position: 'absolute', left: AVATAR_X, top: height - AVATAR_BOTTOM }}
                />
            )}
            <Region
                backgroundColor={BOTTOM_BAR_COLOR}
                layout={{ position: 'absolute', left: 0, bottom: 0, width, height: BOTTOM_BAR_HEIGHT }}
            />
            <ThemeImage
                name="logo"
                src={resolve(LOGO_URI)}
                bitmap={{ pivot: 'bottom left', stretchedX: false, stretchedY: false }}
                layout={{ position: 'absolute', left: 100, top: 0, width: 145, height: 200 }}
            />
        </Region>
    );
};
