import { RoomChatFloodSensitivityType, RoomDoorModeEnum, RoomModerationType, RoomThicknessType, RoomTradeModeEnum } from '@nitrodevco/nitro-api';
import { IFlatCategory, IFlatController, IMessengerFriend, RoomSettingsDataEventMessageType } from '@nitrodevco/nitro-packets';
import { ReactNode, useState } from 'react';

import { openClientLink } from '#base/commands';
import { useWebSocketContext } from '#base/context/communication';
import { RoomSettingsErrorField, RoomSettingsFormError } from '#base/context/room';
import { useConfigValue, useTranslation } from '#base/context/system';
import { Border, Box, Button, ButtonThick, CheckBox, Dropmenu, Frame, Icon, RadioButton, Region, ScrollArea, TabButton, TabContent, TabContext, TextInput, ThemeImage, ThemeText } from '#base/theme';
import { flatCategoryName } from '#base/utils';
import { NavigatorErrorPopup } from '#base/views/navigator/NavigatorErrorPopup';

/**
 * `startRoomSettingsEdit` / `startRoomSettingsEditFromNavigator`: with no `roomId` the window edits
 * the room you are standing in; the navigator's room info popup names another room and its group.
 */
export type RoomSettingsViewWindowParams = { roomId?: number; groupId?: number };

export interface RoomSettingsViewProps {
    settings: RoomSettingsDataEventMessageType;
    /** `navigator.data.allCategories` - every category the client knows, unfiltered. */
    categories: IFlatCategory[];
    /** Who holds rights in the room. */
    controllers: IFlatController[];
    /** Who is banned from it. */
    bannedUsers: IFlatController[];
    /** Which banned row is picked out; the one unban button acts on it (`BanListCtrl.selectedRow`). */
    selectedBannedUser: number;
    /** Your friends, so rights can be handed to one without typing a name. */
    friends: IMessengerFriend[];
    /** What has been typed into the friend search on the rights tab. */
    friendFilter: string;
    /** Only read for a password door: the server never sends the current one back. */
    password: string;
    passwordConfirm: string;
    /** `refreshMaxVisitors`: the steps the `maxvisitors` menu offers, and the one it has selected. */
    visitorSteps: number[];
    selectedVisitors: number;
    /** `VIPFeaturesAllowed()` - without it the whole club tab is dead and its values are left as the server sent them. */
    hasClub: boolean;
    /** `_groupId > 0`: a group room's moderation powers can also be given to its admins. */
    isGroupRoom: boolean;
    /** `showDeleteButton`: the delete link is hidden outside the room and greyed while the account is safety locked. */
    canDelete: boolean;
    deleteDisabled: boolean;
    /** `hasSecurity(4)`: staff never see the Builders Club "room locked" panel. */
    isStaff: boolean;
    /** Which of the five tabs is open. */
    tab: number;
    /**
     * `_removeTabsForNavigatorView`: the settings of a room you are not standing in (opened from the
     * navigator) leave out the access and rights tabs, and `resizeTabs` spreads the rest wider.
     */
    removeTabsForNavigatorView: boolean;
    /** What the last save was refused for, shown over the field it names, or nothing. */
    error: RoomSettingsFormError | undefined;
    onChangeTab: (tab: number) => void;
    /** A field being typed into: the form changes, nothing is sent until the field is left. */
    onChange: (changes: Partial<RoomSettingsDataEventMessageType>) => void;
    /** A pick - a dropmenu, switch or door mode: the form changes and is saved (`onUnfocus`). */
    onSelectSetting: (changes: Partial<RoomSettingsDataEventMessageType>) => void;
    /** The three room behaviour switches: saved only once their timeouts are valid (`onRoomBehaviorSettingsChanged`). */
    onSelectBehaviour: (changes: Partial<RoomSettingsDataEventMessageType>) => void;
    /** A text field was left: the form as typed is saved. */
    onCommit: () => void;
    onChangePassword: (password: string) => void;
    onChangePasswordConfirm: (password: string) => void;
    onChangeFriendFilter: (filter: string) => void;
    onGiveRights: (userId: number) => void;
    onTakeRights: (userId: number) => void;
    onTakeAllRights: () => void;
    onSelectBannedUser: (userId: number) => void;
    onUnban: () => void;
    onDeleteRoom: () => void;
    onClose: () => void;
}

/** `navigator.roomsettings.tab.N` - the five tabs, in the order the layout lays them out. */
const TABS = [ 1, 2, 3, 4, 5 ];

const TAB_BASIC = 1;
const TAB_ACCESS = 2;
const TAB_RIGHTS = 3;
const TAB_CLUB_AND_CHAT = 4;
const TAB_MODERATION = 5;

/** `tab_container_4`'s height, the tallest tab - taller than `content_container`'s 369. */
const TALLEST_TAB_HEIGHT = 395;

/** `UserListCtrl.DISPLAY_LIMIT`: neither user list ever draws more rows than this. */
const DISPLAY_LIMIT = 200;

/** The door modes, in the order the `doormode` selector stacks their radio buttons. */
const DOOR_MODES: { mode: RoomDoorModeEnum; labelKey: string }[] = [
    { mode: RoomDoorModeEnum.Open, labelKey: 'navigator.roomsettings.doormode.open' },
    { mode: RoomDoorModeEnum.Locked, labelKey: 'navigator.roomsettings.doormode.doorbell' },
    { mode: RoomDoorModeEnum.Invisible, labelKey: 'navigator.roomsettings.doormode.invisible' },
    { mode: RoomDoorModeEnum.Password, labelKey: 'navigator.roomsettings.doormode.password' },
];

const TRADE_MODES: { mode: RoomTradeModeEnum; labelKey: string }[] = [
    { mode: RoomTradeModeEnum.Disabled, labelKey: 'navigator.roomsettings.trade_not_allowed' },
    { mode: RoomTradeModeEnum.RoomOwnerAndRights, labelKey: 'navigator.roomsettings.trade_not_with_Controller' },
    { mode: RoomTradeModeEnum.Everyone, labelKey: 'navigator.roomsettings.trade_allowed' },
];

