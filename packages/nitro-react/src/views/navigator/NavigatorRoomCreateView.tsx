/**
 * Room creation - `roc_create_room`, driven by `RoomCreateViewCtrl`, which the new navigator's
 * `create_room` button opens (`HabboNewNavigator.createRoom`).
 *
 * - The name and description fields are `TextFieldManager`s: each starts out holding its info
 *   text (`navigator.createroom.roomnameinfo` / `roomdescinfo`) as real text, not a placeholder,
 *   and the first focus clears it. Until then the field reads as empty.
 * - Create checks the name first (`checkMandatory`: more than two characters once trimmed, and not
 *   the info text). A name that fails turns the field `0xf1a39b` and shows `nav_error_popup`
 *   over it; focusing the untouched field or a name that passes restores the colour, but the
 *   popup stays until the window is opened again, as it does in Flash. A good form sends
 *   `CreateFlatComposer` and waits: `FlatCreatedMessage` enters the room and closes this window.
 * - The layouts are `RoomCreateViewCtrl`'s own table, two to a row. A club layout carries the
 *   `club_icon` and picking one without club opens the club centre instead
 *   (`onChooseLayout` -> `openCatalogClubPage`); the staff-only ones are listed only for
 *   `hasSecurity(4)`. Below them, without VIP, `roc_vip_promo` links to the club centre too.
 * - The selected layout's `select_arrow` bobs on a 100 ms timer (`updateArrowPos`). Flash moves
 *   each thumbnail's own arrow, so one picked again resumes where it stopped; here the one arrow
 *   position is shared, which only shows as the bob not restarting from the top.
 *
 * Opening the window while it is already open brings it forward without resetting the form;
 * Flash's `show()` calls `refresh()` either way.
 */
import { ClubLevelEnum, RoomTradeModeEnum, SecurityLevelEnum } from '@nitrodevco/nitro-api';
import { useEffect, useState } from 'react';

import { createFlat, openClubCenter } from '#base/commands';
import { useWebSocketContext } from '#base/context/communication';
import { ROOM_CREATE_LAYOUTS, RoomCreateLayout, useNavigatorStore } from '#base/context/navigator';
import { useConfigValue, useTranslation } from '#base/context/system';
import { useOwnClubLevel, useOwnSecurityLevel } from '#base/context/user';
import { useWindowVisibility } from '#base/hooks';
import { Border, Button, ButtonThick, Dropmenu, Frame, Icon, LayoutImage, Region, ScrollArea, TextInput, ThemeImage, ThemeText } from '#base/theme';
import { flatCategoryName } from '#base/utils';

import { NavigatorErrorPopup } from './NavigatorErrorPopup';

/** `ROOM_LIMIT_NON_SUBSCRIBER` / `ROOM_LIMIT_HC`: the highest visitor cap offered, which `refresh` picks by `hasVip`. */
const ROOM_LIMIT_NON_SUBSCRIBER = 50;
const ROOM_LIMIT_HC = 75;

/** `prepareTradeModeSelection`: the trade menu's entries, whose index is the value sent. */
const TRADE_MODES: { mode: RoomTradeModeEnum; labelKey: string }[] = [
    { mode: RoomTradeModeEnum.Disabled, labelKey: 'navigator.roomsettings.trade_not_allowed' },
    { mode: RoomTradeModeEnum.RoomOwnerAndRights, labelKey: 'navigator.roomsettings.trade_not_with_Controller' },
    { mode: RoomTradeModeEnum.Everyone, labelKey: 'navigator.roomsettings.trade_allowed' },
];

/** The `TextFieldManager` limits the two fields are built with. */
const MAX_NAME_LENGTH = 25;
const MAX_DESCRIPTION_LENGTH = 128;

/** `input.textBackgroundColor`: `refresh` sets white, `displayError` `0xf1a39b`. */
const INPUT_BACKGROUND = '#ffffff';
const INPUT_ERROR_BACKGROUND = '#f1a39b';

/** `refreshSelection`: `tile_size_txt`'s text and fill, selected and not. */
const TILE_TEXT_SELECTED = { fill: '#ffffff', background: '#6f8284' };
const TILE_TEXT_UNSELECTED = { fill: '#000000', background: '#cccccb' };

