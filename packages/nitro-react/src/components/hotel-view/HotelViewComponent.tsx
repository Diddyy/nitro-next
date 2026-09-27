/**
 * Mounts the hotel view (`HabboLandingView`) while no room is on screen, and activates it each time
 * it appears - `WidgetContainerLayout.activate`, which asks the server for every schedule's code and
 * the bonus rare (`activateLandingView`).
 */
import { useEffect } from 'react';

import { activateLandingView } from '#base/commands';
import { useWebSocketContext } from '#base/context/communication';
import { useIsLandingViewVisible } from '#base/context/system';
import { HotelView } from '#base/views/hotel-view/HotelView';

export const HotelViewComponent = () => {
    const visible = useIsLandingViewVisible();
    const { send } = useWebSocketContext();

    useEffect(() => {
        if (visible) activateLandingView(send);
    }, [ visible, send ]);

    if (!visible) return null;

    return <HotelView />;
};
