/**
 * The purse's start-up requests - the ones `HabboInventory.initComponent` sends: the credits, the
 * NFT credits and the club subscription (`ScrGetUserInfoMessageComposer("habbo_club")`, answered
 * with `ScrSendUserInfo`; Turbo sends the account's preferences with it).
 *
 * While the subscription has minutes left it is asked for again every minute, so the purse counts
 * down and notices the end - `HabboInventory.setClubStatus` starting `onPurseTimer`.
 *
 * Not sent yet: `GetSilverMessageComposer` (see `docs/feature-gaps.md`). Achievement initialization requests badge point limits.
 */
import { GetCreditsInfoComposer, GetNftCreditsComposer, ScrGetUserInfoComposer } from '@nitrodevco/nitro-packets';
import { useEffect } from 'react';

import { useWebSocketContext } from '#base/context/communication';
import { useUserStore } from '#base/context/user';

export const WalletComponent = () => {
    const { send } = useWebSocketContext();
    const minutesUntilExpiration = useUserStore(x => x.clubSubscription.minutesUntilExpiration);
    const isCountingDown = (minutesUntilExpiration > 0) && (minutesUntilExpiration < 86400000);

    useEffect(() => {
        send(new GetCreditsInfoComposer({}));
        send(new GetNftCreditsComposer({}));
        send(new ScrGetUserInfoComposer({ productName: 'habbo_club' }));
    }, []);

    useEffect(() => {
        if (!isCountingDown) return;

        const timer = setInterval(() => send(new ScrGetUserInfoComposer({ productName: 'habbo_club' })), 60000);

        return () => clearInterval(timer);
    }, [ isCountingDown ]);

    return null;
};