/** `updateArrowPos`: the timer's period and the range the arrow bobs over. */
const ARROW_TICK_MS = 100;
const ARROW_TOP = 0;
const ARROW_BOTTOM = 15;

/** `roc_room_thumbnail`'s size; a row holds two (`getRow`, `addThumbnail`). */
const THUMBNAIL_WIDTH = 137;
const THUMBNAIL_HEIGHT = 99;

interface ArrowState { y: number; down: boolean }

/** `updateArrowPos`: one step - a pixel near either end, two in between, turning at the ends. */
const stepArrow = ({ y, down }: ArrowState): ArrowState => {
    const step = ((Math.abs(y - ARROW_TOP) < 2) || (Math.abs(y - ARROW_BOTTOM) < 2)) ? 1 : 2;
    const next = y + (down ? step : -step);

    if (next < ARROW_TOP) return { y: ARROW_TOP + 1, down: true };
    if (next > ARROW_BOTTOM) return { y: ARROW_BOTTOM - 1, down: false };

    return { y: next, down };
};

/** A `TextFieldManager`'s field: the text, and whether it still holds its info text. */
interface ManagedField { text: string; info: boolean }

/** `getText`: the info text reads as nothing. */
const fieldText = (field: ManagedField) => (field.info ? '' : field.text);

/** A caption: the style 0 window's `regular` in the layout's `Volter Bold` face. */
const Caption = ({ text, top }: { text: string; top: number }) => (
    <ThemeText
        text={text}
        textStyle="regular"
        textOptions={{ fontFamily: 'Volter Bold' }}
        verticalAlign="top"
        layout={{ position: 'absolute', left: 0, top }}
    />
);

interface ThumbnailProps {
    layout: RoomCreateLayout;
    left: number;
    selected: boolean;
    arrowY: number;
    imageLibraryUrl: string;
    tileSizeText: string;
    onChoose: () => void;
}

/** `roc_room_thumbnail`, as `addThumbnail` fills it and `refreshSelection` marks it. */
const Thumbnail = ({ layout, left, selected, arrowY, imageLibraryUrl, tileSizeText, onChoose }: ThumbnailProps) => {
    const tileText = selected ? TILE_TEXT_SELECTED : TILE_TEXT_UNSELECTED;

    return (
        <Region
            name="thumbnail"
            onPointerTap={onChoose}
            cursor="pointer"
            layout={{ position: 'absolute', left, width: THUMBNAIL_WIDTH, top: 0, height: THUMBNAIL_HEIGHT }}
        >
            <Border
                variant="0"
                name={selected ? 'bg_sel' : 'bg_unsel'}
                tintColor={selected ? '#6f8285' : '#cccccc'}
                layout={{ position: 'absolute', left: 0, width: 135, top: 0, height: 96 }}
            />
            <ThemeImage
                name="bg_pic"
                src={`${imageLibraryUrl}newroom/model_${layout.name}.png`}
                bitmap={{ stretchedX: false, stretchedY: false, pivot: 'center' }}
                layout={{ position: 'absolute', left: 0, width: 135, top: 0, height: 96 }}
            />
            <Region
                name="tile_size_txt"
                backgroundColor={tileText.background}
                layout={{ position: 'absolute', left: 25, top: 78 }}
            >
                <ThemeText
                    text={tileSizeText}
                    textStyle="regular"
                    textOptions={{ fill: tileText.fill }}
                    verticalAlign="top"
                />
            </Region>
            <ThemeImage
                name={selected ? 'tile_icon_white' : 'tile_icon_black'}
                src={LayoutImage(selected ? 'navigator/tile_icon_white.png' : 'navigator/tile_icon_black.png')}
                bitmap={{}}
                layout={{ position: 'absolute', left: 5, width: 18, top: 80, height: 10 }}
            />
            {selected && (
                <ThemeImage
                    name="select_arrow"
                    src={LayoutImage('navigator/select_arrow.png')}
                    bitmap={{}}
                    layout={{ position: 'absolute', left: 60, width: 18, top: arrowY, height: 20 }}
                />
            )}
            {((layout.requiredClubLevel === Number(ClubLevelEnum.Club)) || (layout.requiredClubLevel === Number(ClubLevelEnum.Vip))) && (
                <Icon
                    variant="12"
                    name="club_icon"
                    layout={{ position: 'absolute', left: 109, width: 20, top: 5, height: 10 }}
                />
            )}
        </Region>
    );
};

