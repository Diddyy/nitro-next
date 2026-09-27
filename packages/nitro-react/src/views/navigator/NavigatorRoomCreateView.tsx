/**
 * The room creation window - `RoomCreateViewCtrl`, drawn from its `roc_create_room` layout, with
 * one `roc_room_thumbnail` per floor plan and the `roc_vip_promo` row under them.
 * `HabboNewNavigator.createRoom` opens it (the navigator's `create_room` button) straight away: the
 * legacy navigator's `CanCreateRoomMessageComposer` round trip belongs to its own My Rooms tab and
 * toolbar menu, which the new navigator does not use.
 *
 * - The form: name (25 characters) and description (128), each a `TextFieldManager` that shows its
 *   `navigator.createroom.*info` hint as the field's own text until the field is focused; the
 *   category (visible, not automatic, staff-only ones only with security 7); the visitor cap, 10 up
 *   to 50 - 75 with club (`hasVip`, which is `clubLevel >= 1` in this revision); the trade mode.
 * - The floor plans: `_layouts`, in Flash's order, two to a row. Every plan with a club level is
 *   listed, and choosing one without the club opens the club centre (`openCatalogClubPage`); the
 *   `-1` plans (snowwar) are listed only with security 4. The selected one is framed, shows its
 *   white tile icon and the arrow bobbing over it (`updateArrowPos`, every 100 ms).
 * - Create: a name of three or more characters after trimming, else the field turns pink under
 *   the `nav_error_popup` bubble (`checkMandatory`); then `CreateFlatMessageComposer`. The server
 *   answers with `FlatCreatedMessage`, and `registerNavigatorHandlers` takes the user there.
 *
 * Every open starts from `refresh`'s state: the window is mounted only while it is shown, which is
 * also `show` / `hide`. The selection is held by plan name and only ever set from a listed plan, so
 * `findLayout`'s fall back to the first plan for an unknown name has nothing to catch.
 *
 * The thumbnails' tile icon and arrow and the popup's arrow are loaded by url from
 * `public/assets/navigator/`: `scripts/build-asset-bundles.ts` is not on this machine, so they could
 * not be packed into `nitro-layouts.nitro`. Switch them to `LayoutImage` once the bundle is rebuilt.
 */
import { RoomTradeModeEnum } from '@nitrodevco/nitro-api';
import { IFlatCategory } from '@nitrodevco/nitro-packets';
import { useEffect, useState } from 'react';

import { createFlat, openClubCenter } from '#base/commands';
import { useWebSocketContext } from '#base/context/communication';
import { ROOM_CREATE_LAYOUTS, RoomCreateLayout, useNavigatorStore } from '#base/context/navigator';
import { useConfigValue, useTranslation, useWindowActions } from '#base/context/system';
import { useOwnClubLevel, useOwnSecurityLevel } from '#base/context/user';
import { Border, Box, Button, ButtonThick, Dropmenu, Frame, Icon, Region, ScrollArea, TextInput, ThemeImage, ThemeText } from '#base/theme';

/** `ROOM_LIMIT_NON_SUBSCRIBER` / `ROOM_LIMIT_HC`: the highest visitor cap offered. */
const ROOM_LIMIT_NON_SUBSCRIBER = 50;
const ROOM_LIMIT_HC = 75;

/** `TextFieldManager`'s `maxChars` for the two fields. */
const NAME_MAX_LENGTH = 25;
const DESCRIPTION_MAX_LENGTH = 128;

/** `TextFieldManager.isInputValid`: more than two characters once trimmed. */
const MIN_NAME_LENGTH = 3;

/** `refreshSelection`'s tile size colours and `displayError`'s field colour. */
const TILE_TEXT_SELECTED = '#ffffff';
const TILE_TEXT_UNSELECTED = '#000000';
const TILE_BACKGROUND_SELECTED = '#6e8184';
const TILE_BACKGROUND_UNSELECTED = '#cbcbcb';
const FIELD_ERROR_BACKGROUND = '#f18f9b';

/** `roc_room_thumbnail`: 137x99, two to a row. */
const THUMBNAIL_WIDTH = 137;
const THUMBNAIL_HEIGHT = 99;

