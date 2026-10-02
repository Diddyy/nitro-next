/** Pixi achievement browser, porting AS3 AchievementController categories, tiles and details. */
import { achievedBadgeCode, achievementCategories, achievementProgress, achievementVisibleInRoom, useAchievementsActions, useAchievementsStore } from '#base/context/achievements';
import { useConfigValue, useSystemStore, useTranslation } from '#base/context/system';
import { useWiredStore } from '#base/context/wired';
import { Border, Box, Button, Frame, LayoutImage, Region, ScrollArea, ThemeImage, ThemeText } from '#base/theme';
import { getBadgeDesc, getBadgeName } from '#base/utils';
import { CatalogCurrencyIcon } from '#base/views/catalog/CatalogCurrencyIcon';

export const AchievementsView = ({ onClose }: { onClose: () => void }) => {
    const t = useTranslation();
    const badgeLimits = useSystemStore(x => x.badgePointLimits);
    const achievements = useAchievementsStore(x => x.achievements);
    const loaded = useAchievementsStore(x => x.loaded);
    const categoryCode = useAchievementsStore(x => x.category);
    const selectedId = useAchievementsStore(x => x.selectedId);
    const unseen = useAchievementsStore(x => x.unseen);
    const score = useAchievementsStore(x => x.score);
    const newCodes = (useConfigValue<string>('achievements.new') ?? '');
    const badgeUrl = (useConfigValue<string>('badge.asset.url') ?? '');
    const roomCodes = useWiredStore(x => x.wiredAchievements);
    const { selectCategory, selectAchievement } = useAchievementsActions();
    const categories = achievementCategories(achievements, newCodes.split(','));
    const category = categories.find(entry => entry.code === categoryCode) ?? categories[0];
    const visibleAchievements = category?.achievements.filter(entry => achievementVisibleInRoom(entry, roomCodes)) ?? [];
    const selected = visibleAchievements.find(entry => entry.achievementId === selectedId) ?? visibleAchievements[0];
    const progress = selected && achievementProgress(selected);

    return (
        <Frame
            id="achievements"
            variant="3"
            caption={t('inventory.achievements')}
            onClose={onClose}
            layout={{ width: 660, height: 460 }}
        >
            <Box layout={{ width: 640, height: 410, flexDirection: 'column', padding: 10, gap: 8 }}>
                <ThemeText
                    text={t('achievements.categories.totalprogress', undefined, { progress: String(achievements.reduce((total, entry) => total + achievementProgress(entry).earned, 0)), limit: String(achievements.reduce((total, entry) => total + entry.levelCount, 0)) })}
                    textStyle="u_bold"
                />
                <ThemeText
                    text={t('achievements.categories.score', undefined, { score: String(score) })}
                    textStyle="u_regular"
                />
                {!loaded && (
                    <ThemeText
                        text={t('generic.loading')}
                        textStyle="u_regular"
                    />
                )}
                <Box layout={{ width: 620, height: 325, flexDirection: 'row', gap: 10 }}>
                    <ScrollArea layout={{ width: 150, height: 320 }}>
                        <Box layout={{ flexDirection: 'column', gap: 4 }}>
                            {categories.filter(entry => entry.code !== 'new' && entry.code !== 'wired_games').map(entry => (
                                <Button
                                    key={entry.code}
                                    onPointerTap={() => {
                                        selectCategory(entry.code);
                                        const first = entry.achievements.find(achievement => achievementVisibleInRoom(achievement, roomCodes));

                                        if (first) selectAchievement(first.achievementId);
                                    }}
                                    layout={{ width: 145, height: 32 }}
                                >
                                    {`${t(`quests.${entry.code}.name`)}${unseen.some(id => entry.achievements.some(achievement => achievement.achievementId === id)) ? ' •' : ''}`}
                                </Button>
                            ))}
                        </Box>
                    </ScrollArea>
                    <Box layout={{ width: 450, height: 325, flexDirection: 'column', gap: 8 }}>
                        <ScrollArea layout={{ width: 450, height: 190 }}>
                            <Box layout={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5 }}>
                                {visibleAchievements.map(achievement => (
                                    <Region
                                        key={achievement.achievementId}
                                        onPointerTap={() => selectAchievement(achievement.achievementId)}
                                        layout={{ width: 66, height: 66 }}
                                    >
                                        <ThemeImage
                                            src={LayoutImage(`quest-engine/common_item_${selected?.achievementId === achievement.achievementId ? 'selected' : 'unselected'}.png`)}
                                            layout={{ position: 'absolute', width: 66, height: 66 }}
                                        />
                                        <ThemeImage
                                            src={badgeUrl.replace('%badgename%', achievedBadgeCode(achievement))}
                                            greyscale={achievementProgress(achievement).earned === 0}
                                            bitmap={{ stretchedX: false, stretchedY: false, pivot: 'center' }}
                                            layout={{ position: 'absolute', width: 66, height: 66 }}
                                        />
                                    </Region>
                                ))}
                            </Box>
                        </ScrollArea>
                        {selected && progress && (
                            <Box layout={{ flexDirection: 'column', gap: 6 }}>
                                <ThemeText
                                    text={getBadgeName(t, achievedBadgeCode(selected))}
                                    textStyle="u_bold"
                                />
                                <ThemeText
                                    text={getBadgeDesc(t, achievedBadgeCode(selected), badgeLimits)}
                                    textStyle="u_regular"
                                    layout={{ width: 440 }}
                                />
                                <ThemeText
                                    text={t('achievements.details.level', undefined, { level: String(progress.earned), limit: String(selected.levelCount) })}
                                    textStyle="u_regular"
                                />
                                {!selected.finalLevel && selected.levelRewardPoints > 0 && selected.levelRewardPointType >= 0 && (
                                    <Box layout={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                        <ThemeText
                                            text={`${t('achievements.details.reward')} ${selected.levelRewardPoints}`}
                                            textStyle="u_regular"
                                        />
                                        <CatalogCurrencyIcon
                                            type={selected.levelRewardPointType}
                                            big
                                            layout={{ width: 22, height: 22 }}
                                        />
                                    </Box>
                                )}
                                {selected.displayMethod !== 1 && !selected.finalLevel && (
                                    <Box layout={{ width: 430, height: 20 }}>
                                        <Border
                                            variant="3"
                                            tintColor="#b9b9b9"
                                            layout={{ position: 'absolute', width: 430, height: 20 }}
                                        />
                                        <Border
                                            variant="3"
                                            tintColor="#6ba34d"
                                            layout={{ position: 'absolute', width: 430 * Math.min(1, progress.current / progress.limit), height: 20 }}
                                        />
                                        <ThemeText
                                            text={t('achievements.details.progress', undefined, { progress: String(progress.current), limit: String(progress.limit) })}
                                            textStyle="u_bold"
                                            layout={{ position: 'absolute', left: 8, top: 2 }}
                                        />
                                    </Box>
                                )}
                                {selected.finalLevel && (
                                    <ThemeText
                                        text={t('achievements.details.completed', 'Completed')}
                                        textStyle="u_bold"
                                    />
                                )}
                            </Box>
                        )}
                    </Box>
                </Box>
            </Box>
        </Frame>
    );
};