/**
 * `RoomSettingsCtrl.localizeItems`: every moderation level the client can name. Value 3 is not one
 * of them - no Flash key exists for it - so a room that comes back with it falls to the first
 * option, exactly as `normalizeSelection` does.
 */
const MODERATION_LABELS: Partial<Record<RoomModerationType, string>> = {
    [RoomModerationType.None]: 'navigator.roomsettings.moderation.none',
    [RoomModerationType.Rights]: 'navigator.roomsettings.moderation.rights',
    [RoomModerationType.All]: 'navigator.roomsettings.moderation.all',
    [RoomModerationType.GroupRights]: 'navigator.roomsettings.moderation.group_admins',
    [RoomModerationType.RightsOrGroup]: 'navigator.roomsettings.moderation.group_admins_and_rights',
};

/** `populateRoomModerationSettings`: which levels each power offers, and what a group room adds. */
const moderationLevels = (power: 'mute' | 'kick' | 'ban', isGroupRoom: boolean): RoomModerationType[] => {
    const base = (power === 'kick')
        ? [ RoomModerationType.None, RoomModerationType.Rights, RoomModerationType.All ]
        : [ RoomModerationType.None, RoomModerationType.Rights ];

    return isGroupRoom ? [ ...base, RoomModerationType.GroupRights, RoomModerationType.RightsOrGroup ] : base;
};

/**
 * The `wall_thickness` / `floor_thickness` dropmenus' items, in order: each surface has its own
 * texts (`navigator.roomsettings.wall_thickness.thin`, `...floor_thickness.thin`) and no heading.
 */
const THICKNESSES: { thickness: RoomThicknessType; suffix: string }[] = [
    { thickness: RoomThicknessType.Thinnest, suffix: 'thinnest' },
    { thickness: RoomThicknessType.Thin, suffix: 'thin' },
    { thickness: RoomThicknessType.Normal, suffix: 'normal' },
    { thickness: RoomThicknessType.Thick, suffix: 'thick' },
];

const FLOOD_SENSITIVITIES: { sensitivity: RoomChatFloodSensitivityType; labelKey: string }[] = [
    { sensitivity: RoomChatFloodSensitivityType.Extra, labelKey: 'navigator.roomsettings.chat.flood.strict' },
    { sensitivity: RoomChatFloodSensitivityType.Normal, labelKey: 'navigator.roomsettings.chat.flood.normal' },
    { sensitivity: RoomChatFloodSensitivityType.Minimal, labelKey: 'navigator.roomsettings.chat.flood.loose' },
];

const MAX_NAME_LENGTH = 60;
const MAX_DESCRIPTION_LENGTH = 255;
const MAX_TAG_LENGTH = 30;
const MAX_TIMEOUT_LENGTH = 5;
const MAX_TAGS = 2;

/** `ros_room_settings`' inputs: `u_regular` in a `0x959595` border over `0xfbfbf9`. */
const INPUT_BORDER = '#959595';
const INPUT_BACKGROUND = '#fbfbf9';
/** `TextFieldManager.displayError`: a refused field's `textBackgroundColor`. */
const INPUT_ERROR_BACKGROUND = '#f1a39b';

/** `RoomSettingsCtrl.resizeTabs`: the window's width over the visible tabs, less one. */
const tabWidth = (visibleTabs: number) => Math.trunc(341 / visibleTabs) - 1;

/** `UserListCtrl.getBgColor`: odd rows white, even rows `0xe9e9e1`, the hovered one `0xb6d9ff`; `BanListCtrl` marks the picked one `0x9ab8d9`. */
const ROW_COLOR_ODD = '#ffffff';
const ROW_COLOR_EVEN = '#e9e9e1';
const ROW_COLOR_HOVER = '#b6d9ff';
const ROW_COLOR_PICKED = '#9ab8d9';

/** `${image.library.url}Events/arrow_move_right.png` / `arrow_move_left.png`: the arrow a hovered rights row shows. */
const ARROW_RIGHT_PATH = 'Events/arrow_move_right.png';
const ARROW_LEFT_PATH = 'Events/arrow_move_left.png';

type Place = { left: number; top: number };

/** A `u_bold` caption, as the layout places every field's. */
const Label = ({ text, left, top, alpha }: Place & { text: string; alpha?: number }) => (
    <ThemeText
        text={text}
        textStyle="u_bold"
        verticalAlign="top"
        alpha={alpha}
        layout={{ position: 'absolute', left, top }}
    />
);

/** A `u_regular` text sized to itself. */
const Text = ({ text, left, top, alpha }: Place & { text: string; alpha?: number }) => (
    <ThemeText
        text={text}
        textStyle="u_regular"
        verticalAlign="top"
        alpha={alpha}
        layout={{ position: 'absolute', left, top }}
    />
);

/** A wrapping text of a fixed box, cut at its bottom. */
const Paragraph = ({ text, left, top, width, height, textStyle = 'u_regular' }: Place & { text: string; width: number; height: number; textStyle?: 'u_regular' | 'u_headline_small' }) => (
    <ThemeText
        text={text}
        textStyle={textStyle}
        textOptions={{ wordWrap: true, wordWrapWidth: width - 4 }}
        clip
        verticalAlign="top"
        layout={{ position: 'absolute', left, top, width, height }}
    />
);

/**
 * A `checkbox` window: the whole rect answers the pointer, and `habbo_skin_button_checkbox`
 * draws its 15x15 box `fixed` at the window's top left - not stretched over the rect.
 */
const SettingCheckBox = ({ left, top, width, height, checked, disabled, onToggle }: Place & { width: number; height: number; checked: boolean; disabled?: boolean; onToggle: () => void }) => (
    <Region
        cursor={disabled ? undefined : 'pointer'}
        onPointerTap={disabled ? undefined : onToggle}
        alpha={disabled ? 0.5 : 1}
        layout={{ position: 'absolute', left, top, width, height }}
    >
        <CheckBox
            variant="0"
            selected={checked}
            disabled={disabled}
        />
    </Region>
);

