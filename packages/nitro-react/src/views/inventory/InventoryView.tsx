/**
 * The inventory window - Flash `InventoryMainView` over `inventory_xml`: a style 3 frame (490x342,
 * content margins 6/35/6/6, width fixed, height down to 300) whose `top_content` holds the
 * `tabs` tab context, the `empty_container` and `loading_container` a page shows while it has
 * nothing to list, and the `contentArea` (5,35 468x261) the selected page draws in, with
 * `subContentArea` (0,301) under it for the trade.
 *
 * - The frame opens at `DEFAULT_VIEW_LOCATION` (120,150) and scales only with
 *   `inventory.allow.scaling` (`getWindow`'s `setParamFlag(65536, ...)`).
 * - The tab context's `tab_content` (style 3) is drawn at 0,30 over the whole context, its
 *   `tab_selector` at 8,0, 32 high; each `tab_container_button` is as wide as its label (margins
 *   10 left and right, the text 7 down, `u_regular` from the Ubuntu theme) and they are laid
 *   left to right (`SelectorListController.updateSelectableRegion`).
 * - `getWindow` re-adds the tabs in layout order - furni, collectibles, rentables, pets, badges,
 *   bots. The port has five of those pages and keeps them all: `rentables` (`duckets.enabled`
 *   without `mergeRentFurni`) is not ported, and `bots` shows only with `inventory.bots.enabled`,
 *   as it does in Flash.
 * - `empty_container` / `loading_container` follow `FurniView.updateContainerVisibility` on the
 *   furni page - loading until the list has arrived, empty while it holds nothing - and the
 *   empty page's `open_catalog_btn` opens the catalog (`InventoryMainView.windowEventProc`).
 * - A tab carries the red unseen item counter (`updateUnseenItemCounts`: furni category 1, pets 3,
 *   badges 4, bots 5 - collectibles and games have none) while its count is above 0:
 *   `createCounter` puts it 3 from the tab's right edge and 3 down, and `updateCounter` widens the
 *   title's right margin to the counter's width plus 6, so the tab grows by the counter and the
 *   counter ends 3 before the tab does.
 * - Leaving a tab resets its unseen items (`windowEventProc`'s `WE_SELECTED` ->
 *   `resetUnseenCounters`), and so does closing the window on it (`hideInventory` ->
 *   `closingInventoryView`, each model resetting while its page is the one showing).
 * - While a trade runs it is docked in `subContentArea` and the window grows by exactly its height
 *   (`TradingView.resizeWindow` -> `InventoryMainView.resizeToFitContents`). Leaving the furni page
 *   cancels the trade (`TradingModel.categorySwitch` / `subCategorySwitch`), and closing the window
 *   closes it (`closingInventoryView`).
 */
import { useEffect } from 'react';

import { resetInventoryUnseenCounters } from '#base/commands';
import { useWebSocketContext } from '#base/context/communication';
import { UnseenItemCategory, useInventoryStore, useInventoryUnseenItemCount } from '#base/context/inventory';
import { useConfigValue, useSystemActions, useTranslation, useWindowParams, WindowParams } from '#base/context/system';
import { Button, Frame, LayoutImage, Region, TabButton, TabContent, TabContext, ThemeImage, ThemeText } from '#base/theme';
import { UnseenItemCounterView } from '#base/views/system/UnseenItemCounterView';

import { InventoryBadgesView } from './InventoryBadgesView';
import { InventoryBotsView } from './InventoryBotsView';
import { InventoryCollectiblesView } from './InventoryCollectiblesView';
import { InventoryFurniView } from './InventoryFurniView';
import { InventoryPetsView } from './InventoryPetsView';
import { InventoryTradingDock } from './trading/InventoryTradingDock';
import { useInventoryTradingDockHeight } from './trading/inventoryTradingLayout';

export type InventoryViewWindowParams = { tab?: 'furni' | 'collectibles' | 'pets' | 'bots' | 'badges' };

