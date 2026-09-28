import { StringDataType } from '@nitrodevco/nitro-api';
import { useEffect, useState } from 'react';

import { requestInventoryBadgesIfEmpty } from '#base/commands';
import { CatalogWidgetEventEnum } from '#base/context/catalog';
import { useWebSocketContext } from '#base/context/communication';
import { useInventoryStore } from '#base/context/inventory';
import { useConfigValue, useSystemStore, useTranslation } from '#base/context/system';
import { useCatalogWidgetEvent } from '#base/hooks';
import { Border, InfiniteGrid, LayoutImage, Region, TextInput, ThemeImage, ThemeText, useTextureFromUrl } from '#base/theme';
import { getBadgeDesc, getBadgeName } from '#base/utils';

import { CatalogWidgetProps } from '../CatalogPageRegistry';

/** `MAX_SEARCH_STRING_LENGTH`, which is also `search_input`'s `max_chars`. */
const MAX_SEARCH_STRING_LENGTH = 40;

type Translate = (key: string, defaultValue?: string, replacements?: Record<string, string>) => string;

/** `buildBadgeSearchText`: the code, `getBadgeName` and `getBadgeDesc`, lower-cased. */
const getBadgeSearchText = (t: Translate, code: string, pointLimits: Record<string, number>): string => `${code} ${getBadgeName(t, code)} ${getBadgeDesc(t, code, pointLimits)}`.toLowerCase();

/** `getPreviewerStuffData`: the string array stuff data a badge display furni is previewed and bought with. */
const getPreviewerStuffData = (badgeCode: string) => {
    const stuffData = new StringDataType();

    stuffData.setValue([ '0', badgeCode, '', '' ]);

    return stuffData;
};

interface BadgeGridItemProps {
    badgeCode: string;
    selected: boolean;
    onSelect: () => void;
}

/**
 * `badgeGridItem.xml`: a 44x44 region, the `bg` border (style 2, style 0 while selected -
 * `setBadgeGridItemSelectionBg`) and the `badge_image` widget (2,2, 40x40) drawing the badge
 * centred and unscaled.
 */