/** A `radiobutton` window: as a checkbox, the 16x16 `habbo_skin_button_radio` art `fixed` at its top left. */
const SettingRadioButton = ({ left, top, width, height, selected, onSelect }: Place & { width: number; height: number; selected: boolean; onSelect: () => void }) => (
    <Region
        cursor="pointer"
        onPointerTap={onSelect}
        layout={{ position: 'absolute', left, top, width, height }}
    >
        <RadioButton
            variant="0"
            selected={selected}
        />
    </Region>
);

/** A style 2 `dropmenu` over a numeric setting. */
const SettingDropmenu = ({ options, value, disabled, left, top, width, onSelect }: Place & {
    options: { value: number; label: string }[];
    value: number;
    disabled?: boolean;
    width: number;
    onSelect: (value: number) => void;
}) => (
    <Dropmenu
        variant="2"
        disabled={disabled}
        caption={options.find(option => option.value === value)?.label ?? ''}
        options={options.map(option => ({ key: option.value, label: option.label, selected: option.value === value, onSelect: () => onSelect(option.value) }))}
        layout={{ position: 'absolute', left, top, width, height: 24 }}
    />
);

/** An `input` of the form: `u_regular`, the layout's border and fill, text at Flash's gutter. */
const SettingInput = ({ value, onChange, onCommit, error = false, maxLength, password, multiline, restrict, left, top, width, height }: Place & {
    value: string;
    /** Refused on the last save: tinted as `displayError` tints it. */
    error?: boolean;
    onChange: (value: string) => void;
    /** `WE_UNFOCUSED` -> `onUnfocus`: leaving the field saves the form. */
    onCommit: () => void;
    maxLength: number;
    password?: boolean;
    multiline?: boolean;
    restrict?: string;
    width: number;
    height: number;
}) => (
    <TextInput
        value={value}
        onChange={onChange}
        onFocusChange={focused => !focused && onCommit()}
        maxLength={maxLength}
        password={password}
        multiline={multiline}
        restrict={restrict}
        textStyle="u_regular"
        flashPlacement
        border={INPUT_BORDER}
        backgroundColor={error ? INPUT_ERROR_BACKGROUND : INPUT_BACKGROUND}
        focusedBackgroundColor={error ? INPUT_ERROR_BACKGROUND : INPUT_BACKGROUND}
        layout={{ position: 'absolute', left, top, width, height }}
    />
);

/**
 * One `ros_flat_controller` / `ros_friend` / `ros_banned_user` row (111x20): the owner's eye at
 * 9,4, the name at 24,1, and on a rights row the arrow of where a click moves the user - right,
 * out of the rights list, at 104,4; left, into it, at 1,4. `UserListCtrl` colours the row by its
 * index and turns it `0xb6d9ff` while the pointer is over it, when the arrow shows too.
 */
const UserRow = ({ name, index, picked = false, arrow, imageLibraryUrl, onPress }: { name: string; index: number; picked?: boolean; arrow?: 'right' | 'left'; imageLibraryUrl: string; onPress: () => void }) => {
    const [ hovered, setHovered ] = useState(false);
    const color = picked ? ROW_COLOR_PICKED : (hovered ? ROW_COLOR_HOVER : (((index % 2) !== 0) ? ROW_COLOR_ODD : ROW_COLOR_EVEN));

    return (
        <Region
            cursor="pointer"
            backgroundColor={color}
            onPointerTap={onPress}
            onPointerOver={() => setHovered(true)}
            onPointerOut={() => setHovered(false)}
            layout={{ width: 111, height: 20, flexShrink: 0 }}
        >
            <Icon
                variant={21}
                layout={{ position: 'absolute', left: 9, top: 4 }}
            />
            <ThemeText
                text={name}
                textStyle="u_regular"
                verticalAlign="top"
                layout={{ position: 'absolute', left: 24, top: 1 }}
            />
            {arrow && hovered && (
                <ThemeImage
                    src={`${imageLibraryUrl}${(arrow === 'right') ? ARROW_RIGHT_PATH : ARROW_LEFT_PATH}`}
                    layout={{ position: 'absolute', left: (arrow === 'right') ? 104 : 1, top: 4 }}
                />
            )}
        </Region>
    );
};

/** A style 0 border holding a list and its `scrollbar_vertical` at the layout's rects. */
const UserList = ({ left, top, width, height, listHeight, scrollbarLeft, scrollbarHeight, children }: Place & { width: number; height: number; listHeight: number; scrollbarLeft: number; scrollbarHeight: number; children: ReactNode }) => (
    <ScrollArea
        orientation="vertical"
        variant="0"
        hideDisabledScrollbar={false}
        layout={{ position: 'absolute', left, top, width, height }}
        viewportLayout={{ position: 'absolute', left: 0, top: 0, width: 121, height: listHeight }}
        scrollbarLayout={{ position: 'absolute', left: scrollbarLeft, top: 0, width: 17, height: scrollbarHeight }}
    >
        <Box layout={{ flexDirection: 'column', width: 121 }}>
            {children}
        </Box>
    </ScrollArea>
);

