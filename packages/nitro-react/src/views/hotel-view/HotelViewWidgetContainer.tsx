/**
 * `WidgetContainerWidget`: a slot whose content changes on a schedule. The slot's
 * `landing.view.dynamic.slot.<n>.conf` is the schedule - `yyyy-mm-dd hh:mm,code;...` - and the
 * server says which code it has reached (`CurrentTimingCodeMessage` for that schedule, asked for by
 * `activateLandingView`). The code names the widget to show, `landing.view.<code>.widget`, which is
 * configured from the code's own keys.
 *
 * Until the answer comes, or when it is the empty code, the container is `widget_container_widget`
 * - 250x30 and empty - and still takes its place in the grid, as Flash's does. Of the types a code
 * can name, only `generic` is drawn: the hotel's schedules name nothing else today, and the
 * community goal widgets its older codes use (`communitygoal`, `communitygoalvsmode`,
 * `communitygoalvsmodevote`) are not ported, so such a code leaves the container empty.
 */
import { useLandingViewStore } from '#base/context/landing-view';
import { useConfigData } from '#base/context/system';
import { Box } from '#base/theme';
import { configReader } from '#base/utils';

import { HotelViewColorable } from './hotelViewColorable';
import { HotelViewGenericWidget } from './HotelViewGenericWidget';

/** `widget_container_widget`'s size. */
const EMPTY_WIDTH = 250;
const EMPTY_HEIGHT = 30;

export interface HotelViewWidgetContainerProps {
    slot: number;
    colorable: HotelViewColorable;
}

export const HotelViewWidgetContainer = ({ slot, colorable }: HotelViewWidgetContainerProps) => {
    const config = useConfigData();
    const { configString } = configReader(config);
    const schedule = configString(`landing.view.dynamic.slot.${slot}.conf`);
    const code = useLandingViewStore(x => x.timingCodes[schedule]) ?? '';

    if ((code !== '') && (configString(`landing.view.${code}.widget`) === 'generic')) {
        return (
            <HotelViewGenericWidget
                // A new code is a new widget (`createWidgetContainer`), not the last one reconfigured.
                key={code}
                slot={slot}
                configurationCode={code}
                colorable={colorable}
            />
        );
    }

    return <Box layout={{ width: EMPTY_WIDTH, height: EMPTY_HEIGHT, flexShrink: 0 }} />;
};
