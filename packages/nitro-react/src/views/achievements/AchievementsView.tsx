/**
 * Pixi achievement browser, porting AS3 `AchievementController` and the `Achievements`,
 * `AchievementCategory` and `Achievement` layouts of `habbo-quest-engine-com`. The sections are
 * stacked by `moveAllChildrenToColumn(content, 0, 4)` and the frame is `lowest point + 45` high,
 * as `refresh` leaves it; every number below is a layout attribute or a controller constant.
 */
import { useState } from 'react';

import { pickAchievement, pickAchievementCategory } from '#base/commands';
import type { AchievementCategory } from '#base/context/achievements';
import {
    achievedBadgeCode, achievementProgress, achievementVisibleInCategory, categoryProgress, categoryVisibleInList, firstLevelAchieved,
    selectedAchievement, totalProgress, useAchievementsActions, useAchievementsStore,
} from '#base/context/achievements';
import { useWebSocketContext } from '#base/context/communication';
import { useConfigValue, useSystemStore, useTranslation } from '#base/context/system';
import { useWiredStore } from '#base/context/wired';
import { useViewportSize } from '#base/hooks';
import { Border, Box, Frame, LayoutImage, Region, ThemeImage, ThemeText } from '#base/theme';
import { getBadgeDesc, getBadgeName } from '#base/utils';
import { CatalogCurrencyIcon } from '#base/views/catalog/CatalogCurrencyIcon';

import { AchievementProgressBar } from './AchievementProgressBar';

// `AchievementController` constants.
const CATEGORIES_COLUMN_COUNT = 3;
const CATEGORY_SPACING_X = 8;
const CATEGORY_SPACING_Y = 5;
const CATEGORY_SPACING_TOP = 6;
const CATEGORY_ROWS_MAX = 3;
const ACHIEVEMENT_ROWS_MIN = 2;
const ACHIEVEMENT_ROWS_MAX = 4;
const ACHIEVEMENT_COLUMNS = 6;
const ACHIEVEMENT_TOP_SPACING = 3;
const UNSEEN_TINT = '#c4ff7f';
// Layout sizes.
const WINDOW_WIDTH = 389;
const CATEGORY_WIDTH = 112;
const CATEGORY_HEIGHT = 105;
const ACHIEVEMENT_WIDTH = 62;
const ACHIEVEMENT_HEIGHT = 60;
const LIST_HEIGHT_MAX = 245;
const HEADER_HEIGHT = 75;
const FOOTER_HEIGHT = 37;
const DETAILS_HEIGHT = 129;
const COLUMN_SPACING = 4;

type Slot = { kind: 'category'; category: AchievementCategory } | { kind: 'placeholder' } | { kind: 'hole' };

/** `refreshCategoryList`: entries are keyed by their index in the whole list, hidden categories leave a gap. */
const categorySlots = (categories: AchievementCategory[]): Slot[] => {
    const slots: Slot[] = categories.map(category => categoryVisibleInList(category) ? { kind: 'category', category } : { kind: 'hole' });

    // Empty tiles follow until a fourth row would start.
    while (Math.floor(slots.length / CATEGORIES_COLUMN_COUNT) < CATEGORY_ROWS_MAX) slots.push({ kind: 'placeholder' });

    return slots;
};

/** `moveAllChildrenToColumn`: visible sections with a height stack with a gap of 4; `lowest` is the bottom of the lowest. */
const stackColumn = (sections: { visible: boolean; height: number }[]) => {
    let top = 0;
    let lowest = 0;
    const tops = sections.map(({ visible, height }) => {
        if (!visible || height <= 0) return 0;

        const at = top;

        top += height + COLUMN_SPACING;
        lowest = Math.max(lowest, at + height);

        return at;
    });

    return { tops, lowest };
};