type InventoryTab = NonNullable<WindowParams<'inventory'>['tab']>;

/** `inventory_xml`: `top_content` is 478x301, and `subContentArea` starts where it ends. */
const TOP_CONTENT_HEIGHT = 301;
/** The frame's own height with nothing docked - its 35/6 margins around `top_content`. */
const FRAME_HEIGHT = 342;

/** The ported tabs in `inventory_xml`'s order, with their captions and the unseen item category their counter shows (-1 for none). */
const TABS: readonly { id: InventoryTab; caption: string; unseenCategory: number }[] = [
    { id: 'furni', caption: 'inventory.furni', unseenCategory: UnseenItemCategory.OWNED_FURNI },
    { id: 'collectibles', caption: 'inventory.collectibles', unseenCategory: -1 },
    { id: 'pets', caption: 'inventory.furni.tab.pets', unseenCategory: UnseenItemCategory.PET },
    { id: 'badges', caption: 'inventory.badges', unseenCategory: UnseenItemCategory.BADGE },
    { id: 'bots', caption: 'inventory.bots', unseenCategory: UnseenItemCategory.BOT },
];

/** `InventoryMainView.createCounter`: the counter's right edge 3 in from the tab's. */
const TAB_COUNTER_MARGIN = 3;
/** `updateCounter`: the title's right margin with a counter is the counter's width plus twice that. */
const TAB_TITLE_MARGIN = 10;

interface InventoryTabButtonProps {
    caption: string;
    unseenCategory: number;
    selected: boolean;
    onSelect: () => void;
}

/** One `tab_container_button`, with its unseen item counter. */
const InventoryTabButton = ({ caption, unseenCategory, selected, onSelect }: InventoryTabButtonProps) => {
    const unseenCount = useInventoryUnseenItemCount(unseenCategory);

    return (
        <TabButton
            variant="3"
            textStyle="u_regular"
            selected={selected}
            onPointerTap={onSelect}
            layout={{ flexShrink: 0, alignItems: 'flex-start', paddingLeft: TAB_TITLE_MARGIN, paddingTop: 7, paddingRight: (unseenCount > 0) ? TAB_COUNTER_MARGIN : TAB_TITLE_MARGIN }}
        >
            {caption}
            {/* `y = 3`, where the title sits 7 down; the title's margin plus 6 leaves 3 either side of the counter. */}
            <UnseenItemCounterView
                count={Math.max(unseenCount, 0)}
                layout={{ marginLeft: TAB_COUNTER_MARGIN, marginTop: 3 - 7 }}
            />
        </TabButton>
    );
};

