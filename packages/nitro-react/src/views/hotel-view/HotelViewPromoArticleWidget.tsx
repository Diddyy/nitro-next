/**
 * `PromoArticleWidget` as a slot draws it - but only its data, not its window. Its `promo_article`
 * layout is not ported: the article carousel, its picture and its links are missing, and what is
 * here is a plain panel of the first article's text. A hotel only sees this when a slot's `.widget`
 * variable (or a scheduled code's) names it.
 */
import { useSystemStore } from '#base/context/system';
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