/** `updateArrowPos`: the arrow runs between y 0 and 15, a pixel a tick near either end and two between. */
const ARROW_TICK_MS = 100;
const ARROW_TOP = 0;
const ARROW_BOTTOM = 15;

const RUNTIME_IMAGE = (name: string) => `/assets/navigator/${name}.png`;

/** `hasVip` / `hasClub` (both `clubLevel >= 1` here) and `hasSecurity`. */
const isLayoutAllowed = (requiredClubLevel: number, clubLevel: number, securityLevel: number, choosing: boolean) => {
    switch (requiredClubLevel) {
        case 0: return true;
        case 1:
        case 2: return !choosing || (clubLevel >= 1);
        default: return securityLevel >= 4;
    }
};

/** `FlatCategory.visibleName`. */
const categoryName = (category: IFlatCategory, t: (key: string) => string) => (category.globalCategoryKey ? t(`navigator.flatcategory.global.${category.globalCategoryKey}`) : category.nodeName);

/** A `TextFieldManager` field's state: its text, and whether that text is still the hint. */
interface HintedField {
    text: string;
    showingHint: boolean;
}

/** `nav_error_popup`: the message in a style 0 border, with the arrow down onto the field, centred over it. */
const FieldErrorPopup = ({ message, left, top, width }: { message: string; left: number; top: number; width: number }) => (
    <Box layout={{ position: 'absolute', left, top: top - 30, width, flexDirection: 'column', alignItems: 'center' }}>
        <Border
            variant="0"
            layout={{ paddingLeft: 8, paddingRight: 7, paddingTop: 4, height: 23 }}
        >
            <ThemeText
                text={message}
                textStyle="regular"
                textOptions={{ fontFamily: 'Volter', fontSize: 9, fill: '#000000' }}
            />
        </Border>
        <ThemeImage
            src={RUNTIME_IMAGE('popup_arrow_down')}
            layout={{ width: 11, height: 11, marginTop: -1 }}
        />
    </Box>
);

const Caption = ({ text, top, left = 0 }: { text: string; top: number; left?: number }) => (
    <ThemeText
        text={text}
        textStyle="regular"
        textOptions={{ fontFamily: 'Volter Bold' }}
        flashFormat={{ kerning: false }}
        layout={{ position: 'absolute', left, top }}
    />
);

const HintedInput = ({ field, onChange, maxLength, multiline, error, top, height }: {
    field: HintedField;
    onChange: (field: HintedField) => void;
    maxLength: number;
    multiline?: boolean;
    error: boolean;
    top: number;
    height: number;
}) => (
    <TextInput
        value={field.text}
        onChange={text => onChange({ text: text.slice(0, maxLength), showingHint: false })}
        // `onInputClick`: focusing a field that still shows its hint empties it.
        onFocusChange={(focused) => {
            if (focused && field.showingHint) onChange({ text: '', showingHint: false });
        }}
        maxLength={maxLength}
        multiline={multiline}
        textStyle="regular"
        flashFormat={{ kerning: false }}
        border="#000000"
        backgroundColor={error ? FIELD_ERROR_BACKGROUND : '#ffffff'}
        focusedBackgroundColor={error ? FIELD_ERROR_BACKGROUND : '#ffffff'}
        alwaysShowSelection
        layout={{ position: 'absolute', left: 0, top, width: 240, height }}
    />
);

interface ThumbnailProps {
    layout: RoomCreateLayout;
    selected: boolean;
    arrowY: number;
    imageLibraryUrl: string;
    tileSizeLabel: string;
    left: number;
    onChoose: () => void;
}