export const InventoryView = () => {
    const { tab: activeTab = 'furni' } = useWindowParams('inventory');
    const t = useTranslation();
    const { toggleWindow, showWindow, updateWindowParams } = useSystemActions();
    const allowScaling = useConfigValue<boolean>('inventory.allow.scaling') === true;
    const botsEnabled = useConfigValue<boolean>('inventory.bots.enabled') === true;
    const furniListInitialized = useInventoryStore(x => x.furniListInitialized);
    const furniCount = useInventoryStore(x => x.furniGroups.length);
    const dockedHeight = useInventoryTradingDockHeight();
    const { send } = useWebSocketContext();

    // `resetUnseenCounters(previous tab)` on a switch, and the showing page's `closingInventoryView` on close.
    useEffect(() => () => resetInventoryUnseenCounters(send, activeTab), [ send, activeTab ]);

    // `FurniView.setViewToState`: 1 loading, 2 empty, 3 the page.
    const furniLoading = (activeTab === 'furni') && !furniListInitialized;
    const furniEmpty = (activeTab === 'furni') && furniListInitialized && !furniCount;

    return (
        <Frame
            id="inventory"
            variant="3"
            caption={t('inventory.title')}
            tintColor="#418db0"
            dropShadow={{ distance: 4, alpha: 0.35, blur: 4 }}
            resizeDirection={allowScaling ? 'y' : 'none'}
            defaultPosition={{ x: 120, y: 150 }}
            onClose={() => toggleWindow('inventory')}
            layout={{ position: 'absolute', width: 490, height: FRAME_HEIGHT + dockedHeight, minWidth: 490, maxWidth: 490, minHeight: 300 + dockedHeight }}
            margins={[ 6, 35, 6, 6 ]}
        >
            <Region layout={{ position: 'absolute', left: 0, top: 0, width: 478, height: TOP_CONTENT_HEIGHT }}>
                <TabContent
                    variant="3"
                    layout={{ position: 'absolute', left: 0, top: 30, width: 478, bottom: 0, marginTop: 0, padding: 0 }}
                />
                <TabContext
                    variant="3"
                    layout={{ position: 'absolute', left: 8, top: 0, width: 462, height: 32, padding: 0, overflow: 'hidden' }}
                >
                    {TABS.filter(tab => (tab.id !== 'bots') || botsEnabled).map(tab => (
                        <InventoryTabButton
                            key={tab.id}
                            caption={t(tab.caption)}
                            unseenCategory={tab.unseenCategory}
                            selected={activeTab === tab.id}
                            onSelect={() => updateWindowParams('inventory', { tab: tab.id })}
                        />
                    ))}
                </TabContext>
                {furniEmpty && (
                    <Region layout={{ position: 'absolute', left: 0, top: 20, width: 478, bottom: 3 }}>
                        <ThemeImage
                            src={LayoutImage('inventory/inventory_inventory_empty.png')}
                            bitmap={{ stretchedX: false, stretchedY: false, pivot: 'center' }}
                            layout={{ position: 'absolute', left: 46, top: 42, width: 180, height: 180 }}
                        />
                        <Region layout={{ position: 'absolute', left: 287, top: 64, width: 176, height: 154, flexDirection: 'column', gap: 5 }}>
                            <ThemeText
                                text={t('inventory.empty.title')}
                                textStyle="il_heading_2"
                                textOptions={{ fill: '#dd0000', wordWrap: true, wordWrapWidth: 172 }}
                                verticalAlign="top"
                                layout={{ width: 176, flexShrink: 0 }}
                            />
                            <ThemeText
                                text={t('inventory.empty.desc')}
                                textStyle="u_regular"
                                textOptions={{ wordWrap: true, wordWrapWidth: 172 }}
                                verticalAlign="top"
                                layout={{ width: 176, flexShrink: 0 }}
                            />
                        </Region>
                        <Button
                            variant="3"
                            textStyle="button_shiny_regular"
                            onPointerTap={() => showWindow('catalog')}
                            layout={{ position: 'absolute', left: 241, width: 149, bottom: 2, height: 51 }}
                        >
                            {t('inventory.open.catalog')}
                        </Button>
                    </Region>
                )}
                {furniLoading && (
                    <ThemeImage
                        src={LayoutImage('inventory/inventory_download_icon.png')}
                        bitmap={{ stretchedX: false, stretchedY: false, pivot: 'center' }}
                        layout={{ position: 'absolute', left: 6, top: 27, width: 264, bottom: 6 }}
                    />
                )}
                <Region layout={{ position: 'absolute', left: 5, top: 35, width: 468, height: 261 }}>
                    {(activeTab === 'furni') && <InventoryFurniView />}
                    {(activeTab === 'collectibles') && <InventoryCollectiblesView />}
                    {(activeTab === 'pets') && <InventoryPetsView />}
                    {(activeTab === 'badges') && <InventoryBadgesView />}
                    {(activeTab === 'bots') && <InventoryBotsView />}
                </Region>
            </Region>
            <InventoryTradingDock
                activeTab={activeTab}
                top={TOP_CONTENT_HEIGHT}
            />
        </Frame>
    );
};
