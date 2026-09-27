/**
 * `WidgetContainerLayout.applyCommonWidgetSettings`: what the landing view's common settings do to
 * every text a widget tags `COLORABLE` - the colour, the etching colour and the etching position,
 * each only when the hotel set it to something other than Flash's default.
 *
 * The etching colour is ARGB. The hotel's `000000` parses to 0, a fully transparent etch, so its
 * white widget texts come out with no etching at all even though they are `il_*` styles, whose own
 * etch is the translucent white line that makes a light fill smear. That is Flash's rendering, not
 * a light fill put on an etched style by mistake.
 */
import { TextStyleOptions } from 'pixi.js';

import { EtchingPosition, FlashTextFieldOverrides } from '#base/theme';
import { LandingViewCommonSettings } from '#base/utils';

export interface HotelViewColorable {
    textOptions: TextStyleOptions;
    flashFormat: FlashTextFieldOverrides;
}

export const hotelViewColorable = (settings: LandingViewCommonSettings): HotelViewColorable => ({
    textOptions: (settings.textColor !== undefined) ? { fill: `#${(settings.textColor & 0xFFFFFF).toString(16).padStart(6, '0')}` } : {},
    flashFormat: {
        ...((settings.etchingColor !== undefined) ? { etchingColor: settings.etchingColor } : {}),
        ...((settings.etchingPosition !== undefined) ? { etchingPosition: settings.etchingPosition as EtchingPosition } : {}),
    },
});