/** `addThumbnail` / `refreshSelection`: one floor plan. */
const Thumbnail = ({ layout, selected, arrowY, imageLibraryUrl, tileSizeLabel, left, onChoose }: ThumbnailProps) => (
    <Region
        name="thumbnail"
        onPointerTap={onChoose}
        cursor="pointer"
        layout={{ position: 'absolute', left, top: 0, width: THUMBNAIL_WIDTH, height: THUMBNAIL_HEIGHT }}
    >
        {/* `bg_sel` / `bg_unsel`: one border, tinted by the selection */}
        <Border
            variant="0"
            tintColor={selected ? '#6f8285' : '#cccccc'}
            layout={{ position: 'absolute', left: 0, top: 0, width: 135, height: 96 }}
        />
        {/* `bg_pic` */}
        <ThemeImage
            src={`${imageLibraryUrl}newroom/model_${layout.name}.png`}
            bitmap={{ pivot: 'center', stretchedX: false, stretchedY: false }}
            layout={{ position: 'absolute', left: 0, top: 0, width: 135, height: 96 }}
            eventMode="none"
        />
        {/* `tile_size_txt` */}
        <Region
            backgroundColor={selected ? TILE_BACKGROUND_SELECTED : TILE_BACKGROUND_UNSELECTED}
            layout={{ position: 'absolute', left: 25, top: 78 }}
        >
            <ThemeText
                text={`${layout.tileSize} ${tileSizeLabel}`}
                textStyle="regular"
                textOptions={{ fill: selected ? TILE_TEXT_SELECTED : TILE_TEXT_UNSELECTED }}
                flashFormat={{ kerning: false }}
            />
        </Region>
        <ThemeImage
            src={RUNTIME_IMAGE(selected ? 'tile_icon_white' : 'tile_icon_black')}
            layout={{ position: 'absolute', left: 5, top: 80, width: 18, height: 10 }}
            eventMode="none"
        />
        {selected && (
            <ThemeImage
                src={RUNTIME_IMAGE('select_arrow')}
                layout={{ position: 'absolute', left: 60, top: arrowY, width: 18, height: 20 }}
                eventMode="none"
            />
        )}
        {/* `club_icon`, shown for the club and VIP plans. */}
        {((layout.requiredClubLevel === 1) || (layout.requiredClubLevel === 2)) && (
            <Icon
                variant={12}
                layout={{ position: 'absolute', left: 109, top: 5, width: 20, height: 10 }}
            />
        )}
    </Region>
);

/** `roc_vip_promo`: the club offer under the floor plans for a user without VIP. */
const VipPromo = ({ t, onMore }: { t: (key: string) => string; onMore: () => void }) => (
    <Border
        variant="2"
        tintColor="#d48612"
        layout={{ width: 272, height: 52 }}
    >
        <Icon
            variant={16}
            layout={{ position: 'absolute', left: 9, top: 6, width: 42, height: 43 }}
        />
        <ThemeText
            text={t('navigator.createroom.vippromo.text')}
            textStyle="regular"
            textOptions={{ fontFamily: 'Volter', fontSize: 9, fill: '#ffffff', wordWrap: true, wordWrapWidth: 206 }}
            layout={{ position: 'absolute', left: 52, top: 6, width: 206, height: 25 }}
        />
        <Region
            name="link"
            onPointerTap={onMore}
            cursor="pointer"
            layout={{ position: 'absolute', left: 52, top: 30, width: 206, height: 12 }}
        >
            <ThemeText
                text={t('navigator.createroom.vippromo.link')}
                textStyle="regular"
                textOptions={{ fontFamily: 'Volter', fontSize: 9, fill: '#ffffff' }}
                flashFormat={{ underline: true }}
            />
        </Region>
    </Border>
);

