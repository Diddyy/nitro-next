/**
 * One widget of the reception - `LandingViewWidgetType.getWidgetForType` for the types the port
 * draws (`PORTED_LANDING_VIEW_WIDGETS`), including `WidgetContainerWidget`, which shows whichever
 * widget the timing code of its slot's schedule names (`switchCurrentWidget`). Until that code
 * arrives, or when it is empty, the container is its empty 250x30 `widget_container_widget`.
 */
import {
    hotelViewCodeWidget, hotelViewColorableFormat, HotelViewCommonSettings, hotelViewPaneWidths, hotelViewSlotSchedule, isWideHotelViewSlot, LandingViewWidgetType, PORTED_LANDING_VIEW_WIDGETS, useConfigData, useSystemStore,
} from '#base/context/system';
import { Box } from '#base/theme';

import { HotelViewBonusRareWidget } from './HotelViewBonusRareWidget';
import { HotelViewCommunityGoalWidget, HotelViewPromoArticleWidget } from './HotelViewCampaigns';
import { HotelViewGenericWidget } from './HotelViewGenericWidget';

interface HotelViewSlotWidgetProps {
    type: string;
    slot: number;
    code: string | null;
    settings: HotelViewCommonSettings;
}

const HotelViewContainerWidget = ({ slot, settings }: { slot: number; settings: HotelViewCommonSettings }) => {
    const config = useConfigData();
    const code = useSystemStore(x => x.hotelViewTimingCodes[hotelViewSlotSchedule(config, slot)]);
    const type = code ? hotelViewCodeWidget(config, code) : '';

    if (!code || !PORTED_LANDING_VIEW_WIDGETS.has(type) || (type === LandingViewWidgetType.WIDGETCONTAINER)) return <Box layout={{ width: 250, height: 30 }} />;

    return (
        <HotelViewSlotWidget
            type={type}
            slot={slot}
            code={code}
            settings={settings}
        />
    );
};

export const HotelViewSlotWidget = ({ type, slot, code, settings }: HotelViewSlotWidgetProps) => {
    const config = useConfigData();
    const panes = hotelViewPaneWidths(config);
    const width = isWideHotelViewSlot(slot) ? panes.left : panes.right;

    switch (type) {
        case LandingViewWidgetType.WIDGETCONTAINER:
            return (
                <HotelViewContainerWidget
                    slot={slot}
                    settings={settings}
                />
            );
        case LandingViewWidgetType.GENERIC:
            return (
                <HotelViewGenericWidget
                    slot={slot}
                    code={code}
                    settings={settings}
                />
            );
        case LandingViewWidgetType.BONUSRARE:
            return <HotelViewBonusRareWidget colorable={hotelViewColorableFormat(settings)} />;
        case LandingViewWidgetType.PROMOARTICLE:
            return <HotelViewPromoArticleWidget width={width} />;
        case LandingViewWidgetType.COMMUNITYGOAL:
        case LandingViewWidgetType.COMMUNITYGOALVS:
        case LandingViewWidgetType.COMMUNITYGOALVSVOTE:
            return <HotelViewCommunityGoalWidget width={width} />;
        default:
            return null;
    }
};
