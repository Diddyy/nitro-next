import { CatalogTypeEnum } from '@nitrodevco/nitro-api';
import { GetFurnitureAliasesComposer, InfoRetrieveComposer } from '@nitrodevco/nitro-packets';
import { GetTicker } from '@nitrodevco/nitro-renderer';
import { useEffect } from 'react';

import { useWebSocketContext } from '#base/context/communication';
import { useConfigValue } from '#base/context/system';
import { useWindowVisibility } from '#base/hooks';

import { AvatarEditorComponent, CatalogWrapper, FriendListWrapper, InventoryComponent, NavigatorComponent, RoomWrapper, ToolbarChatSettingsComponent, ToolbarOtherSettingsComponent, ToolbarSoundSettingsComponent, ToolbarWordFilterComponent, WalletComponent, WiredChestComponent, WiredContractComponent, WiredMenuComponent, WiredRewardNotificationsComponent, WiredSelfDonationComponent, WiredSetupComponent, WiredTradeComponent, WiredTransactionsComponent } from './components';
import { TargetedOfferComponent } from './components/catalog/TargetedOfferComponent';
import { CollectiblesComponent } from './components/collectibles';
import { EarningsComponent } from './components/earnings';
import { GroupCreatedComponent, GroupHcRequiredComponent, GroupInfoComponent, GroupManagementComponent, GroupMembersComponent, GroupRoomInfoComponent } from './components/groups';
import { HabbiconsComponent } from './components/habbicons';
import { HotelViewComponent } from './components/hotel-view';
import { MotdNotificationComponent } from './components/notifications';
import { OfferCenterComponent } from './components/offer-center';
import { RoomSettingsWidget } from './components/room/widgets/room-settings';
import { SpecialItemsComponent } from './components/special-items';
import { UserProfileComponent } from './components/user-profile';
import { registerHandlers } from './handlers';
import { useRegisterHandlers } from './hooks';
import { Box, ModalLayer, TooltipLayer, WindowLayer } from './theme';
import { TargetedOfferMinimizedView } from './views/catalog/targeted-offers/TargetedOfferMinimizedView';
import { MessengerView } from './views/messenger/MessengerView';
import { ClubGiftNotificationView } from './views/notifications/ClubGiftNotificationView';
import { NotificationPopupsView } from './views/notifications/NotificationPopupsView';
import { NotificationsExtensionAnchor } from './views/notifications/NotificationsExtensionAnchor';
import { NotificationsView } from './views/notifications/NotificationsView';
import { SafetyLockedNotificationView } from './views/notifications/SafetyLockedNotificationView';
import { ActivityPointsView } from './views/purse/ActivityPointsView';
import { PurseTemplateView } from './views/purse/PurseTemplateView';
import { PurseView } from './views/purse/PurseView';
import { RoomChatInputView } from './views/room-widgets/chat-input/RoomChatInputView';
import { SystemDialogsView } from './views/system/SystemDialogsView';
import { TemplatePreviewView } from './views/system/TemplatePreviewView';
import { ToolbarView } from './views/toolbar/ToolbarView';

export const MainView = () => {
    const { setReady, send } = useWebSocketContext();
    const maxFPS = useConfigValue<number>('fps.limit') ?? 60;
    // The window templates spike: the purse drawn from its Flash template instead of `PurseView`.
    const templatePurse = useConfigValue<boolean>('ui.templates.purse') === true;
    const { isWindowVisible: isMessengerVisible } = useWindowVisibility('messenger');

    // Every connection-lifetime packet handler, attached before the effect below lets the queued packets through.
    useRegisterHandlers(registerHandlers);

    useEffect(() => {
        GetTicker().maxFPS = maxFPS;
    }, [ maxFPS ]);

    /*
     * Effects run children first, so by the time this one runs every listener in the tree below -
     * and the handlers registered above - is attached. Only then are the packets that arrived
     * while the UI was mounting let through.
     */
    useEffect(() => {
        send(new InfoRetrieveComposer({}));
        // `onAuthenticationOK` asks for the furni aliases right after the user object.
        send(new GetFurnitureAliasesComposer({}));
        setReady();
    }, []);

    return (
        <>
            <RoomWrapper />
            <HotelViewComponent />
            {/* Window context 1's desktop: every window is drawn and ordered in here. */}
            <WindowLayer>
                <Box layout={{
                    position: 'absolute',
                    top: 0,
                    right: 0,
                    // The purse's right edge at `desktop.width - 3` (the extension grid's own inset).
                    marginRight: 3,
                    width: 230,
                    flex: 1,
                    flexDirection: 'column',
                    alignItems: 'flex-end',
                }}
                >
                    {templatePurse ? <PurseTemplateView /> : <PurseView />}
                    <Box layout={{
                        flex: 1,
                        flexDirection: 'column',
                        alignItems: 'flex-end',
                        width: 192,
                    }}
                    >
                        <ActivityPointsView />
                        <TargetedOfferMinimizedView />
                        {/* `SingularNotificationController`'s extensions, docked at the end of the column. */}
                        <SafetyLockedNotificationView />
                        <ClubGiftNotificationView />
                    </Box>
                    {/* `GroupRoomInfoCtrl` docks the banner in this column, under the quest tracker and event card. */}
                    <GroupRoomInfoComponent />
                    <NotificationsExtensionAnchor />
                </Box>
                <AvatarEditorComponent />
                <TemplatePreviewView />
                <CatalogWrapper catalogType={CatalogTypeEnum.Normal} />
                <CatalogWrapper catalogType={CatalogTypeEnum.BuildersClub} />
                <InventoryComponent />
                <FriendListWrapper />
                <NavigatorComponent />
                {isMessengerVisible && <MessengerView />}
                {/* `RoomSettingsCtrl` is the navigator's, not the room's: it also edits a room you are not in. */}
                <RoomSettingsWidget />
                <WalletComponent />
                <WiredSetupComponent />
                <WiredMenuComponent />
                <WiredChestComponent />
                <WiredContractComponent />
                <WiredTransactionsComponent />
                <WiredTradeComponent />
                <WiredSelfDonationComponent />
                <WiredRewardNotificationsComponent />
                <EarningsComponent />
                <SpecialItemsComponent />
                <GroupInfoComponent />
                <GroupMembersComponent />
                <GroupManagementComponent />
                <GroupCreatedComponent />
                <GroupHcRequiredComponent />
                <UserProfileComponent />
                <CollectiblesComponent />
                <HabbiconsComponent />
                <OfferCenterComponent />
                <TargetedOfferComponent />
                <ToolbarView />
                <ToolbarOtherSettingsComponent />
                <ToolbarSoundSettingsComponent />
                <ToolbarChatSettingsComponent />
                <ToolbarWordFilterComponent />
                {/* Drawn after the toolbar because it sits inside it when it fits; it renders nothing outside a room. */}
                <RoomChatInputView />
                <NotificationsView />
                <MotdNotificationComponent />
                <NotificationPopupsView />
                <SystemDialogsView />
                {/* Context 3: every `ModalDialog` is moved in here, over the windows and their popups. */}
                <ModalLayer />
                <TooltipLayer />
            </WindowLayer>
        </>
    );
};