const BadgeGridItem = ({ badgeCode, selected, onSelect }: BadgeGridItemProps) => {
    const badgeUrl = useConfigValue<string>('badge.asset.url') ?? '';
    const texture = useTextureFromUrl(badgeUrl.replace('%badgename%', badgeCode));

    return (
        <Region
            name="badgeGridItem"
            cursor="pointer"
            onPointerTap={onSelect}
            layout={{ width: 44, height: 44, flexShrink: 0 }}
        >
            <Border
                variant={selected ? '0' : '2'}
                name="bg"
                layout={{ position: 'absolute', left: 0, width: 44, top: 0, height: 44 }}
            >
                <Region
                    name="badgeWidget"
                    layout={{ position: 'absolute', left: 2, width: 40, top: 2, height: 40, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' }}
                >
                    {texture && (
                        <pixiSprite
                            texture={texture}
                            layout={{ width: texture.width, height: texture.height }}
                        />
                    )}
                </Region>
            </Border>
        </Region>
    );
};

/**
 * The badge display page's badge picker, Flash's `UserBadgeSelectorCatalogWidget` - drawn from the
 * `userBadgeSelectorWidget` container's own children in `layout_badge_display` (255 wide, stretched
 * with the page): the `search_input_border` (style 105, 26 high) with the `search_input` field, the
 * `search_placeholder` text over it and the `cancel_search_btn` cross, and the `badgeGrid` under it
 * (`scrollable_itemgrid_vertical` style 3, `badgeGridItem`s 1px apart).
 *
 * The grid lists the badges the user owns (`HabboInventory.getAllMyBadgeIds`) minus the hotel's
 * `badge.display.excluded.badgeCodes`; the first time the inventory has none it asks the server
 * for them (`requestInventoryBadgesIfEmpty`), and a new list (`BadgesEvent`,
 * `onUserBadgesUpdated`) refreshes the grid, keeping the picked badge while the user still owns it.
 * The search keeps the badges whose code, name or description (lowercased, `buildBadgeSearchText`)
 * contains the typed text, 40 characters at most; the placeholder shows while the field is empty
 * and the cross while it is not, and Escape or the cross clears it. A search that hides the picked
 * badge unpicks it, telling the page (an empty extra parameter and preview stuff data).
 *
 * Picking a badge (`setSelectedBadgeByIndex`) makes its code the purchase's extra parameter
 * (`SetExtraPurchaseParameterEvent`) and the preview's stuff data (`SetRoomPreviewerStuffDataEvent`,
 * `["0", code, "", ""]`). `WIDGETS_INITIALIZED` tells the purchase widget a badge is needed before
 * anything can be bought (`CWE_EXTRA_PARAM_REQUIRED_FOR_BUY`) and selects the page's first offer.
 */
export const CatalogUserBadgeSelectorWidgetView = ({ page }: CatalogWidgetProps) => {
    const [ searchText, setSearchText ] = useState('');
    const [ searchFocused, setSearchFocused ] = useState(false);
    const [ selectedBadge, setSelectedBadge ] = useState<string | undefined>(undefined);
    const excludedBadges = useConfigValue<string>('badge.display.excluded.badgeCodes') ?? '';
    const badgeCodes = useInventoryStore(x => x.badgeCodes);
    const { send } = useWebSocketContext();
    const t = useTranslation();
    const badgePointLimits = useSystemStore(x => x.badgePointLimits);

    // `refreshBadgeData`: the owned badges but the excluded ones; a picked badge the user no longer owns is dropped quietly.
    const excluded = excludedBadges.split(',');
    const ownedBadges = badgeCodes.filter(code => !excluded.includes(code));

    if ((selectedBadge !== undefined) && !ownedBadges.includes(selectedBadge)) setSelectedBadge(undefined);

    const currentBadge = ((selectedBadge !== undefined) && ownedBadges.includes(selectedBadge)) ? selectedBadge : undefined;
    const search = searchText.toLowerCase();
    const filteredBadges = (search === '') ? ownedBadges : ownedBadges.filter(code => getBadgeSearchText(t, code, badgePointLimits).includes(search));

    const dispatchBadge = (code: string) => {
        page.events.dispatchEvent({ type: CatalogWidgetEventEnum.SET_EXTRA_PARAMETER, parameter: code });
        page.dispatchWidgetEvent({ type: CatalogWidgetEventEnum.SET_PREVIEWER_STUFFDATA, stuffData: getPreviewerStuffData(code) });
    };

    /** `applyBadgeFilter`: a picked badge the search no longer shows is unpicked (`clearSelectedBadge`). */
    const applySearch = (text: string) => {
        const value = text.substring(0, MAX_SEARCH_STRING_LENGTH);
        const next = value.toLowerCase();

        setSearchText(value);

        if ((currentBadge === undefined) || (next === '') || getBadgeSearchText(t, currentBadge, badgePointLimits).includes(next)) return;

        setSelectedBadge(undefined);
        dispatchBadge('');
    };

    const selectBadge = (code: string) => {
        setSelectedBadge(code);
        dispatchBadge(code);
    };

    useCatalogWidgetEvent(page, CatalogWidgetEventEnum.WIDGETS_INITIALIZED, () => {
        if (!page.offers.length) return;

        page.events.dispatchEvent({ type: CatalogWidgetEventEnum.EXTRA_PARAM_REQUIRED_FOR_BUY });
        page.events.dispatchEvent({ type: CatalogWidgetEventEnum.SELECT_PRODUCT, offer: page.offers[0] });
    });

    // `init()` -> `refreshBadgeData` -> `getAllMyBadgeIds`, which asks for the list the first time it finds none.
    useEffect(() => {
        requestInventoryBadgesIfEmpty(send);
    }, []);

    const hasSearch = (searchText.length > 0);

    return (
        <Region layout={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 }}>
            <Border
                variant="105"
                name="search_input_border"
                layout={{ position: 'absolute', left: 0, right: 0, top: 0, height: 26 }}
            >
                <TextInput
                    value={searchText}
                    onChange={applySearch}
                    onKeyDown={(event) => {
                        if (event.key !== 'Escape') return;

                        applySearch('');

                        return true;
                    }}
                    focused={searchFocused}
                    onFocusChange={setSearchFocused}
                    maxLength={MAX_SEARCH_STRING_LENGTH}
                    textStyle="u_regular"
                    flashPlacement
                    alwaysShowSelection
                    backgroundColor={null}
                    focusedBackgroundColor={null}
                    layout={{ position: 'absolute', left: 6, width: 171, top: 3, height: 19 }}
                />
                {!hasSearch && (
                    <Region
                        name="search_placeholder"
                        alpha={0.5}
                        onPointerTap={() => setSearchFocused(true)}
                        layout={{ position: 'absolute', left: 6, top: 3, paddingTop: 1 }}
                    >
                        <ThemeText
                            text={t('generic.search')}
                            textStyle="u_regular"
                            textOptions={{ fill: '#666666' }}
                            verticalAlign="top"
                        />
                    </Region>
                )}
                {hasSearch && (
                    <Region
                        name="cancel_search_btn"
                        cursor="pointer"
                        onPointerTap={() => applySearch('')}
                        layout={{ position: 'absolute', left: 232, width: 19, top: 3, height: 19 }}
                    >
                        <ThemeImage
                            src={LayoutImage('shared/icons_close.png')}
                            bitmap={{ stretchedX: false, stretchedY: false, fitSizeToContents: true }}
                            layout={{ position: 'absolute', left: 5, top: 4 }}
                        />
                    </Region>
                )}
            </Border>
            <Region
                name="badgeGrid"
                layout={{ position: 'absolute', left: 0, right: 0, top: 30, bottom: 0, flexDirection: 'column' }}
            >
                <InfiniteGrid
                    items={filteredBadges}
                    itemGrid={{ width: 44, height: 44, spacing: 1 }}
                    getKey={code => code}
                    itemRender={code => (
                        <BadgeGridItem
                            badgeCode={code}
                            selected={code === currentBadge}
                            onSelect={() => selectBadge(code)}
                        />
                    )}
                />
            </Region>
        </Region>
    );
};
