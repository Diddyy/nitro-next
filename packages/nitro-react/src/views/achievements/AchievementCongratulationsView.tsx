/** AS3 AchievementLevelUp: server-gated congratulations with the awarded badge and reward type. */
import type { IAchievementLevelUpData } from '@nitrodevco/nitro-packets';

import { useConfigValue, useSystemStore, useTranslation } from '#base/context/system';
import { Box, Button, Frame, ThemeImage, ThemeText } from '#base/theme';
import { getBadgeDesc, getBadgeName } from '#base/utils';
import { CatalogCurrencyIcon } from '#base/views/catalog/CatalogCurrencyIcon';

export const AchievementCongratulationsView = ({ data, onClose }: { data: IAchievementLevelUpData; onClose: () => void }) => {
    const t = useTranslation();
    const badgeLimits = useSystemStore(x => x.badgePointLimits);
    const badgeUrl = (useConfigValue<string>('badge.asset.url') ?? '');

    return (
        <Frame
            id="achievement_congratulations"
            variant="3"
            caption={t('achievements.levelup.title', 'Congratulations!', { category: t(`quests.${data.category}.name`) })}
            onClose={onClose}
            layout={{ width: 360, height: 260 }}
        >
            <Box layout={{ flexDirection: 'column', alignItems: 'center', padding: 12, gap: 10 }}>
                <ThemeImage
                    src={badgeUrl.replace('%badgename%', data.badgeCode)}
                    bitmap={{ stretchedX: false, stretchedY: false, pivot: 'center' }}
                    layout={{ width: 70, height: 70 }}
                />
                <ThemeText
                    text={getBadgeName(t, data.badgeCode)}
                    textStyle="u_bold"
                />
                <ThemeText
                    text={getBadgeDesc(t, data.badgeCode, badgeLimits)}
                    textStyle="u_regular"
                    layout={{ width: 320 }}
                />
                {data.levelRewardPoints > 0 && data.levelRewardPointType >= 0 && (
                    <Box layout={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <ThemeText
                            text={`${t('achievements.details.reward')} ${data.levelRewardPoints}`}
                            textStyle="u_regular"
                        />
                        <CatalogCurrencyIcon
                            type={data.levelRewardPointType}
                            big
                            layout={{ width: 22, height: 22 }}
                        />
                    </Box>
                )}
                <Button onPointerTap={onClose}>{t('generic.ok')}</Button>
            </Box>
        </Frame>
    );
};
