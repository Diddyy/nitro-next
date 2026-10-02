/** Mounts AS3 AchievementController and its queued level-up dialogs in the Pixi window layer. */
import { useEffect } from 'react';

import { useAchievementsActions, useAchievementsStore } from '#base/context/achievements';
import { useWebSocketContext } from '#base/context/communication';
import { useIsWindowVisible, useWindowActions } from '#base/context/system';
import { AchievementCongratulationsView } from '#base/views/achievements/AchievementCongratulationsView';
import { AchievementsView } from '#base/views/achievements/AchievementsView';

export const AchievementsComponent = () => {
    const visible = useIsWindowVisible('achievements');
    const congratulations = useAchievementsStore(x => x.congratulations);
    const { hideWindow } = useWindowActions();
    const { close, dismissCongratulations, reset } = useAchievementsActions();
    const { isAuthenticated, isDisconnected } = useWebSocketContext();

    useEffect(() => {
        if (isAuthenticated && !isDisconnected) return;

        reset();
        hideWindow('achievements');
    }, [ isAuthenticated, isDisconnected, reset, hideWindow ]);

    return (
        <>
            {visible && (
                <AchievementsView onClose={() => {
                    close();
                    hideWindow('achievements');
                }}
                />
            )}
            {congratulations[0] && (
                <AchievementCongratulationsView
                    data={congratulations[0]}
                    onClose={dismissCongratulations}
                />
            )}
        </>
    );
};