export const NavigatorRoomCreateView = () => {
    const t = useTranslation();
    const { send } = useWebSocketContext();
    const { hideWindow } = useWindowActions();
    const categories = useNavigatorStore(x => x.flatCategories);
    const clubLevel = Number(useOwnClubLevel());
    const securityLevel = Number(useOwnSecurityLevel());
    const imageLibraryUrl = useConfigValue<string>('image.library.url') ?? '';
    const clubBuyDisabled = useConfigValue<boolean>('habbo_club_buy_disabled') === true;

    const [ name, setName ] = useState<HintedField>(() => ({ text: t('navigator.createroom.roomnameinfo'), showingHint: true }));
    const [ description, setDescription ] = useState<HintedField>(() => ({ text: t('navigator.createroom.roomdescinfo'), showingHint: true }));
    const [ nameError, setNameError ] = useState<string>();
    const [ categoryIndex, setCategoryIndex ] = useState(0);
    const [ visitorsIndex, setVisitorsIndex ] = useState(0);
    const [ tradeMode, setTradeMode ] = useState<RoomTradeModeEnum>(RoomTradeModeEnum.Disabled);
    const [ selectedLayout, setSelectedLayout ] = useState(ROOM_CREATE_LAYOUTS[0].name);
    const [ arrow, setArrow ] = useState({ y: ARROW_TOP, down: true });

    // `updateArrowPos`, on `_arrowTimer`.
    useEffect(() => {
        const timer = setInterval(() => setArrow(({ y, down }) => {
            const step = ((Math.abs(y - ARROW_TOP) < 2) || (Math.abs(y - ARROW_BOTTOM) < 2)) ? 1 : 2;
            const next = y + (down ? step : -step);

            if (next < ARROW_TOP) return { y: ARROW_TOP + 1, down: true };
            if (next > ARROW_BOTTOM) return { y: ARROW_BOTTOM - 1, down: false };

            return { y: next, down };
        }), ARROW_TICK_MS);

        return () => clearInterval(timer);
    }, []);

    // `prepareCategorySelection`: visible categories a user may pick.
    const selectableCategories = categories.filter(category => category.visible && !category.automatic && (!category.staffOnly || (securityLevel >= 7)));
    // `refreshMaxVisitors`.
    const visitorSteps: number[] = [];

    for (let step = 10; step <= ((clubLevel >= 1) ? ROOM_LIMIT_HC : ROOM_LIMIT_NON_SUBSCRIBER); step += 5) visitorSteps.push(step);

    const tradeModes = [ 'navigator.roomsettings.trade_not_allowed', 'navigator.roomsettings.trade_not_with_Controller', 'navigator.roomsettings.trade_allowed' ];
    const listedLayouts = ROOM_CREATE_LAYOUTS.filter(layout => isLayoutAllowed(layout.requiredClubLevel, clubLevel, securityLevel, false));
    const rows: (typeof listedLayouts)[] = [];

    for (let index = 0; index < listedLayouts.length; index += 2) rows.push(listedLayouts.slice(index, index + 2));

    // `refreshRoomThumbnails`: the promo for a user below VIP, unless the hotel sells no club.
    const showVipPromo = (clubLevel < 2) && !clubBuyDisabled;

    const close = () => hideWindow('room_create');

    const chooseLayout = (layout: RoomCreateLayout) => {
        if (isLayoutAllowed(layout.requiredClubLevel, clubLevel, securityLevel, true)) setSelectedLayout(layout.name);
        else openClubCenter(send);
    };

    // `onCreateButtonClick`.
    const create = () => {
        const roomName = name.showingHint ? '' : name.text;

        if (roomName.trim().length < MIN_NAME_LENGTH) {
            setNameError(t('navigator.createroom.nameerr'));

            return;
        }

        setNameError(undefined);
        createFlat(send, {
            flatName: roomName,
            flatDescription: description.showingHint ? '' : description.text,
            flatModelName: `model_${selectedLayout}`,
            categoryID: selectableCategories[categoryIndex]?.nodeId ?? 0,
            maxPlayers: visitorSteps[visitorsIndex] ?? visitorSteps[0],
            tradeSetting: tradeMode,
        });
    };

    const dropmenu = (variant: string, top: number, labels: string[], selected: number, onSelect: (index: number) => void) => (
        <Dropmenu
            variant={variant}
            caption={labels[selected] ?? ''}
            options={labels.map((label, index) => ({ key: index, label, selected: index === selected, onSelect: () => onSelect(index) }))}
            layout={{ position: 'absolute', left: 0, top, width: 240, height: 21 }}
        />
    );

    return (
        <Frame
            variant="3"
            id="room-create"
            caption={t('navigator.createroom.title')}
            tintColor="#418db0"
            dropShadow={{ distance: 4, alpha: 0.35, blur: 4 }}
            onClose={close}
            centered
            rememberPosition={false}
            resizeDirection="none"
            margins={[ 6, 25, 6, 7 ]}
            layout={{ position: 'absolute', width: 585, height: 367 }}
        >
            {/* `room_settings_container` */}
            <Box layout={{ position: 'absolute', left: 10, top: 15, width: 255, height: 315 }}>
                {/* `create_room_caption` */}
                <Caption
                    text={t('navigator.roomname')}
                    top={0}
                />
                {/* `room_name_input` */}
                <HintedInput
                    field={name}
                    onChange={(field) => {
                        setName(field);
                        setNameError(undefined);
                    }}
                    maxLength={NAME_MAX_LENGTH}
                    error={!!nameError}
                    top={20}
                    height={19}
                />
                {/* `create_desc_caption` */}
                <Caption
                    text={t('navigator.roomdesc')}
                    top={50}
                />
                {/* `room_desc_input` */}
                <HintedInput
                    field={description}
                    onChange={setDescription}
                    maxLength={DESCRIPTION_MAX_LENGTH}
                    multiline
                    error={false}
                    top={70}
                    height={60}
                />
                {/* `create_category_caption` */}
                <Caption
                    text={t('navigator.category')}
                    top={140}
                />
                {/* `categories_list` */}
                {dropmenu('2', 160, selectableCategories.map(category => categoryName(category, t)), categoryIndex, setCategoryIndex)}
                {/* `create_visitors_caption` */}
                <Caption
                    text={t('navigator.maxvisitors')}
                    top={190}
                />
                {/* `visitors_list` */}
                {dropmenu('0', 210, visitorSteps.map(String), visitorsIndex, setVisitorsIndex)}
                {/* `create_trade_caption` */}
                <Caption
                    text={t('navigator.tradesettings')}
                    top={240}
                />
                {/* `trade_settings_list` */}
                {dropmenu('0', 260, tradeModes.map(key => t(key)), tradeMode, index => setTradeMode(index))}
                <ButtonThick
                    name="create_button"
                    variant="0"
                    onPointerTap={create}
                    layout={{ position: 'absolute', left: 0, top: 290, width: 100, height: 21 }}
                >
                    {t('navigator.createroom.create')}
                </ButtonThick>
                <Button
                    name="back_button"
                    variant="0"
                    onPointerTap={close}
                    layout={{ position: 'absolute', left: 140, top: 290, width: 100, height: 21 }}
                >
                    {t('generic.cancel')}
                </Button>
                {nameError && (
                    <FieldErrorPopup
                        message={nameError}
                        left={0}
                        top={20}
                        width={240}
                    />
                )}
            </Box>
            {/* `room_layout_container` */}
            <Box layout={{ position: 'absolute', left: 270, top: 15, width: 300, height: 315 }}>
                {/* `choose_layout_caption` */}
                <Caption
                    text={t('navigator.createroom.chooselayoutcaption')}
                    top={0}
                />
                {/* `layout_item_list` and its `scroller` */}
                <ScrollArea
                    hideDisabledScrollbar={false}
                    layout={{ position: 'absolute', left: 0, top: 20, width: 295, height: 295 }}
                    viewportLayout={{ position: 'absolute', left: 0, top: 0, width: 290, height: 295 }}
                    scrollbarLayout={{ position: 'absolute', left: 278, top: 0, width: 17, height: 295 }}
                >
                    {rows.map(row => (
                        <Box
                            key={row[0].name}
                            layout={{ width: 2 * THUMBNAIL_WIDTH, height: THUMBNAIL_HEIGHT }}
                        >
                            {row.map((layout, index) => (
                                <Thumbnail
                                    key={layout.name}
                                    layout={layout}
                                    selected={layout.name === selectedLayout}
                                    arrowY={arrow.y}
                                    imageLibraryUrl={imageLibraryUrl}
                                    tileSizeLabel={t('navigator.createroom.tilesize')}
                                    left={index * THUMBNAIL_WIDTH}
                                    onChoose={() => chooseLayout(layout)}
                                />
                            ))}
                        </Box>
                    ))}
                    {showVipPromo && (
                        <VipPromo
                            t={t}
                            onMore={() => openClubCenter(send)}
                        />
                    )}
                </ScrollArea>
            </Box>
        </Frame>
    );
};