/**
 * The room settings, on the `ros_room_settings` layout (341x477, frame style 3 tinted
 * `0xff418db0`, content 33 down) - `RoomSettingsCtrl`. The five tabs are `resizeTabs`' width
 * each; every tab's fields sit at the layout's own rects inside `content_container` (10,42):
 * name, description, category, maximum visitors, trade mode, the two tags, walk-through and the
 * delete link on tab 1; the door mode, its password pair and the three pet switches on tab 2
 * (`flexible_content` stacks the group disclaimer over the pets); rights and friends on tab 3;
 * the club look and the idle behaviour on tab 4; the three moderation powers and the ban list on
 * tab 5. The chat mode, bubble and scroll settings moved to the account in this revision, so only
 * the flood sensitivity is left of the chat settings.
 *
 * There is no Save button: `onUnfocus` saves the whole form on every pick and whenever a text
 * field is left, and `TextFieldManager.displayError` tints a refused field and puts
 * `nav_error_popup` over it; everything the save carries, and every rule that refuses it, is
 * Flash's (`RoomSettingsCtrl.save`). The Builders Club panel's `builders_faq_button` sends the
 * `habbopages/builders-club/faq` link, which `openClientLink` only logs until the habbo pages are ported.
 *
 * Theme gap worked around here: a `CheckBox` / `RadioButton` stretches its skin over its box,
 * where Flash draws it `fixed` at the window's top left, so each sits at its natural size in a
 * region of the window's rect. The rights rows' arrows show only on hover; Flash also shows them
 * on every row until the pointer has left it once, which this does not repeat.
 */