export const NavigatorRoomCreateView = () => {
    const flatCategories = useNavigatorStore(x => x.flatCategories);
    const clubLevel = useOwnClubLevel();
    const securityLevel = useOwnSecurityLevel();
    const imageLibraryUrl = useConfigValue<string>('image.library.url') ?? '';
    const clubBuyDisabled = useConfigValue<boolean>('habbo_club_buy_disabled') === true;
    const { hide } = useWindowVisibility('navigator_room_create');
    const { send } = useWebSocketContext();
    const t = useTranslation();

    const [ name, setName ] = useState<ManagedField>({ text: t('navigator.createroom.roomnameinfo'), info: true });
    const [ description, setDescription ] = useState<ManagedField>({ text: t('navigator.createroom.roomdescinfo'), info: true });
    const [ nameErrorShown, setNameErrorShown ] = useState(false);
    const [ nameErrorBackground, setNameErrorBackground ] = useState(false);
    const [ categoryIndex, setCategoryIndex ] = useState(0);
    const [ visitorsIndex, setVisitorsIndex ] = useState(0);
    const [ tradeIndex, setTradeIndex ] = useState(0);
    const [ selectedLayout, setSelectedLayout ] = useState(ROOM_CREATE_LAYOUTS[0].name);
    const [ arrow, setArrow ] = useState<ArrowState>({ y: ARROW_TOP, down: true });

    useEffect(() => {
        const timer = setInterval(() => setArrow(stepArrow), ARROW_TICK_MS);

        return () => clearInterval(timer);
    }, []);

    // `SessionDataManager.hasClub` and `hasVip` are both `clubLevel >= 1` in this revision.
    const hasClub = Number(clubLevel) >= Number(ClubLevelEnum.Club);
    const hasVip = hasClub;
    const isStaff = Number(securityLevel) >= Number(SecurityLevelEnum.Employee);

    /** `isAllowed(layout, requireClub)`: listing asks only about staff layouts; choosing asks about club too. */
    const isAllowed = (layout: RoomCreateLayout, requireClub: boolean) => {
        if (layout.requiredClubLevel === Number(ClubLevelEnum.None)) return true;
        if (layout.requiredClubLevel === Number(ClubLevelEnum.Club)) return !requireClub || hasClub;
        if (layout.requiredClubLevel === Number(ClubLevelEnum.Vip)) return !requireClub || hasVip;

        return isStaff;
    };

    // `prepareCategorySelection`: visible, not automatic, and staff-only ones for `hasSecurity(7)`.
    const categories = flatCategories.filter(category => category.visible && !category.automatic
        && (!category.staffOnly || (Number(securityLevel) >= Number(SecurityLevelEnum.Community))));

    // `refreshMaxVisitors`: 10 to the cap in steps of 5.
    const visitorCap = hasVip ? ROOM_LIMIT_HC : ROOM_LIMIT_NON_SUBSCRIBER;
    const visitorSteps = Array.from({ length: ((visitorCap - 10) / 5) + 1 }, (_, i) => 10 + (i * 5));

    const listedLayouts = ROOM_CREATE_LAYOUTS.filter(layout => isAllowed(layout, false));
    const rows = Array.from({ length: Math.ceil(listedLayouts.length / 2) }, (_, i) => listedLayouts.slice(i * 2, (i * 2) + 2));
    const showVipPromo = (Number(clubLevel) < Number(ClubLevelEnum.Vip)) && !clubBuyDisabled;

    const chooseLayout = (layout: RoomCreateLayout) => {
        if (isAllowed(layout, true)) setSelectedLayout(layout.name);
        else openClubCenter(send);
    };

    /** `onInputClick`: the first focus of a field still holding its info text empties it. */
    const focusField = (field: ManagedField, setField: (field: ManagedField) => void, isName: boolean) => {
        if (!field.info) return;

        setField({ text: '', info: false });

        if (isName) setNameErrorBackground(false);
    };

    const create = () => {
        const flatName = fieldText(name);

        // `checkMandatory(navigator.createroom.nameerr)`.
        if (name.info || (flatName.trim().length <= 2)) {
            setNameErrorBackground(true);
            setNameErrorShown(true);

            return;
        }

        setNameErrorBackground(false);

        createFlat(send, {
            flatName,
            flatDescription: fieldText(description),
            flatModelName: `model_${selectedLayout}`,
            categoryID: categories[categoryIndex]?.nodeId ?? 0,
            maxPlayers: visitorSteps[visitorsIndex],
            tradeSetting: TRADE_MODES[tradeIndex].mode,
        });
    };

    const inputBackground = nameErrorBackground ? INPUT_ERROR_BACKGROUND : INPUT_BACKGROUND;

    return (
        <Frame
            id="navigator_room_create"
            variant="3"
            caption={t('navigator.createroom.title')}
            tintColor="#418db0"
            dropShadow={{ distance: 4, alpha: 0.35, blur: 4 }}
            onClose={hide}
            centered
            resizeDirection="none"
            layout={{ position: 'absolute', width: 585, height: 367 }}
            margins={[ 6, 25, 6, 7 ]}
        >
            <Region
                name="room_settings_container"
                layout={{ position: 'absolute', left: 10, width: 255, top: 15, height: 315 }}
            >
                <Caption
                    text={t('navigator.roomname')}
                    top={0}
                />
                <TextInput
                    value={name.text}
                    onChange={text => setName({ text, info: false })}
                    onFocusChange={focused => focused && focusField(name, setName, true)}
                    maxLength={MAX_NAME_LENGTH}
                    textStyle="regular"
                    flashPlacement
                    border="#000000"
                    alwaysShowSelection
                    backgroundColor={inputBackground}
                    focusedBackgroundColor={inputBackground}
                    layout={{ position: 'absolute', left: 0, width: 240, top: 20, height: 19 }}
                />
                <Caption
                    text={t('navigator.roomdesc')}
                    top={50}
                />
                <TextInput
                    value={description.text}
                    onChange={text => setDescription({ text, info: false })}
                    onFocusChange={focused => focused && focusField(description, setDescription, false)}
                    maxLength={MAX_DESCRIPTION_LENGTH}
                    multiline
                    textStyle="regular"
                    flashPlacement
                    border="#000000"
                    alwaysShowSelection
                    backgroundColor={INPUT_BACKGROUND}
                    focusedBackgroundColor={INPUT_BACKGROUND}
                    layout={{ position: 'absolute', left: 0, width: 240, top: 70, height: 60 }}
                />
                <Caption
                    text={t('navigator.category')}
                    top={140}
                />
                <Dropmenu
                    variant="2"
                    caption={categories[categoryIndex] ? flatCategoryName(categories[categoryIndex], t) : ''}
                    options={categories.map((category, index) => ({
                        key: category.nodeId,
                        label: flatCategoryName(category, t),
                        selected: index === categoryIndex,
                        onSelect: () => setCategoryIndex(index),
                    }))}
                    layout={{ position: 'absolute', left: 0, width: 240, top: 160, height: 21 }}
                />
                <Caption
                    text={t('navigator.maxvisitors')}
                    top={190}
                />
                <Dropmenu
                    variant="0"
                    caption={String(visitorSteps[visitorsIndex])}
                    options={visitorSteps.map((step, index) => ({
                        key: step,
                        label: String(step),
                        selected: index === visitorsIndex,
                        onSelect: () => setVisitorsIndex(index),
                    }))}
                    layout={{ position: 'absolute', left: 0, width: 240, top: 210, height: 21 }}
                />
                <Caption
                    text={t('navigator.tradesettings')}
                    top={240}
                />
                <Dropmenu
                    variant="0"
                    caption={t(TRADE_MODES[tradeIndex].labelKey)}
                    options={TRADE_MODES.map(({ mode, labelKey }, index) => ({
                        key: mode,
                        label: t(labelKey),
                        selected: index === tradeIndex,
                        onSelect: () => setTradeIndex(index),
                    }))}
                    layout={{ position: 'absolute', left: 0, width: 240, top: 260, height: 21 }}
                />
                <ButtonThick
                    variant="0"
                    name="create_button"
                    onPointerTap={create}
                    layout={{ position: 'absolute', left: 0, width: 100, top: 290, height: 21 }}
                >
                    {t('navigator.createroom.create')}
                </ButtonThick>
                <Button
                    variant="0"
                    name="back_button"
                    onPointerTap={hide}
                    layout={{ position: 'absolute', left: 140, width: 100, top: 290, height: 21 }}
                >
                    {t('generic.cancel')}
                </Button>
                {nameErrorShown && (
                    // `displayError`: `nav_error_popup` over the name field (0,20, 240 wide).
                    <NavigatorErrorPopup
                        text={t('navigator.createroom.nameerr')}
                        fieldLeft={0}
                        fieldTop={20}
                        fieldWidth={240}
                    />
                )}
            </Region>
            <Region
                name="room_layout_container"
                layout={{ position: 'absolute', left: 270, width: 300, top: 15, height: 315 }}
            >
                <Caption
                    text={t('navigator.createroom.chooselayoutcaption')}
                    top={0}
                />
                <ScrollArea
                    orientation="vertical"
                    variant="0"
                    hideDisabledScrollbar={false}
                    layout={{ position: 'absolute', left: 0, width: 295, top: 20, height: 295 }}
                    viewportLayout={{ position: 'absolute', left: 0, top: 0, width: 290, height: 295 }}
                    scrollbarLayout={{ position: 'absolute', left: 278, top: 0, width: 17, height: 295 }}
                >
                    {/* `background="true"` with no colour: `_fillColor | _alphaColor` is 0x00ffffff, a transparent fill. */}
                    <Region
                        name="layout_item_list"
                        layout={{ flexDirection: 'column', width: '100%' }}
                    >
                        {rows.map(row => (
                            <Region
                                key={row[0].name}
                                layout={{ width: THUMBNAIL_WIDTH * 2, height: THUMBNAIL_HEIGHT, flexShrink: 0 }}
                            >
                                {row.map((layout, index) => (
                                    <Thumbnail
                                        key={layout.name}
                                        layout={layout}
                                        left={index * THUMBNAIL_WIDTH}
                                        selected={layout.name === selectedLayout}
                                        arrowY={arrow.y}
                                        imageLibraryUrl={imageLibraryUrl}
                                        tileSizeText={`${layout.tileSize} ${t('navigator.createroom.tilesize')}`}
                                        onChoose={() => chooseLayout(layout)}
                                    />
                                ))}
                            </Region>
                        ))}
                        {showVipPromo && (
                            <Border
                                variant="2"
                                tintColor="#d48612"
                                layout={{ width: 272, height: 52, flexShrink: 0 }}
                            >
                                <ThemeText
                                    text={t('navigator.createroom.vippromo.text')}
                                    textStyle="regular"
                                    textOptions={{ fontFamily: 'Volter', fontSize: 9, fill: '#ffffff', wordWrap: true, wordWrapWidth: 202 }}
                                    clip
                                    verticalAlign="top"
                                    layout={{ position: 'absolute', left: 52, width: 206, top: 6, height: 25 }}
                                />
                                <Region
                                    name="link"
                                    cursor="pointer"
                                    onPointerTap={() => openClubCenter(send)}
                                    layout={{ position: 'absolute', left: 52, width: 206, top: 30, height: 12 }}
                                >
                                    <ThemeText
                                        text={t('navigator.createroom.vippromo.link')}
                                        textStyle="regular"
                                        textOptions={{ fontFamily: 'Volter', fontSize: 9, fill: '#ffffff' }}
                                        flashFormat={{ underline: true }}
                                        clip
                                        verticalAlign="top"
                                        layout={{ position: 'absolute', left: 0, width: 206, top: 0, height: 12 }}
                                    />
                                </Region>
                                <Icon
                                    variant="16"
                                    layout={{ position: 'absolute', left: 9, width: 42, top: 6, height: 43 }}
                                />
                            </Border>
                        )}
                    </Region>
                </ScrollArea>
            </Region>
        </Frame>
    );
};
