/**
 * Mounts Flash's moderation tool (`ModerationManager`) for a moderator: the start panel once
 * `ModeratorInit` came, and the windows its `WindowTracker` holds - user info, room tool, chatlog
 * send message and mod action - each once per kind and id, the newest on top.
 */
import { moderationWindowKey, useModerationStore } from '#base/context/moderation';
import { ModActionView } from '#base/views/moderation/ModActionView';
import { ModChatlogView } from '#base/views/moderation/ModChatlogView';
import { ModRoomToolView } from '#base/views/moderation/ModRoomToolView';
import { ModSendMessageView } from '#base/views/moderation/ModSendMessageView';
import { ModStartPanelView } from '#base/views/moderation/ModStartPanelView';
import { ModUserInfoView } from '#base/views/moderation/ModUserInfoView';

export const ModerationComponent = () => {
    const hasInit = useModerationStore(x => !!x.init);
    const windows = useModerationStore(x => x.windows);

    if (!hasInit) return null;

    return (
        <>
            <ModStartPanelView />
            {windows.map((window) => {
                const key = moderationWindowKey(window);

                switch (window.kind) {
                    case 'userInfo': return (
                        <ModUserInfoView
                            key={key}
                            userId={window.userId}
                        />
                    );
                    case 'roomTool': return (
                        <ModRoomToolView
                            key={key}
                            roomId={window.roomId}
                        />
                    );
                    case 'chatlog': return (
                        <ModChatlogView
                            key={key}
                            type={window.type}
                            id={window.id}
                        />
                    );
                    case 'sendMessage': return (
                        <ModSendMessageView
                            key={key}
                            userId={window.userId}
                            userName={window.userName}
                        />
                    );
                    case 'modAction': return (
                        <ModActionView
                            key={key}
                            userId={window.userId}
                            userName={window.userName}
                        />
                    );
                }
            })}
        </>
    );
};