export const RoomSettingsView = ({
    settings, categories, controllers, bannedUsers, selectedBannedUser, friends, friendFilter,
    password, passwordConfirm, visitorSteps, selectedVisitors, hasClub, isGroupRoom, canDelete, deleteDisabled, isStaff,
    tab, removeTabsForNavigatorView, error,
    onChangeTab, onChange, onSelectSetting, onSelectBehaviour, onCommit, onChangePassword, onChangePasswordConfirm, onChangeFriendFilter,
    onGiveRights, onTakeRights, onTakeAllRights, onSelectBannedUser, onUnban, onDeleteRoom, onClose,
}: RoomSettingsViewProps) => {
    const t = useTranslation();
    const { send } = useWebSocketContext();
    const imageLibraryUrl = useConfigValue<string>('image.library.url') ?? '';

    // `setTagError`: only the tag input holding the tag the server named is marked.
    const isTagError = (index: number) => (error?.field === 'tags') && !!settings.tags[index]
        && [ settings.tags[index].toLowerCase(), `#${settings.tags[index].toLowerCase()}` ].includes((error.tag ?? '').toLowerCase());
    /** `TextFieldManager.displayError`'s popup over a field, in that field's parent's coordinates. */
    const errorPopup = (field: RoomSettingsErrorField, left: number, top: number, width: number, shown: boolean = error?.field === field) => (shown && error
        ? (
                <NavigatorErrorPopup
                    text={t(error.key)}
                    fieldLeft={left}
                    fieldTop={top}
                    fieldWidth={width}
                />
            )
        : null);

    const visibleTabs = TABS.filter(index => !removeTabsForNavigatorView || ((index !== TAB_ACCESS) && (index !== TAB_RIGHTS)));
    const tabButtonWidth = tabWidth(visibleTabs.length);

    let body: ReactNode = null;

    if (tab === TAB_BASIC) {
        // `setCategorySelection`: the visible non-automatic categories, plus the room's own even when it is hidden.
        const shownCategories = categories.filter(category => (category.visible || (category.nodeId === settings.categoryId)) && !category.automatic);

        body = (
            <Box layout={{ position: 'absolute', left: 6, top: 0, width: 321, height: 360 }}>
                <Label
                    text={t('navigator.roomname')}
                    left={0}
                    top={-3}
                />
                <SettingInput
                    onCommit={onCommit}
                    value={settings.name}
                    error={error?.field === 'name'}
                    onChange={name => onChange({ name })}
                    maxLength={MAX_NAME_LENGTH}
                    left={0}
                    top={14}
                    width={300}
                    height={20}
                />
                <Label
                    text={t('navigator.roomsettings.desc')}
                    left={0}
                    top={35}
                />
                <SettingInput
                    onCommit={onCommit}
                    value={settings.description}
                    error={error?.field === 'description'}
                    onChange={description => onChange({ description })}
                    maxLength={MAX_DESCRIPTION_LENGTH}
                    multiline
                    left={0}
                    top={51}
                    width={300}
                    height={39}
                />
                {errorPopup('name', 0, 14, 300)}
                {errorPopup('description', 0, 51, 300)}
                {/* `tag_category_container` at 0,100. */}
                <Box layout={{ position: 'absolute', left: 0, top: 100, width: 300, height: 192 }}>
                    <Label
                        text={t('navigator.category')}
                        left={0}
                        top={0}
                    />
                    <SettingDropmenu
                        options={shownCategories.map(category => ({ value: category.nodeId, label: flatCategoryName(category, t) }))}
                        value={settings.categoryId}
                        onSelect={categoryId => onSelectSetting({ categoryId })}
                        left={0}
                        top={16}
                        width={300}
                    />
                    <Label
                        text={t('navigator.maxvisitors')}
                        left={0}
                        top={45}
                    />
                    <SettingDropmenu
                        options={visitorSteps.map(step => ({ value: step, label: String(step) }))}
                        value={selectedVisitors}
                        onSelect={maximumVisitors => onSelectSetting({ maximumVisitors })}
                        left={0}
                        top={61}
                        width={300}
                    />
                    <Label
                        text={t('navigator.tradesettings')}
                        left={0}
                        top={90}
                    />
                    <SettingDropmenu
                        options={TRADE_MODES.map(x => ({ value: x.mode, label: t(x.labelKey) }))}
                        value={settings.tradeMode}
                        onSelect={tradeMode => onSelectSetting({ tradeMode })}
                        left={0}
                        top={106}
                        width={300}
                    />
                    <Label
                        text={t('navigator.tags')}
                        left={0}
                        top={138}
                    />
                    {[ ...Array(MAX_TAGS).keys() ].map(index => (
                        <SettingInput
                            onCommit={onCommit}
                            key={index}
                            // `setTag` shows a tag with the hash Flash puts on it; `addTag` takes it off again.
                            value={settings.tags[index] ? `#${settings.tags[index]}` : ''}
                            error={isTagError(index)}
                            onChange={(tag) => {
                                const tags = [ ...settings.tags ];

                                tags[index] = tag.replace(/^#/, '');
                                onChange({ tags });
                            }}
                            maxLength={MAX_TAG_LENGTH + 1}
                            left={index * 149}
                            top={154}
                            width={145}
                            height={15}
                        />
                    ))}
                    {[ ...Array(MAX_TAGS).keys() ].map(index => (
                        <Box key={index}>
                            {errorPopup('tags', index * 149, 154, 145, isTagError(index))}
                        </Box>
                    ))}
                </Box>
                {/* `advanced_container` at 0,253. */}
                <Box layout={{ position: 'absolute', left: 0, top: 253, width: 218, height: 82 }}>
                    <SettingCheckBox
                        checked={settings.allowWalkThrough}
                        onToggle={() => onSelectSetting({ allowWalkThrough: !settings.allowWalkThrough })}
                        left={2}
                        top={59}
                        width={20}
                        height={20}
                    />
                    <Text
                        text={t('navigator.roomsettings.allow_walk_through')}
                        left={18}
                        top={58}
                    />
                </Box>
                {canDelete && (
                    // `remove_link_region`: the link centred on its 180, the icon 15 to the left of it (`prepareWindow`).
                    <Region
                        cursor={deleteDisabled ? undefined : 'pointer'}
                        onPointerTap={deleteDisabled ? undefined : onDeleteRoom}
                        layout={{ position: 'absolute', left: 60, top: 339, width: 180, height: 18, flexDirection: 'row', justifyContent: 'center' }}
                    >
                        <Box layout={{ flexShrink: 0 }}>
                            <Icon
                                variant="9"
                                tintColor="#bb2200"
                                alpha={deleteDisabled ? 0.5 : 1}
                                layout={{ position: 'absolute', left: -15, top: 2 }}
                            />
                            <ThemeText
                                text={t('navigator.roomsettings.delete')}
                                textStyle="u_bold"
                                textOptions={{ fill: '#bb2200' }}
                                flashFormat={{ underline: true }}
                                alpha={deleteDisabled ? 0.5 : 1}
                                verticalAlign="top"
                            />
                        </Box>
                    </Region>
                )}
            </Box>
        );
    }

    if (tab === TAB_ACCESS) {
        const showsPassword = Number(settings.doorMode) === Number(RoomDoorModeEnum.Password);

        body = (
            <Box layout={{ position: 'absolute', left: 6, top: 0, width: 321, height: 366 }}>
                <Box layout={{ position: 'absolute', left: 0, top: 0, width: 321, height: 354 }}>
                    <ThemeText
                        text={t('navigator.roomsettings.roomaccess.caption')}
                        textStyle="u_headline_small"
                        verticalAlign="top"
                        layout={{ position: 'absolute', left: 0, top: 3 }}
                    />
                    <Paragraph
                        text={t('navigator.roomsettings.roomaccess.info')}
                        left={0}
                        top={19}
                        width={310}
                        height={69}
                    />
                    {/* `doormode_container` at 0,87: the selector at 5,18, a 20-high radio per mode. */}
                    <Box layout={{ position: 'absolute', left: 0, top: 87, width: 309, height: 95, overflow: 'hidden' }}>
                        <Label
                            text={t('navigator.roomsettings.doormode')}
                            left={0}
                            top={0}
                        />
                        {DOOR_MODES.map(({ mode }, index) => (
                            <SettingRadioButton
                                key={mode}
                                selected={Number(settings.doorMode) === Number(mode)}
                                onSelect={() => onSelectSetting({ doorMode: mode })}
                                left={5}
                                top={18 + (index * 20)}
                                width={270}
                                height={20}
                            />
                        ))}
                        {DOOR_MODES.map(({ mode, labelKey }, index) => (
                            <Text
                                key={mode}
                                text={t(labelKey)}
                                left={20}
                                top={[ 17, 36, 56, 76 ][index]}
                            />
                        ))}
                    </Box>
                    {/* `changePasswordField`: the pair only exists while the password mode is picked. */}
                    {showsPassword && (
                        <Box layout={{ position: 'absolute', left: 41, top: 188, width: 195, height: 68 }}>
                            <Text
                                text={t('navigator.roomsettings.password')}
                                left={0}
                                top={0}
                            />
                            <SettingInput
                                onCommit={onCommit}
                                value={password}
                                error={error?.field === 'password'}
                                onChange={onChangePassword}
                                maxLength={MAX_TAG_LENGTH}
                                password
                                left={1}
                                top={15}
                                width={193}
                                height={15}
                            />
                            <Text
                                text={t('navigator.roomsettings.passwordconfirm')}
                                left={0}
                                top={32}
                            />
                            <SettingInput
                                onCommit={onCommit}
                                value={passwordConfirm}
                                error={error?.field === 'passwordConfirm'}
                                onChange={onChangePasswordConfirm}
                                maxLength={MAX_TAG_LENGTH}
                                password
                                left={1}
                                top={48}
                                width={193}
                                height={15}
                            />
                            {errorPopup('password', 1, 15, 193)}
                            {errorPopup('passwordConfirm', 1, 48, 193)}
                        </Box>
                    )}
                    {/* `doormode_override_info`: Builders Club took the room out of the navigator; staff are not told. */}
                    {settings.hiddenByBc && !isStaff && (
                        <Border
                            variant="0"
                            layout={{ position: 'absolute', left: 0, top: 88, width: 308, height: 166 }}
                        >
                            <ThemeText
                                text={t('notification.builders_club.room_locked.title')}
                                textStyle="u_headline_small"
                                verticalAlign="top"
                                layout={{ position: 'absolute', left: 5, top: 10 }}
                            />
                            <Paragraph
                                text={t('notification.builders_club.room_locked.message')}
                                left={5}
                                top={42}
                                width={298}
                                height={79}
                            />
                            {/* `onBuildersClubFaqButtonClick`: the `habbopages/builders-club/faq` link. */}
                            <Button
                                variant="3"
                                name="builders_faq_button"
                                onPointerTap={() => openClientLink(send, 'habbopages/builders-club/faq')}
                                layout={{ position: 'absolute', left: 11, top: 122, width: 287, height: 30 }}
                            >
                                {t('notification.builders_club.room_locked.linkTitle')}
                            </Button>
                        </Border>
                    )}
                </Box>
                {/* `flexible_content` at 0,260: the group disclaimer, then the pets. */}
                <Box layout={{ position: 'absolute', left: 0, top: 260, width: 277, flexDirection: 'column' }}>
                    {isGroupRoom && (
                        <Box layout={{ width: 277, height: 30, flexShrink: 0 }}>
                            <Paragraph
                                text={t('navigator.roomsettings.roomaccess.guild.disclaimer')}
                                left={0}
                                top={0}
                                width={277}
                                height={30}
                            />
                        </Box>
                    )}
                    <Box layout={{ width: 218, height: 82, flexShrink: 0 }}>
                        <SettingCheckBox
                            checked={settings.allowPets}
                            onToggle={() => onSelectSetting({ allowPets: !settings.allowPets })}
                            left={3}
                            top={19}
                            width={270}
                            height={20}
                        />
                        <Text
                            text={t('navigator.roomsettings.allowpets')}
                            left={18}
                            top={18}
                        />
                        <SettingCheckBox
                            checked={settings.allowFoodConsume}
                            onToggle={() => onSelectSetting({ allowFoodConsume: !settings.allowFoodConsume })}
                            left={3}
                            top={39}
                            width={270}
                            height={20}
                        />
                        <Text
                            text={t('navigator.roomsettings.allowfoodconsume')}
                            left={18}
                            top={38}
                        />
                        <SettingCheckBox
                            checked={settings.muteAllPets}
                            onToggle={() => onSelectSetting({ muteAllPets: !settings.muteAllPets })}
                            left={3}
                            top={59}
                            width={270}
                            height={20}
                        />
                        <Text
                            text={t('navigator.roomsettings.mute_all_pets')}
                            left={18}
                            top={58}
                        />
                        <Label
                            text={t('navigator.roomsettings.pets')}
                            left={0}
                            top={0}
                        />
                    </Box>
                </Box>
            </Box>
        );
    }

    if (tab === TAB_RIGHTS) {
        // `filter_users_input` narrows both lists as you type; a friend already holding rights drops out.
        const filter = friendFilter.trim().toLowerCase();
        const matches = (name: string) => (!filter.length || name.toLowerCase().includes(filter));
        const friendsWithoutRights = friends.filter(friend => !controllers.some(controller => controller.userId === friend.playerId));
        const shownControllers = controllers.filter(controller => matches(controller.userName));
        const candidates = friendsWithoutRights.filter(friend => matches(friend.name));

        body = (
            <Box layout={{ position: 'absolute', left: 0, top: 0, width: 327, height: 367 }}>
                <Border
                    variant="0"
                    tintColor="#e9e9e1"
                    layout={{ position: 'absolute', left: 0, top: 1, width: 322, height: 42 }}
                >
                    <Label
                        text={t('navigator.flatctrls.filter')}
                        left={6}
                        top={12}
                    />
                    <TextInput
                        value={friendFilter}
                        onChange={onChangeFriendFilter}
                        textStyle="u_regular"
                        flashPlacement
                        border="#000000"
                        backgroundColor="#ffffff"
                        focusedBackgroundColor="#ffffff"
                        layout={{ position: 'absolute', left: 97, top: 8, width: 216, height: 23 }}
                    />
                </Border>
                <Paragraph
                    text={t('navigator.flatctrls.userswithrights', '', { displayed: String(Math.min(shownControllers.length, DISPLAY_LIMIT)), total: String(controllers.length) })}
                    left={0}
                    top={44}
                    width={150}
                    height={34}
                />
                <Paragraph
                    text={t('navigator.flatctrls.friends', '', { displayed: String(Math.min(candidates.length, DISPLAY_LIMIT)), total: String(friendsWithoutRights.length) })}
                    left={175}
                    top={44}
                    width={150}
                    height={34}
                />
                <Border
                    variant="0"
                    backgroundColor="#ffffff"
                    layout={{ position: 'absolute', left: 0, top: 74, width: 150, height: 289 }}
                >
                    <UserList
                        left={4}
                        top={4}
                        width={142}
                        height={247}
                        listHeight={246}
                        scrollbarLeft={125}
                        scrollbarHeight={247}
                    >
                        {shownControllers.slice(0, DISPLAY_LIMIT).map((controller, index) => (
                            <UserRow
                                key={controller.userId}
                                name={controller.userName}
                                index={index}
                                arrow="right"
                                imageLibraryUrl={imageLibraryUrl}
                                onPress={() => onTakeRights(controller.userId)}
                            />
                        ))}
                    </UserList>
                    <ButtonThick
                        variant="3"
                        name="remove_all_flat_ctrls"
                        onPointerTap={onTakeAllRights}
                        layout={{ position: 'absolute', left: 4, top: 256, width: 142, height: 29, minWidth: 142, maxWidth: 142 }}
                    >
                        {t('navigator.flatctrls.clear')}
                    </ButtonThick>
                </Border>
                <Border
                    variant="0"
                    backgroundColor="#ffffff"
                    layout={{ position: 'absolute', left: 173, top: 74, width: 150, height: 289 }}
                >
                    <UserList
                        left={4}
                        top={4}
                        width={142}
                        height={281}
                        listHeight={281}
                        scrollbarLeft={125}
                        scrollbarHeight={281}
                    >
                        {candidates.slice(0, DISPLAY_LIMIT).map((friend, index) => (
                            <UserRow
                                key={friend.playerId}
                                name={friend.name}
                                index={index}
                                arrow="left"
                                imageLibraryUrl={imageLibraryUrl}
                                onPress={() => onGiveRights(friend.playerId)}
                            />
                        ))}
                    </UserList>
                </Border>
            </Box>
        );
    }

    if (tab === TAB_CLUB_AND_CHAT) {
        // `refreshRoomBehaviorSettingsState` / `refreshTimeoutFieldState`: without club the tab is dead, and each timeout only takes input while its switch is on.
        const clubAlpha = hasClub ? 1 : 0.5;

        body = (
            <Box layout={{ position: 'absolute', left: 6, top: 0, width: 322, height: 395 }}>
                <ThemeText
                    text={t('navigator.roomsettings.vip.caption')}
                    textStyle="u_headline_small"
                    verticalAlign="top"
                    layout={{ position: 'absolute', left: 0, top: 3 }}
                />
                <Paragraph
                    text={t('navigator.roomsettings.vip.info')}
                    left={0}
                    top={19}
                    width={310}
                    height={63}
                />
                <Label
                    text={t('navigator.roomsettings.vip_settings')}
                    left={0}
                    top={84}
                />
                <SettingCheckBox
                    checked={settings.hideWalls}
                    disabled={!hasClub}
                    onToggle={() => onSelectSetting({ hideWalls: !settings.hideWalls })}
                    left={0}
                    top={104}
                    width={20}
                    height={20}
                />
                <Text
                    text={t('navigator.roomsettings.hide_walls')}
                    alpha={clubAlpha}
                    left={20}
                    top={103}
                />
                <SettingDropmenu
                    options={THICKNESSES.map(x => ({ value: x.thickness, label: t(`navigator.roomsettings.wall_thickness.${x.suffix}`) }))}
                    value={settings.wallThickness}
                    disabled={!hasClub}
                    onSelect={wallThickness => onSelectSetting({ wallThickness })}
                    left={0}
                    top={125}
                    width={276}
                />
                <SettingDropmenu
                    options={THICKNESSES.map(x => ({ value: x.thickness, label: t(`navigator.roomsettings.floor_thickness.${x.suffix}`) }))}
                    value={settings.floorThickness}
                    disabled={!hasClub}
                    onSelect={floorThickness => onSelectSetting({ floorThickness })}
                    left={0}
                    top={156}
                    width={276}
                />
                <Label
                    text={t('navigator.roomsettings.room_behavior')}
                    left={0}
                    top={191}
                />
                {/* Flash's switch is worded the other way round: ticked means do NOT leave. */}
                <SettingCheckBox
                    checked={!settings.leaveOnDoorTileEnabled}
                    disabled={!hasClub}
                    onToggle={() => onSelectBehaviour({ leaveOnDoorTileEnabled: !settings.leaveOnDoorTileEnabled })}
                    left={0}
                    top={212}
                    width={20}
                    height={20}
                />
                <Text
                    text={t('navigator.roomsettings.do_not_leave_on_door_tile')}
                    alpha={clubAlpha}
                    left={20}
                    top={211}
                />
                <SettingCheckBox
                    checked={settings.idleSleepEnabled}
                    disabled={!hasClub}
                    onToggle={() => onSelectBehaviour({ idleSleepEnabled: !settings.idleSleepEnabled })}
                    left={0}
                    top={234}
                    width={20}
                    height={20}
                />
                <Text
                    text={t('navigator.roomsettings.idle_sleep')}
                    alpha={clubAlpha}
                    left={20}
                    top={233}
                />
                <SettingInput
                    onCommit={onCommit}
                    value={String(settings.idleSleepTimeoutSeconds)}
                    error={error?.field === 'idleSleepTimeout'}
                    onChange={text => onChange({ idleSleepTimeoutSeconds: Number(text.replace(/\D/g, '').slice(0, MAX_TIMEOUT_LENGTH)) || 0 })}
                    maxLength={MAX_TIMEOUT_LENGTH}
                    restrict="0-9"
                    left={24}
                    top={255}
                    width={50}
                    height={20}
                />
                <Text
                    text={t('navigator.roomsettings.timeout.seconds')}
                    alpha={(!hasClub || !settings.idleSleepEnabled) ? 0.5 : 1}
                    left={77}
                    top={257}
                />
                <SettingCheckBox
                    checked={settings.idleAutokickEnabled}
                    disabled={!hasClub}
                    onToggle={() => onSelectBehaviour({ idleAutokickEnabled: !settings.idleAutokickEnabled })}
                    left={0}
                    top={280}
                    width={20}
                    height={20}
                />
                <Text
                    text={t('navigator.roomsettings.idle_autokick')}
                    alpha={clubAlpha}
                    left={20}
                    top={279}
                />
                <SettingInput
                    onCommit={onCommit}
                    value={String(settings.idleAutokickTimeoutSeconds)}
                    error={error?.field === 'idleAutokickTimeout'}
                    onChange={text => onChange({ idleAutokickTimeoutSeconds: Number(text.replace(/\D/g, '').slice(0, MAX_TIMEOUT_LENGTH)) || 0 })}
                    maxLength={MAX_TIMEOUT_LENGTH}
                    restrict="0-9"
                    left={24}
                    top={301}
                    width={50}
                    height={20}
                />
                <Text
                    text={t('navigator.roomsettings.timeout.seconds')}
                    alpha={(!hasClub || !settings.idleAutokickEnabled) ? 0.5 : 1}
                    left={77}
                    top={303}
                />
                <Label
                    text={t('navigator.roomsettings.chat.flood_sensitivity')}
                    left={0}
                    top={335}
                />
                <SettingDropmenu
                    options={FLOOD_SENSITIVITIES.map(x => ({ value: x.sensitivity, label: t(x.labelKey) }))}
                    value={settings.chatFloodSensitivity}
                    onSelect={chatFloodSensitivity => onSelectSetting({ chatFloodSensitivity })}
                    left={0}
                    top={358}
                    width={276}
                />
                {errorPopup('idleSleepTimeout', 24, 255, 50)}
                {errorPopup('idleAutokickTimeout', 24, 301, 50)}
            </Box>
        );
    }

    if (tab === TAB_MODERATION) {
        const levels = (power: 'mute' | 'kick' | 'ban') => moderationLevels(power, isGroupRoom)
            .map(level => ({ value: level, label: t(MODERATION_LABELS[level] ?? '') }));
        // `normalizeSelection`: a level this room cannot offer reads as the first one.
        const normalize = (power: 'mute' | 'kick' | 'ban', value: RoomModerationType) => (moderationLevels(power, isGroupRoom).includes(Number(value))
            ? value
            : RoomModerationType.None);

        body = (
            <Box layout={{ position: 'absolute', left: 0, top: 0, width: 331, height: 367 }}>
                <Paragraph
                    text={t('navigator.roomsettings.moderation.header')}
                    left={6}
                    top={5}
                    width={317}
                    height={37}
                />
                <Label
                    text={t('navigator.roomsettings.moderation.mute.header')}
                    left={7}
                    top={42}
                />
                <Label
                    text={t('navigator.roomsettings.moderation.kick.header')}
                    left={7}
                    top={92}
                />
                <Label
                    text={t('navigator.roomsettings.moderation.ban.header')}
                    left={7}
                    top={142}
                />
                <Border
                    variant="0"
                    layout={{ position: 'absolute', left: 8, top: 200, width: 172, height: 156 }}
                >
                    <ScrollArea
                        orientation="vertical"
                        variant="0"
                        hideDisabledScrollbar={false}
                        layout={{ position: 'absolute', left: 3, top: 3, width: 165, height: 149 }}
                        viewportLayout={{ position: 'absolute', left: 0, top: 1, width: 129, height: 146 }}
                        scrollbarLayout={{ position: 'absolute', left: 146, top: 0, width: 19, height: 149 }}
                    >
                        <Box layout={{ flexDirection: 'column', width: 129 }}>
                            {bannedUsers.slice(0, DISPLAY_LIMIT).map((user, index) => (
                                <UserRow
                                    key={user.userId}
                                    name={user.userName}
                                    index={index}
                                    picked={user.userId === selectedBannedUser}
                                    imageLibraryUrl={imageLibraryUrl}
                                    onPress={() => onSelectBannedUser(user.userId)}
                                />
                            ))}
                        </Box>
                    </ScrollArea>
                </Border>
                <Text
                    text={t('navigator.roomsettings.moderation.banned.users')}
                    left={190}
                    top={236}
                />
                <Button
                    variant="3"
                    name="moderation_unban_btn"
                    onPointerTap={onUnban}
                    // The layout's 257 is not its width: a `button` with no `width_min` / `width_max` sizes to its caption.
                    layout={{ position: 'absolute', left: 190, top: 261, height: 32 }}
                >
                    {t('navigator.roomsettings.moderation.unban')}
                </Button>
                <SettingDropmenu
                    options={levels('mute')}
                    value={normalize('mute', settings.moderation.whoCanMute)}
                    onSelect={whoCanMute => onSelectSetting({ moderation: { ...settings.moderation, whoCanMute } })}
                    left={10}
                    top={61}
                    width={276}
                />
                <SettingDropmenu
                    options={levels('kick')}
                    value={normalize('kick', settings.moderation.whoCanKick)}
                    onSelect={whoCanKick => onSelectSetting({ moderation: { ...settings.moderation, whoCanKick } })}
                    left={10}
                    top={112}
                    width={276}
                />
                <SettingDropmenu
                    options={levels('ban')}
                    value={normalize('ban', settings.moderation.whoCanBan)}
                    onSelect={whoCanBan => onSelectSetting({ moderation: { ...settings.moderation, whoCanBan } })}
                    left={10}
                    top={161}
                    width={276}
                />
            </Box>
        );
    }

    return (
        <Frame
            variant="3"
            id="room-settings"
            caption={t('navigator.roomsettings')}
            tintColor="#418db0"
            dropShadow={{ distance: 4, alpha: 0.35, blur: 4 }}
            onClose={onClose}
            centered
            rememberPosition={false}
            resizeDirection="none"
            margins={[ 0, 33, 0, 3 ]}
            layout={{ position: 'absolute', width: 341, height: 477 }}
        >
            <TabContext
                variant="3"
                name="tab_context"
                layout={{ position: 'absolute', left: -6, top: 3, width: 354, height: 32 }}
            >
                {/*
                  * `habbo_window_layout_tab_context_3`'s own `tab_content`, at y 30 and stretching
                  * with the context: where the context is only as tall as its 32px buttons, the two
                  * rows of it that show are the line across the bottom of the tab strip. The
                  * variant's `minHeight` keeps the band at its own top slice and the context crops
                  * it, rather than squeezing 15 rows of art into 2.
                  */}
                <TabContent
                    variant="3"
                    layout={{ position: 'absolute', left: 0, right: 0, top: 30, bottom: 0, padding: 0, paddingTop: 0, paddingLeft: 0, paddingRight: 0, paddingBottom: 0, marginTop: 0 }}
                />
                {/* The context's `_SELECTOR` (its variant's 8px padding) lines them up, `spacing` 0 - `SelectorListController.updateSelectableRegion`. */}
                {visibleTabs.map(index => (
                    <TabButton
                        key={index}
                        variant="3"
                        selected={tab === index}
                        onPointerTap={() => onChangeTab(index)}
                        layout={{ width: tabButtonWidth, minWidth: tabButtonWidth, maxWidth: tabButtonWidth, height: 32, flexShrink: 0 }}
                    >
                        {t(`navigator.roomsettings.tab.${index}`)}
                    </TabButton>
                ))}
            </TabContext>
            {/*
              * `content_container` and the tab containers draw in the frame's graphic context
              * (`use_parent_graphic_context`), so nothing cuts a tab at the container's 369: tab 4
              * runs to 395 and its flood menu shows in full, clipped only by the frame itself. The box
              * is as tall as that tab rather than the layout's 369: a pointer only reaches a child
              * inside its parent's laid-out box, and Flash hit-tests these against the frame.
              */}
            <Box layout={{ position: 'absolute', left: 10, top: 42, width: 327, height: TALLEST_TAB_HEIGHT }}>
                {body}
            </Box>
        </Frame>
    );
};
