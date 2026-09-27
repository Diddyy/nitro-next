/**
 * `BonusRarePromoWidget`: `bonus_rare_promo` - the rare every so many credits spent buys, and how
 * far the user is from the next one (`BonusRareInfoMessage`, asked for by `registerHotelViewHandlers`).
 *
 * The widget keeps its place in the grid but is hidden until the server has named a rare
 * (`productClassId` -1 until then), and its texts and bar are only filled once the rare's product
 * data is known (`refreshContent`): the header names it and the credits per rare, the bar fills by
 * the credits already spent towards it (`setProgress` over `bar_a_bkg`'s 292), and the status says
 * how many are still to go. The picture is the hotel's `landing.view.bonus.rare.image.uri`.
 *
 * The button is Flash's `openCreditsHabblet`, which opens the hotel's web shop
 * (`web.shop.relativeUrl`) beside the client; the port has no hotel web page to open it under - see
 * `purchaseCredits` in `commands/targetedOfferCommands.ts` - so it is drawn and does nothing.
 */
import { hotelViewProperty, useConfigData, useSystemStore, useTranslation } from '#base/context/system';
import { Border, Box, Button, ColorableTextFormat, LayoutImage, Region, ThemeImage, ThemeText } from '#base/theme';

/** `bonus_rare_promo`'s size. */
const WIDTH = 602;
const HEIGHT = 75;

/** `bar_a_bkg`: where the fill starts and how wide it can grow. */
const BAR_FILL_X = 4;
const BAR_FILL_WIDTH = 292;

export interface HotelViewBonusRareWidgetProps {
    colorable: ColorableTextFormat;
}

export const HotelViewBonusRareWidget = ({ colorable }: HotelViewBonusRareWidgetProps) => {
    const bonusRare = useSystemStore(x => x.hotelViewBonusRare);
    const product = useSystemStore(x => x.productData[bonusRare?.productType ?? '']);
    const config = useConfigData();
    const t = useTranslation();
    const configString = (key: string) => hotelViewProperty(config, key);

    if (!bonusRare) return (
        <Box
            visible={false}
            layout={{ width: WIDTH, height: HEIGHT }}
        />
    );

    const visible = bonusRare.productClassId !== -1;
    const total = bonusRare.totalCoinsForBonus;
    const spent = total - bonusRare.coinsStillRequiredToBuy;
    const fill = product && (total > 0) ? Math.trunc((spent / total) * BAR_FILL_WIDTH) : 0;

    return (
        <Box
            visible={visible}
            layout={{ width: WIDTH, height: HEIGHT, flexShrink: 0 }}
        >
            <Border
                variant="105"
                blend={0.2}
                layout={{ position: 'absolute', left: 1, top: 5, width: 600, height: 63 }}
            />
            <Region
                name="teaser_image_container"
                layout={{ position: 'absolute', left: 1, top: 5, width: 96, height: 63 }}
            >
                {product && (
                    <ThemeImage
                        name="promo_image"
                        src={configString('landing.view.bonus.rare.image.uri')}
                        bitmap={{ pivot: 'center', stretchedX: false, stretchedY: false }}
                        layout={{ position: 'absolute', left: 8, top: -9, width: 80, height: 80 }}
                    />
                )}
            </Region>
            <Region
                name="mid_container"
                layout={{ position: 'absolute', left: 97, top: 5, width: 304, height: 53 }}
            >
                {product && (
                    <>
                        <ThemeText
                            name="header"
                            text={t('landing.view.bonus.rare.header', '', { rarename: product.name, amount: String(total) })}
                            textStyle="u_headline_medium"
                            textOptions={{ ...(colorable.fill ? { fill: colorable.fill } : {}), align: 'center' }}
                            flashFormat={colorable.flashFormat}
                            verticalAlign="top"
                            layout={{ position: 'absolute', left: 0, width: 304, top: 5, alignItems: 'center' }}
                        />
                        <Region
                            name="progress_bar_cont"
                            layout={{ position: 'absolute', left: 2, top: 30, width: 302, height: 23 }}
                        >
                            <ThemeImage
                                name="bar_l"
                                src={LayoutImage('shared/achievement_ach_progressbar1.png')}
                                bitmap={{}}
                                layout={{ position: 'absolute', left: 0, top: 0, width: 4, height: 23 }}
                            />
                            <ThemeImage
                                name="bar_c"
                                src={LayoutImage('shared/achievement_ach_progressbar2.png')}
                                bitmap={{}}
                                layout={{ position: 'absolute', left: 4, top: 0, width: 291, height: 23 }}
                            />
                            <ThemeImage
                                name="bar_r"
                                src={LayoutImage('shared/achievement_ach_progressbar3.png')}
                                bitmap={{}}
                                layout={{ position: 'absolute', left: 295, top: 0, width: 4, height: 23 }}
                            />
                            {fill > 0 && (
                                <ThemeImage
                                    name="bar_a_c"
                                    src={LayoutImage('shared/achievement_ach_progressbar4.png')}
                                    bitmap={{}}
                                    layout={{ position: 'absolute', left: BAR_FILL_X, top: 3, width: fill, height: 17 }}
                                />
                            )}
                            <ThemeImage
                                name="bar_a_r"
                                src={LayoutImage('shared/achievement_ach_progressbar5.png')}
                                bitmap={{}}
                                layout={{ position: 'absolute', left: fill + BAR_FILL_X, top: 3, width: 2, height: 17 }}
                            />
                            <ThemeText
                                name="status"
                                text={t('landing.view.bonus.rare.status', '', { amount: String(bonusRare.coinsStillRequiredToBuy), total: String(total) })}
                                // No `text_style` var: the style 0 window's `regular`, with the layout's Ubuntu 12 bold over it.
                                textStyle="regular"
                                textOptions={{ fontFamily: 'Ubuntu', fontSize: 12, fill: '#ffffff', align: 'center' }}
                                flashFormat={{ bold: true, antiAliasType: 'advanced', etchingColor: 0x50000000, etchingPosition: 'bottom-right' }}
                                verticalAlign="top"
                                layout={{ position: 'absolute', left: 0, width: 302, top: 3, alignItems: 'center' }}
                            />
                        </Region>
                    </>
                )}
            </Region>
            <Button
                variant="100"
                name="buy_button"
                layout={{ position: 'absolute', left: 401, top: 10, width: 200, height: 51 }}
            >
                {t('landing.view.bonus.rare.open.credits.page')}
            </Button>
        </Box>
    );
};
