/**
 * The purse's start-up requests - the ones `HabboInventory.initComponent` sends: the credits, the
 * NFT credits and the club subscription (`ScrGetUserInfoMessageComposer("habbo_club")`, answered
 * with `ScrSendUserInfo`; Turbo sends the account's preferences with it).
 *
 * Not sent yet: `GetSilverMessageComposer` and `GetBadgePointLimitsComposer` (see `docs/feature-gaps.md`).
 */
import { GetCreditsInfoComposer, GetNftCreditsComposer, ScrGetUserInfoComposer } from '@nitrodevco/nitro-packets';
import { useEffect } from 'react';

import { useWebSocketContext } from '#base/context/communication';

export const WalletComponent = () => {
    const { send } = useWebSocketContext();

    useEffect(() => {
        send(new GetCreditsInfoComposer({}));
        send(new GetNftCreditsComposer({}));
        send(new ScrGetUserInfoComposer({ productName: 'habbo_club' }));
    }, []);

    return null;
};
