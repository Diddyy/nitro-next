/**
 * `PromoArticleWidget` and `CommunityGoalWidget` (with its `communitygoalvsmode` and
 * `communitygoalvsmodevote` subclasses) as a slot draws them - but only their data, not their
 * windows. Their `promo_article`, `community_goal` and `community_goal_voting` layouts are not
 * ported: the article carousel and its links, the goal's meter, prize and voting controls are
 * missing, and what is here is a plain panel of the packet's text. A hotel only sees these when a
 * slot's `.widget` variable (or a scheduled code's) names them.
 */
import { useSystemStore, useTranslation } from '#base/context/system';
import { Region, ThemeText } from '#base/theme';

export const HotelViewPromoArticleWidget = ({ width }: { width: number }) => {
    const article = useSystemStore(x => x.hotelViewPromoArticles[0]);

    if (!article) return null;

    return (
        <Region
            backgroundColor="#f4f1df"
            layout={{ width, height: 75 }}
        >
            <ThemeText
                text={article.title}
                textStyle="u_bold"
                layout={{ position: 'absolute', left: 8, top: 6, width: width - 16, height: 22 }}
            />
            <ThemeText
                text={article.bodyText}
                textStyle="u_regular"
                layout={{ position: 'absolute', left: 8, top: 29, width: width - 16, height: 40 }}
                clip
            />
        </Region>
    );
};

export const HotelViewCommunityGoalWidget = ({ width }: { width: number }) => {
    const goal = useSystemStore(x => x.hotelViewCommunityGoal);
    const t = useTranslation();

    if (!goal || goal.hasGoalExpired) return null;

    return (
        <Region
            backgroundColor="#f4f1df"
            layout={{ width, height: 128 }}
        >
            <ThemeText
                text={t(`landing.view.community.headline.${goal.goalCode}`)}
                textStyle="u_bold"
                layout={{ position: 'absolute', left: 12, top: 8, width: width - 24, height: 22 }}
            />
            <ThemeText
                text={t(`landing.view.community.caption.${goal.goalCode}`)}
                textStyle="u_regular"
                layout={{ position: 'absolute', left: 12, top: 34, width: width - 24, height: 20 }}
            />
            <ThemeText
                // `CommunityGoalWidget`: `setCampaignLocalization("community_total_status", "landing.view.community.meter")`.
                text={t(`landing.view.community.meter.${goal.goalCode}`, '', { totalAmount: String(goal.communityTotalScore) })}
                textStyle="u_regular"
                layout={{ position: 'absolute', left: 12, top: 58, width: width - 24, height: 22 }}
            />
            <Region
                backgroundColor="#80b82c"
                layout={{ position: 'absolute', left: 12, top: 90, width: Math.round((width - 24) * Math.max(0, Math.min(100, goal.percentCompletionTowardsNextLevel)) / 100), height: 14 }}
            />
        </Region>
    );
};
