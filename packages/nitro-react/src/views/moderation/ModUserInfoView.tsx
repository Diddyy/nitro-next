import { useEffect, useState } from 'react';

import { requestModeratorUserInfo } from '#base/commands';
import { useWebSocketContext } from '#base/context/communication';
import { MOD_CHATLOG_USER, moderationFrame, moderationWindowKey, useModerationActions, useModerationStore } from '#base/context/moderation';
import { TemplateWindow, useTemplate } from '#base/theme';

import { userInfoBindings } from './userInfoBindings';

/**
 * Flash's `moderation/UserInfoFrameCtrl` with its `UserInfoCtrl`: the `user_info_frame` window
 * ("User Info") holding `user_info`, which shows "Loading..." until `ModeratorUserInfo` for the
 * player arrives (`load` asks it). Its buttons open the player's chatlog and the send-message
 * window, its room visits, and the mod action window (`onModActionButton`), which is off for "No
 * identity". The housekeeping links are not built yet.
 */
export const ModUserInfoView = ({ userId }: { userId: number }) => {
    const { send } = useWebSocketContext();
    const user = useModerationStore(x => x.userInfos[userId]);
    const { showWindow, closeWindow } = useModerationActions();
    const userInfoTemplate = useTemplate('habbo-moderation-com/user_info_xml');
    const key = moderationWindowKey({ kind: 'userInfo', userId });
    const [ frame ] = useState(() => moderationFrame(key, () => closeWindow({ kind: 'userInfo', userId })));

    useEffect(() => {
        requestModeratorUserInfo(send, userId);
    }, [ send, userId ]);

    // `UserInfoCtrl.prepare`: `user_info` built and added to the frame's content (`_-bg.addChild`); the
    // frame's layout has no children of its own, so the clone is its one child, laid out in its content area.
    if (!userInfoTemplate) return null;

    return (
        <TemplateWindow
            id="habbo-moderation-com/user_info_frame_xml"
            frame={frame}
            bindings={{
                '': {
                    caption: 'User Info',
                    items: [ {
                        key: 'user_info',
                        from: userInfoTemplate,
                        bindings: {
                            ...userInfoBindings(user),
                            chatlog_but: { onPointerTap: () => user && showWindow({ kind: 'chatlog', type: MOD_CHATLOG_USER, id: user.userId }, key, true) },
                            roomvisits_but: { onPointerTap: () => user && showWindow({ kind: 'roomVisits', userId: user.userId }, key, true) },
                            message_but: { onPointerTap: () => user && showWindow({ kind: 'sendMessage', userId: user.userId, userName: user.userName }, key, true) },
                            modaction_but: { disabled: user?.primaryEmailAddress === 'No identity', onPointerTap: () => user && (user.primaryEmailAddress !== 'No identity') && showWindow({ kind: 'modAction', userId: user.userId, userName: user.userName }, key, true) },
                        },
                    } ],
                },
            }}
        />
    );
};