export const AchievementsView = ({ onClose }: { onClose: () => void }) => {
    const t = useTranslation();
    const questingLibrary = useConfigValue<string>('image.library.questing.url') ?? '';
    const badgeUrl = useConfigValue<string>('badge.asset.url') ?? '';
    const badgeLimits = useSystemStore(x => x.badgePointLimits);
    const categories = useAchievementsStore(x => x.categories);
    const categoryCode = useAchievementsStore(x => x.category);
    const selected = useAchievementsStore(selectedAchievement);
    const unseen = useAchievementsStore(x => x.unseen);
    const score = useAchievementsStore(x => x.score);
    const roomCodes = useWiredStore(x => x.wiredAchievements);
    const { back } = useAchievementsActions();
    const { send } = useWebSocketContext();
    const viewport = useViewportSize();
    const [ hover, setHover ] = useState(-999);
    const category = categories?.find(entry => entry.code === categoryCode);

    // `getAchievementCategoryName`: the key is its own fallback.
    const categoryName = (code: string) => t(`quests.${code}.name`, `quests.${code}.name`);
    const questing = (file: string) => `${questingLibrary}${file}`;
    const badgeImage = (code: string) => badgeUrl.replace('%badgename%', code);

    // The visible sections in layout order and their heights.
    const slots = categories && !category ? categorySlots(categories) : [];
    // `getLowestPoint`: the last tile that exists, not a gap.
    const lastSlot = slots.findLastIndex(slot => slot.kind !== 'hole');
    const categoriesHeight = lastSlot >= 0 ? Math.floor(lastSlot / CATEGORIES_COLUMN_COUNT) * (CATEGORY_HEIGHT + CATEGORY_SPACING_Y) + CATEGORY_SPACING_TOP + CATEGORY_HEIGHT : 0;
    const visibleAchievements = category ? category.achievements.filter(entry => achievementVisibleInCategory(category.code, entry, roomCodes)) : [];
    const scrolling = !!category && category.achievements.length > ACHIEVEMENT_ROWS_MAX * ACHIEVEMENT_COLUMNS;
    const columns = scrolling ? ACHIEVEMENT_COLUMNS - 1 : ACHIEVEMENT_COLUMNS;
    const achievementSlots = category ? Math.max(visibleAchievements.length, ACHIEVEMENT_ROWS_MIN * columns) : 0;
    const contentHeight = Math.ceil(achievementSlots / columns) * ACHIEVEMENT_HEIGHT + ACHIEVEMENT_TOP_SPACING;
    const listHeight = Math.min(LIST_HEIGHT_MAX, contentHeight + 1);
    const tiles: (typeof visibleAchievements[number] | undefined)[] = Array.from({ length: achievementSlots }, (_, index) => visibleAchievements[index]);
    // `moveAllChildrenToColumn(content, 0, 4)` and `getLowestPoint(content)`.
    const column = stackColumn([
        { visible: !!categories && !category, height: categoriesHeight },
        { visible: !!categories && !category, height: FOOTER_HEIGHT },
        { visible: !!category, height: HEADER_HEIGHT },
        { visible: !!category, height: listHeight },
        { visible: !!category && !!selected, height: DETAILS_HEIGHT },
    ]);
    const [ categoriesTop, footerTop, headerTop, listTop, detailsTop ] = column.tops;
    const lowest = column.lowest;
    const total = categories ? totalProgress(categories) : { progress: 0, max: 0 };
    const levels = selected && achievementProgress(selected);
    const achievedCode = selected && achievedBadgeCode(selected);

    return (
        <Frame
            id="achievements"
            variant="3"
            caption={t('inventory.achievements')}
            tintColor="#418db0"
            dropShadow={{ distance: 4, alpha: 0.35, blur: 4 }}
            onClose={onClose}
            resizeDirection="none"
            margins={[ 0, 33, 0, 3 ]}
            // `_window.center(); _window.y = 20`.
            defaultPosition={{ x: Math.round((viewport.width - WINDOW_WIDTH) / 2), y: 20 }}
            layout={{ width: WINDOW_WIDTH, height: (categories ? lowest : 0) + 45 }}
        >
            {!categories && (
                <ThemeText
                    text={t('generic.loading', 'Loading')}
                    textOptions={{ fontFamily: 'Ubuntu', fontSize: 13 }}
                    layout={{ position: 'absolute', left: 19, top: 10 }}
                />
            )}
            {categories && !category && (
                <>
                    <Region layout={{ position: 'absolute', left: 19, top: categoriesTop, width: 371, height: categoriesHeight }}>
                        {slots.map((slot, index) => {
                            if (slot.kind === 'hole') return null;

                            const left = (CATEGORY_WIDTH + CATEGORY_SPACING_X) * (index % CATEGORIES_COLUMN_COUNT);
                            const tileTop = (CATEGORY_HEIGHT + CATEGORY_SPACING_Y) * Math.floor(index / CATEGORIES_COLUMN_COUNT) + CATEGORY_SPACING_TOP;

                            if (slot.kind === 'placeholder') {
                                return (
                                    <ThemeImage
                                        key={`empty-${index}`}
                                        src={questing('achievement_category_bkg_empty_3.png')}
                                        bitmap={{}}
                                        layout={{ position: 'absolute', left, top: tileTop + 1, width: 110, height: 103 }}
                                    />
                                );
                            }

                            const entry = slot.category;
                            const hovered = hover === index;
                            const { progress, max } = categoryProgress(entry);
                            const count = unseen.filter(item => item.category === entry.code).length;
                            const inset = hovered ? 0 : 1;

                            return (
                                <Region
                                    key={entry.code}
                                    layout={{ position: 'absolute', left, top: tileTop, width: CATEGORY_WIDTH, height: CATEGORY_HEIGHT }}
                                >
                                    <ThemeImage
                                        src={questing(hovered ? 'achievement_background_active_2.png' : 'achievement_background_active_1.png')}
                                        bitmap={{}}
                                        layout={{ position: 'absolute', left: 0, top: 0, width: CATEGORY_WIDTH, height: CATEGORY_HEIGHT }}
                                    />
                                    <Region layout={{ position: 'absolute', left: inset, top: inset, width: 115, height: 104 }}>
                                        <ThemeText
                                            text={categoryName(entry.code)}
                                            textOptions={{ fontFamily: 'Ubuntu', fontSize: 12, align: 'center' }}
                                            flashFormat={{ bold: true, antiAliasType: 'advanced' }}
                                            verticalAlign="top"
                                            layout={{ position: 'absolute', left: -2, width: 115, top: 7 }}
                                        />
                                        <ThemeImage
                                            src={questing(`ach_category_${entry.code}.png`)}
                                            bitmap={{ stretchedX: false, stretchedY: false, pivot: 'center' }}
                                            layout={{ position: 'absolute', left: 12, top: 27, width: 86, height: 72 }}
                                        />
                                        <ThemeText
                                            text={`${progress}/${max}`}
                                            textOptions={{ fill: '#ffffff', fontFamily: 'Ubuntu', fontSize: 12, align: 'center' }}
                                            flashFormat={{ bold: true, antiAliasType: 'advanced' }}
                                            verticalAlign="top"
                                            layout={{ position: 'absolute', left: -2.5, width: 115, top: 70 }}
                                        />
                                    </Region>
                                    <Region
                                        cursor="pointer"
                                        onPointerOver={() => setHover(index)}
                                        onPointerOut={() => setHover(-999)}
                                        onPointerTap={() => pickAchievementCategory(send, entry.code)}
                                        layout={{ position: 'absolute', left: 0, top: 0, width: 110, height: 103 }}
                                    />
                                    {count > 0 && (
                                        <Border
                                            variant="7"
                                            tintColor="#de4537"
                                            layout={{ position: 'absolute', left: 71, top: 27, height: 20, minWidth: 18 }}
                                        >
                                            <ThemeText
                                                text={String(count)}
                                                textStyle="u_bold"
                                                textOptions={{ fill: '#ffffff' }}
                                                layout={{ marginLeft: 3, marginTop: 1, marginRight: 5, marginBottom: 2 }}
                                            />
                                        </Border>
                                    )}
                                </Region>
                            );
                        })}
                    </Region>
                    <Region layout={{ position: 'absolute', left: 0, top: footerTop, width: WINDOW_WIDTH, height: FOOTER_HEIGHT }}>
                        <AchievementProgressBar
                            x={72}
                            y={1}
                            width={246}
                            current={total.progress}
                            max={total.max}
                            levelKey={0}
                            scoreAtStartOfLevel={0}
                            caption={(progress, limit) => t('achievements.categories.totalprogress', undefined, { progress: String(progress), limit: String(limit) })}
                        />
                        <ThemeText
                            text={t('achievements.categories.score', undefined, { score: String(score) })}
                            textOptions={{ fill: '#444444', fontFamily: 'Ubuntu', fontSize: 13, align: 'center' }}
                            flashFormat={{ bold: true, antiAliasType: 'advanced' }}
                            verticalAlign="top"
                            layout={{ position: 'absolute', left: 5, width: 379, top: 23 }}
                        />
                    </Region>
                </>
            )}
            {category && (
                <>
                    <Region layout={{ position: 'absolute', left: 0, top: headerTop, width: WINDOW_WIDTH, height: HEADER_HEIGHT }}>
                        <Region
                            backgroundColor="#8899a2"
                            layout={{ position: 'absolute', left: 1, top: 0, width: 387, height: HEADER_HEIGHT }}
                        />
                        <Region
                            backgroundColor="#000000"
                            layout={{ position: 'absolute', left: 0, top: 74, width: 387, height: 1 }}
                        />
                        <ThemeImage
                            src={questing(`achicon_${category.code}.png`)}
                            bitmap={{ stretchedX: false, stretchedY: false, pivot: 'center' }}
                            layout={{ position: 'absolute', left: 297, top: 3, width: 84, height: 72 }}
                        />
                        <ThemeText
                            text={categoryName(category.code)}
                            textOptions={{ fill: '#ffffff', fontFamily: 'Ubuntu', fontSize: 20 }}
                            flashFormat={{ bold: true, antiAliasType: 'advanced' }}
                            markup
                            clip
                            verticalAlign="top"
                            layout={{ position: 'absolute', left: 78, top: 13, width: 286, height: 24 }}
                        />
                        <ThemeText
                            text={t('achievements.details.categoryprogress', undefined, { progress: String(categoryProgress(category).progress), limit: String(categoryProgress(category).max) })}
                            textOptions={{ fill: '#ffffff', fontFamily: 'Ubuntu', fontSize: 13 }}
                            flashFormat={{ bold: true, antiAliasType: 'advanced' }}
                            clip
                            verticalAlign="top"
                            layout={{ position: 'absolute', left: 78, top: 40, width: 245, height: 24 }}
                        />
                        <Region
                            cursor="pointer"
                            onPointerTap={back}
                            layout={{ position: 'absolute', left: 14, top: 21, width: 33, height: 34 }}
                        >
                            <ThemeImage
                                src={LayoutImage('shared/icons_back.png')}
                                bitmap={{ fitSizeToContents: true }}
                                layout={{ position: 'absolute', left: 0, top: 0 }}
                            />
                        </Region>
                    </Region>
                    <Region layout={{ position: 'absolute', left: 10, top: listTop, width: 367, height: listHeight }}>
                        {tiles.map((entry, index) => {
                            const left = (ACHIEVEMENT_WIDTH + (scrolling ? 5 : 0)) * (index % columns);
                            const tileTop = ACHIEVEMENT_HEIGHT * Math.floor(index / columns) + ACHIEVEMENT_TOP_SPACING;

                            if (!entry) {
                                return (
                                    <ThemeImage
                                        key={`empty-${index}`}
                                        src={questing('achievement_inactive.png')}
                                        bitmap={{}}
                                        layout={{ position: 'absolute', left, top: tileTop, width: ACHIEVEMENT_WIDTH, height: ACHIEVEMENT_HEIGHT }}
                                    />
                                );
                            }

                            const isSelected = entry.achievementId === selected?.achievementId;

                            return (
                                <Region
                                    key={entry.achievementId}
                                    layout={{ position: 'absolute', left, top: tileTop, width: ACHIEVEMENT_WIDTH, height: ACHIEVEMENT_HEIGHT }}
                                >
                                    <ThemeImage
                                        src={questing(isSelected ? 'achievement_active.png' : 'achievement_inactive.png')}
                                        tint={!isSelected && unseen.some(item => item.achievementId === entry.achievementId) ? UNSEEN_TINT : '#ffffff'}
                                        bitmap={{}}
                                        layout={{ position: 'absolute', left: 0, top: 0, width: ACHIEVEMENT_WIDTH, height: ACHIEVEMENT_HEIGHT }}
                                    />
                                    <ThemeImage
                                        src={badgeImage(achievedBadgeCode(entry))}
                                        greyscale={!firstLevelAchieved(entry)}
                                        bitmap={{ stretchedX: false, stretchedY: false, pivot: 'center' }}
                                        layout={{ position: 'absolute', left: 11, top: 10, width: 40, height: 40 }}
                                    />
                                    <Region
                                        cursor="pointer"
                                        onPointerTap={() => pickAchievement(send, entry.achievementId)}
                                        layout={{ position: 'absolute', left: 0, top: 0, width: ACHIEVEMENT_WIDTH, height: ACHIEVEMENT_HEIGHT }}
                                    />
                                </Region>
                            );
                        })}
                    </Region>
                    {selected && levels && achievedCode && (
                        <Border
                            variant="0"
                            tintColor="#cccccc"
                            layout={{ position: 'absolute', left: 15, top: detailsTop, width: 360, height: DETAILS_HEIGHT }}
                        >
                            <ThemeText
                                text={getBadgeName(t, achievedCode)}
                                textOptions={{ fontFamily: 'Ubuntu', fontSize: 12 }}
                                flashFormat={{ bold: true, antiAliasType: 'advanced' }}
                                markup
                                clip
                                verticalAlign="top"
                                layout={{ position: 'absolute', left: 114, top: 18, width: 238, height: 17 }}
                            />
                            <ThemeImage
                                src={badgeImage(achievedCode)}
                                greyscale={!firstLevelAchieved(selected)}
                                bitmap={{ stretchedX: false, stretchedY: false, pivot: 'center', zoomX: 2, zoomY: 2 }}
                                layout={{ position: 'absolute', left: 10, top: 12, width: 85, height: 85 }}
                            />
                            <ThemeText
                                text={getBadgeDesc(t, achievedCode, badgeLimits)}
                                textOptions={{ fontFamily: 'Ubuntu', fontSize: 12, wordWrap: true, wordWrapWidth: 234 }}
                                flashFormat={{ antiAliasType: 'advanced' }}
                                markup
                                clip
                                verticalAlign="top"
                                layout={{ position: 'absolute', left: 114, top: 34, width: 238, height: 47 }}
                            />
                            {/* `refreshReward`: hidden on the final level, for a negative type or fewer than one point; the three move to one row at the caption's x with a gap of 3. */}
                            {!selected.finalLevel && selected.levelRewardPointType >= 0 && selected.levelRewardPoints >= 1 && (
                                <Box layout={{ position: 'absolute', left: 113, top: 70, flexDirection: 'row', gap: 3 }}>
                                    <ThemeText
                                        text={t('achievements.details.reward')}
                                        textOptions={{ fontFamily: 'Ubuntu', fontSize: 12 }}
                                        flashFormat={{ antiAliasType: 'advanced' }}
                                        verticalAlign="top"
                                        layout={{ marginTop: 4 }}
                                    />
                                    <ThemeText
                                        text={String(selected.levelRewardPoints)}
                                        textOptions={{ fontFamily: 'Ubuntu', fontSize: 12 }}
                                        flashFormat={{ bold: true, antiAliasType: 'advanced' }}
                                        verticalAlign="top"
                                        layout={{ marginTop: 4 }}
                                    />
                                    <CatalogCurrencyIcon
                                        type={selected.levelRewardPointType}
                                        big
                                        layout={{ width: 23, height: 26 }}
                                    />
                                </Box>
                            )}
                            <ThemeText
                                text={t('achievements.details.level', undefined, { level: String(levels.earned), limit: String(selected.levelCount) })}
                                textOptions={{ fontFamily: 'Ubuntu', fontSize: 12, align: 'center' }}
                                flashFormat={{ bold: true, antiAliasType: 'advanced' }}
                                verticalAlign="top"
                                layout={{ position: 'absolute', left: 4, top: 97, width: 95 }}
                            />
                            {selected.displayMethod !== 1 && !selected.finalLevel && (
                                <AchievementProgressBar
                                    x={115}
                                    y={93}
                                    width={180}
                                    current={levels.current}
                                    max={levels.limit}
                                    levelKey={selected.achievementId * 10000 + selected.level}
                                    scoreAtStartOfLevel={selected.scoreAtStartOfLevel}
                                    caption={(progress, limit) => t('achievements.details.progress', undefined, { progress: String(progress), limit: String(limit) })}
                                />
                            )}
                        </Border>
                    )}
                </>
            )}
        </Frame>
    );
};
