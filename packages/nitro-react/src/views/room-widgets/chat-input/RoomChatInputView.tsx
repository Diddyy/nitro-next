import { ClubLevelEnum, RoomObjectUserType } from '@nitrodevco/nitro-api';
import { CancelTypingComposer, ChatComposer, ShoutComposer, StartTypingComposer, WhisperComposer } from '@nitrodevco/nitro-packets';
import { Container as PixiContainer } from 'pixi.js';
import { useEffect, useMemo, useRef, useState } from 'react';

import { IChatStyle, isNftChatStyle, isStaticChatStyle } from '#base/chat';
import { requestChatCommandSuggestions, runWiredChatCommand, setChatFontSizeMode, setPreferredChatStyle } from '#base/commands';
import { useWebSocketContext } from '#base/context/communication';
import { roomStore, useRoom, useRoomChatActions, useRoomStore } from '#base/context/room';
import { useConfigValue, useFriendBarWidth, useToolbarAreaWidth, useTranslation } from '#base/context/system';
import { ClientGates, useClientGate, useOwnClubLevel, useOwnIsAmbassador, useRoomToolsCollapsed, useUserStore } from '#base/context/user';
import { useChatStyles, useViewportSize } from '#base/hooks';
import { Border, Box, getGlobalRect, GlobalRect, Icon, LayoutImage, Region, TextInput, ThemeImage, ThemeText } from '#base/theme';
import { completeChatCommand, findInvalidArguments, IChatCommandCompletion, mergeChatCommands } from '#base/utils';
import { roomToolsRight } from '#base/views/room-widgets/room-tools/roomToolsGeometry';

import { ChatCommandSuggestionsView } from './ChatCommandSuggestionsView';
import { chatInputClientCommands } from './chatInputClientCommands';
import { ChatStyleSelectorView } from './ChatStyleSelectorView';

/** `RoomChatInputView.updatePosition` - the gap kept from whatever sits left of the chat bar. */
const LEFT_MARGIN = 12;
/** `bubblecont`, the window `updatePosition` places: 471 wide. */
const BUBBLECONT_WIDTH = 471;
/** The room the centred bar must leave the toolbar's icons on top of its own margin - `updatePosition`'s `+ 100`. */
const TOOLBAR_CLEARANCE = 100;
/** `bubblecont.y`: `height - 104` in the toolbar, `height - 160` above it. */
const BUBBLECONT_FROM_BOTTOM_IN_TOOLBAR = 104;
const BUBBLECONT_FROM_BOTTOM_ABOVE_TOOLBAR = 160;
/** `chat_input_container`'s y in `bubblecont`, and the height of the row it draws (the `styles` region's 39). */
const CHAT_INPUT_CONTAINER_Y = 60;
const CHAT_INPUT_ROW_HEIGHT = 39;
/** The Flash `chat_input` field: Ubuntu 17, 100 characters. */
const MAX_CHARS = 100;
/** `_typingTimer` / `_idleTimer` - typing is announced after a second of it, withdrawn after ten idle. */
const TYPING_DELAY_MS = 1000;
const IDLE_DELAY_MS = 10000;
/** No style picked in this session yet - send whatever the account preference says (`ChatStyleSelector._Str_22824`). */
const NO_STYLE_SELECTED = -1;
/** `input_border`: 11 in, 400 wide - the command list stands on it, as wide. */
const INPUT_BORDER_LEFT = 11;
const INPUT_BORDER_WIDTH = 400;
/** How long typing pauses before the server is asked what to offer (`chat.commands.v2`). */
const SUGGEST_DELAY_MS = 120;
const NO_COMPLETION: IChatCommandCompletion = { suggestions: [], request: null };
/** An argument the server would refuse: the red of the field's own flood warning (`block_text`). */
const INVALID_ARGUMENT_COLOR = '#ff0000';

/**
 * The Flash `RoomChatInputWidget` + `RoomChatInputView` (`chatinput_window_new`): the bar above
 * the toolbar with the style picker on the left and the text field. Typing anywhere focuses it;
 * Enter speaks, Shift+Enter shouts; a leading `:whisper name`, `:shout` or `:speak` picks the
 * mode (Space after `:whisper` fills in the selected avatar's name); typing status is sent
 * after a second and cancelled after ten idle; a flood-control block swaps the field for the
 * countdown; the avatar menu's "whisper" pre-fills the field through the room store.
 *
 * Not Flash's: with a Turbo server's `chat.commands.v2`, a `:command` being typed is completed from
 * the commands the user may use (`ChatCommandSuggestionsView`), with the keys of Habbo's gift
 * window's friend suggestions (`PurchaseConfirmationDialog.onNameInputKeyUp`): Up and Down move
 * the highlight round the list, Enter takes it - when it would change the line; a line already
 * whole is still sent - and Tab always does. Escape puts the list away until the line changes.
 */
export const RoomChatInputView = () => {
    const t = useTranslation();
    const room = useRoom();
    const { send } = useWebSocketContext();
    const floodBlockSeconds = useRoomStore(x => x.floodBlockSeconds);
    const floodBlockStamp = useRoomStore(x => x.floodBlockStamp);
    const allStyles = useChatStyles();
    const { clearChatInputContent } = useRoomChatActions();
    const preferredChatStyle = useUserStore(x => x.preferredChatStyle);
    const chatSizePreference = useUserStore(x => x.chatSizePreference);
    const clubLevel = useOwnClubLevel();
    const isStaff = useClientGate(ClientGates.StaffChatStyles);
    const mayUseWired = useClientGate(ClientGates.WiredMenu);
    const isAmbassador = useOwnIsAmbassador();
    const nftChatStyles = useUserStore(x => x.nftChatStyles);
    const purchasableChatStyles = useUserStore(x => x.purchasableChatStyles);
    const selectedAvatarId = useRoomStore(x => x.selectedAvatarId);
    const selectedAvatarName = useRoomStore(x => x.usersByRoomObjectId[selectedAvatarId]?.name ?? '');
    const customStylesEnabled = useConfigValue<boolean>('custom.chat.styles.enabled') === true;
    const habbiconsEnabled = useConfigValue<boolean>('habbicons.enabled') === true;
    const disabledStyles = useConfigValue<string>('disabled.custom.chat.styles') ?? '';
    const chatCommands = useUserStore(x => x.chatCommands);
    const chatCommandSuggestions = useUserStore(x => x.chatCommandSuggestions);
    const controllerLevel = useRoomStore(x => x.controllerLevel);
    const usersByRoomObjectId = useRoomStore(x => x.usersByRoomObjectId);
    // The bar starts where the room tools end, as `RoomToolsWidget.getWidgetAreaWidth` told it to.
    const roomToolsCollapsed = useRoomToolsCollapsed();
    const { width: viewportWidth, height: viewportHeight } = useViewportSize();
    const toolbarAreaWidth = useToolbarAreaWidth();
    const friendBarWidth = useFriendBarWidth();

    const [ value, setValue ] = useState('');
    const [ cursor, setCursor ] = useState(0);
    const [ replacementCursor, setReplacementCursor ] = useState<number | null>(null);
    const [ selectionRequestId, setSelectionRequestId ] = useState(0);
    const [ focused, setFocused ] = useState(false);
    const [ floodRemaining, setFloodRemaining ] = useState(0);
    // Where the `styles` button is on screen while its menu is open (the menu floats above it), or null while it is shut.
    const [ stylesAnchor, setStylesAnchor ] = useState<GlobalRect | null>(null);
    const stylesButtonRef = useRef<PixiContainer | null>(null);
    const [ selectedStyleId, setSelectedStyleId ] = useState(NO_STYLE_SELECTED);
    const [ highlightIndex, setHighlightIndex ] = useState(0);
    // The suggestions shown last, so the highlight goes back to the top when they change.
    const [ highlightFor, setHighlightFor ] = useState('');
    // The line the command list was put away on (Escape, a click elsewhere); it stays away until the line changes.
    const [ suggestionsDismissedFor, setSuggestionsDismissedFor ] = useState<string | null>(null);

    const isTypingRef = useRef(false);
    const typingStartedSentRef = useRef(false);
    const typingTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const idleTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const lastContentRef = useRef('');
    const valueRef = useRef(value);
    const focusedRef = useRef(focused);
    const onChangeRef = useRef<(next: string) => void>(() => undefined);
    /** The style menu closes on any outside pointerdown - including the one that starts a tap on its own button, which must not reopen it. */
    const stylesClosedAtRef = useRef(0);

    useEffect(() => {
        valueRef.current = value;
        focusedRef.current = focused;
    });

    const roomUserNames = useMemo(() => Object.values(usersByRoomObjectId).filter(x => x.userType === RoomObjectUserType.User).map(x => x.name), [ usersByRoomObjectId ]);

    // The client's own `:words` and, from a Turbo server, the commands it says the user may use.
    const commands = useMemo(() => mergeChatCommands(chatInputClientCommands({
        whisperMode: t('widgets.chatinput.mode.whisper', ':whisper'),
        shoutMode: t('widgets.chatinput.mode.shout', ':shout'),
        speakMode: t('widgets.chatinput.mode.speak', ':speak'),
        whisper: t('widgets.chatinput.command.whisper', 'Whisper to someone in the room'),
        shout: t('widgets.chatinput.command.shout', 'Shout to the whole room'),
        speak: t('widgets.chatinput.command.speak', 'Talk normally'),
        wiredMenu: t('widgets.chatinput.command.wired', 'Open the wired menu'),
        variables: t('widgets.chatinput.command.variables', 'Open the wired variables'),
        inspection: t('widgets.chatinput.command.inspection', 'Open the wired inspection'),
        playTest: t('widgets.chatinput.command.playtest', 'Turn wired play test on or off'),
        wiredReset: t('widgets.chatinput.command.wiredreset', 'Close the wired setup'),
    }, mayUseWired), chatCommands ?? []), [ t, mayUseWired, chatCommands ]);

    const completion = useMemo<IChatCommandCompletion>(() => (focused
        ? completeChatCommand({ text: value, cursor, commands, controllerLevel, roomUserNames, serverValues: chatCommandSuggestions })
        : NO_COMPLETION), [ commands, focused, value, cursor, controllerLevel, roomUserNames, chatCommandSuggestions ]);
    // What the server would refuse, drawn in red as it is typed (`TextField.setTextFormat`).
    const invalidArguments = useMemo(() => findInvalidArguments({ text: value, commands, controllerLevel, roomUserNames })
        .map(x => ({ ...x, color: INVALID_ARGUMENT_COLOR })), [ value, commands, controllerLevel, roomUserNames ]);
    const suggestions = completion.suggestions;
    const suggestionsKey = suggestions.map(x => x.label).join('\n');

    // `updateSuggestions` highlights the first row each time the list is rebuilt.
    if (highlightFor !== suggestionsKey) {
        setHighlightFor(suggestionsKey);
        setHighlightIndex(0);
    }

    const showSuggestions = (suggestions.length > 0) && (suggestionsDismissedFor !== value);
    const selectableSuggestions = suggestions.filter(x => x.replacement !== null).length;
    // The request by its parts: a new object asking the same thing is the same request.
    const requestCommand = completion.request?.command ?? null;
    const requestParameter = completion.request?.parameter ?? -1;
    const requestPrefix = completion.request?.prefix ?? '';
    const requestSyntax = completion.request?.syntax ?? '';
    const requestArgumentText = completion.request?.argumentText ?? '';

    const whisperMode = t('widgets.chatinput.mode.whisper', ':whisper');
    const shoutMode = t('widgets.chatinput.mode.shout', ':shout');
    const speakMode = t('widgets.chatinput.mode.speak', ':speak');
    const isFloodBlocked = floodRemaining > 0;

    /**
     * The styles this user may pick - `RoomChatInputView.createOrUpdateChatStylesView`. System
     * styles never; NFT styles (1000-9999) when the account holds one; the client's own styles
     * (under 1000, not purchasable) for staff when staff-overrideable, for ambassadors and staff
     * when ambassador-only, else unless the config disables them, HC ones only with club; and
     * anything else the account has bought.
     */
    const pickableStyles = useMemo<IChatStyle[]>(() => {
        if (!customStylesEnabled) return [];

        const disabled = disabledStyles.split(',');
        const hasClub = (clubLevel >= ClubLevelEnum.Club);
        const styles: IChatStyle[] = [];

        for (const style of allStyles) {
            const styleId = style.id;

            if (style.isSystemStyle) continue;

            if (isNftChatStyle(styleId)) {
                if (nftChatStyles.includes(styleId)) styles.push(style);

                continue;
            }

            if (isStaticChatStyle(styleId) && !style.isPurchasable) {
                if (style.isStaffOverrideable && isStaff) {
                    styles.push(style);
                    continue;
                }

                if (style.isAmbassadorOnly && (isStaff || isAmbassador)) {
                    styles.push(style);
                    continue;
                }

                if (disabled.includes(String(styleId))) continue;

                if ((style.isHcOnly && hasClub) || (!style.isHcOnly && !style.isAmbassadorOnly)) {
                    styles.push(style);
                    continue;
                }
            }

            if (purchasableChatStyles.includes(styleId)) styles.push(style);
        }

        return styles;
    }, [ allStyles, customStylesEnabled, disabledStyles, isStaff, clubLevel, isAmbassador, nftChatStyles, purchasableChatStyles ]);

    const sendTypingStatus = () => {
        if (isFloodBlocked) return;

        send(isTypingRef.current ? new StartTypingComposer({}) : new CancelTypingComposer({}));
    };

    const clearTimers = () => {
        if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
        if (idleTimerRef.current) clearTimeout(idleTimerRef.current);

        typingTimerRef.current = undefined;
        idleTimerRef.current = undefined;
    };

    const onTypingTimer = () => {
        if (isTypingRef.current) typingStartedSentRef.current = true;

        sendTypingStatus();
    };

    const onIdleTimer = () => {
        if (isTypingRef.current) typingStartedSentRef.current = false;

        isTypingRef.current = false;

        sendTypingStatus();
    };

    /** `_Str_14673` - the field changed. */
    const onChange = (next: string) => {
        if (idleTimerRef.current) clearTimeout(idleTimerRef.current);

        if (!next.length) {
            isTypingRef.current = false;

            if (typingTimerRef.current) clearTimeout(typingTimerRef.current);

            typingTimerRef.current = setTimeout(onTypingTimer, TYPING_DELAY_MS);
        } else {
            if (!isTypingRef.current) {
                isTypingRef.current = true;

                if (typingTimerRef.current) clearTimeout(typingTimerRef.current);

                typingTimerRef.current = setTimeout(onTypingTimer, TYPING_DELAY_MS);
            }

            idleTimerRef.current = setTimeout(onIdleTimer, IDLE_DELAY_MS);
        }

        lastContentRef.current = next;
        setReplacementCursor(null);
        setValue(next);
    };

    useEffect(() => {
        onChangeRef.current = onChange;
    });

    const toggleStyles = () => {
        if (!pickableStyles.length) return;

        if ((Date.now() - stylesClosedAtRef.current) < 250) return;

        const button = stylesButtonRef.current;

        setStylesAnchor((stylesAnchor || !button) ? null : getGlobalRect(button));
    };

    const closeStyles = () => {
        stylesClosedAtRef.current = Date.now();
        setStylesAnchor(null);
    };

    /** `_Str_21815` - Enter. */
    const sendChat = (shout: boolean) => {
        const text = valueRef.current;

        if (!room || !text.length || isFloodBlocked) return;

        const parts = text.split(' ');
        let mode: 'speak' | 'shout' | 'whisper' = shout ? 'shout' : 'speak';
        let recipient = '';
        let remainder = '';

        switch (parts[0]) {
            case whisperMode:
                mode = 'whisper';
                recipient = parts[1] ?? '';
                remainder = `${whisperMode} ${recipient} `;
                parts.shift();
                parts.shift();
                break;
            case shoutMode:
                mode = 'shout';
                parts.shift();
                break;
            case speakMode:
                mode = 'speak';
                parts.shift();
                break;
        }

        const message = parts.join(' ');

        let styleId = preferredChatStyle;

        if (customStylesEnabled && (selectedStyleId !== NO_STYLE_SELECTED)) {
            // `ChatInputWidgetHandler`: `freeFlowChat.preferedChatStyle = styleId`, which sends the font size mode with it.
            if (selectedStyleId !== preferredChatStyle) setPreferredChatStyle(send, selectedStyleId);

            styleId = selectedStyleId;
        }

        clearTimers();

        // `ChatInputWidgetHandler`: a chat command is run, not said.
        const isCommand = (mode !== 'whisper') && runWiredChatCommand(send, message);

        if (message.length && !isCommand) {
            const cleaned = message.replace(/&#[0-9]+;/g, '');

            switch (mode) {
                case 'speak':
                    send(new ChatComposer({ text: cleaned, styleId }));
                    break;
                case 'shout':
                    send(new ShoutComposer({ text: cleaned, styleId }));
                    break;
                case 'whisper':
                    send(new WhisperComposer({ recipientName: recipient, text: cleaned, styleId }));
                    break;
            }
        }

        isTypingRef.current = false;

        if (typingStartedSentRef.current) sendTypingStatus();

        typingStartedSentRef.current = false;
        lastContentRef.current = remainder;
        setReplacementCursor(null);
        setValue(remainder);
    };

    /** A suggestion taken: the line becomes what it completes to, and the field keeps the keyboard. */
    const takeSuggestion = (index: number) => {
        const replacement = suggestions[index]?.replacement;

        if (replacement === null || replacement === undefined) return;

        const next = replacement;
        const nextCursor = suggestions[index]?.replacementCursor ?? next.length;
        onChange(next);
        setReplacementCursor(nextCursor);
        setSelectionRequestId(current => current + 1);
    };

    /** `highlightSuggestion`: wraps past either end of the list. */
    const moveHighlight = (step: number) => {
        let next = highlightIndex + step;

        if (next < 0) next = suggestions.length - 1;
        if (next >= suggestions.length) next = 0;

        setHighlightIndex(next);
    };

    /** `onNameInputKeyUp`, on the chat field: the command list's keys, before the field's own. */
    const onSuggestionKey = (event: KeyboardEvent): boolean => {
        if (!showSuggestions || !selectableSuggestions) {
            if (showSuggestions && (event.key === 'Escape')) {
                setSuggestionsDismissedFor(valueRef.current);

                return true;
            }

            return false;
        }

        switch (event.key) {
            case 'ArrowUp':
                moveHighlight(-1);
                return true;
            case 'ArrowDown':
                moveHighlight(1);
                return true;
            case 'Tab':
                takeSuggestion(highlightIndex);
                return true;
            case 'Enter': {
                // A line that taking the row would not change goes as it is.
                const replacement = suggestions[highlightIndex]?.replacement;

                if (!replacement || (replacement.trim() === valueRef.current.trim()) || event.shiftKey) return false;

                takeSuggestion(highlightIndex);
                return true;
            }
            case 'Escape':
                setSuggestionsDismissedFor(valueRef.current);
                return true;
        }

        return false;
    };

    /** `_Str_10572` - Space autocompletes the whisper target, Backspace clears a bare `:whisper name `. */
    const onKeyDown = (event: KeyboardEvent): boolean | void => {
        if (onSuggestionKey(event)) return true;

        const current = valueRef.current;

        if (event.key === ' ') {
            if ((current === whisperMode) && selectedAvatarName.length) {
                onChange(`${whisperMode} ${selectedAvatarName} `);

                return true;
            }
        }

        if (event.key === 'Backspace') {
            const parts = current.split(' ');

            if ((parts[0] === whisperMode) && (parts.length === 3) && (parts[2] === '')) {
                onChange('');

                return true;
            }
        }

        return undefined;
    };

    // Flood control: swap the field for the countdown until the server's seconds have passed.
    useEffect(() => {
        if (!floodBlockSeconds || !floodBlockStamp) return;

        const endsAt = floodBlockStamp + (floodBlockSeconds * 1000);
        const tick = () => setFloodRemaining(Math.max(0, Math.ceil((endsAt - Date.now()) / 1000)));

        tick();

        const interval = setInterval(tick, 1000);

        return () => clearInterval(interval);
    }, [ floodBlockSeconds, floodBlockStamp ]);

    /*
     * The avatar menu asked us to whisper to someone (`RoomWidgetUpdateChatInputContentEvent`).
     * It is a one-off request rather than state to render, so it is taken as the store announces
     * it and cleared straight away.
     */
    useEffect(() => roomStore.subscribe(({ chatInputContent }) => {
        if (!chatInputContent) return;

        const prefix = (chatInputContent.mode === 'whisper') ? whisperMode : shoutMode;
        const next = `${prefix} ${chatInputContent.userName.length ? `${chatInputContent.userName} ` : ''}`;

        setReplacementCursor(null);
        setValue(next);
        lastContentRef.current = next;
        setFocused(true);
        clearChatInputContent();
    }), [ whisperMode, shoutMode, clearChatInputContent ]);

    // `focus_capturer`: typing anywhere while nothing else has the keyboard starts a message.
    useEffect(() => {
        const onWindowKeyDown = (event: KeyboardEvent) => {
            if (focusedRef.current || isFloodBlocked) return;

            if ((event.key.length !== 1) || event.ctrlKey || event.metaKey || event.altKey) return;

            const active = document.activeElement;

            if (active && ((active.tagName === 'INPUT') || (active.tagName === 'TEXTAREA') || (active as HTMLElement).isContentEditable)) return;

            // Other Pixi text inputs claim their keys with `preventDefault` - let them run first.
            setTimeout(() => {
                if (event.defaultPrevented || focusedRef.current) return;

                setFocused(true);
                onChangeRef.current(valueRef.current.length < MAX_CHARS ? valueRef.current + event.key : valueRef.current);
            }, 0);
        };

        window.addEventListener('keydown', onWindowKeyDown);

        return () => window.removeEventListener('keydown', onWindowKeyDown);
    }, [ isFloodBlocked ]);

    useEffect(() => () => clearTimers(), []);

    // What only the server knows is asked for once typing pauses; the answer lands in the user store.
    useEffect(() => {
        if (requestCommand === null) return;

        const timer = setTimeout(() => requestChatCommandSuggestions(send, requestCommand, requestParameter, requestPrefix, requestSyntax, requestArgumentText), SUGGEST_DELAY_MS);

        return () => clearTimeout(timer);
    }, [ send, requestCommand, requestParameter, requestPrefix, requestSyntax, requestArgumentText ]);

    if (!room) return null;

    /*
     * `RoomChatInputView.updatePosition`: `bubblecont` sits centred in the toolbar when the
     * toolbar's icons and the friend bar leave it the room; otherwise it moves up to
     * `height - 160` and starts right of the room tools - still centred if the centre is clear of
     * them. The row drawn here is its `chat_input_container`, 60 down.
     */
    const centredLeft = ~~((viewportWidth / 2) - (BUBBLECONT_WIDTH / 2));
    const fitsInToolbar = ((viewportWidth - toolbarAreaWidth - friendBarWidth) > (BUBBLECONT_WIDTH + LEFT_MARGIN))
        && (centredLeft >= (toolbarAreaWidth + LEFT_MARGIN + TOOLBAR_CLEARANCE))
        && ((centredLeft + BUBBLECONT_WIDTH) <= (viewportWidth - friendBarWidth));
    const left = fitsInToolbar ? centredLeft : Math.max(centredLeft, roomToolsRight(roomToolsCollapsed) + LEFT_MARGIN);
    const bottom = (fitsInToolbar ? BUBBLECONT_FROM_BOTTOM_IN_TOOLBAR : BUBBLECONT_FROM_BOTTOM_ABOVE_TOOLBAR) - CHAT_INPUT_CONTAINER_Y - CHAT_INPUT_ROW_HEIGHT;

    return (
        <Box layout={{ position: 'absolute', left, bottom, width: BUBBLECONT_WIDTH, height: CHAT_INPUT_ROW_HEIGHT }}>
            <Border
                variant="8"
                name="input_border"
                tintColor="#e5e5e5"
                layout={{ position: 'absolute', left: 11, width: 400, top: 0, height: 38 }}
            >
                {isFloodBlocked && (
                    <ThemeText
                        name="block_text"
                        text={t('chat.input.alert.flood', 'You are talking too fast. Wait %time% seconds.', { time: String(floodRemaining) })}
                        textOptions={{ fill: '#ff0000', fontFamily: 'Ubuntu', fontSize: 14 }}
                        flashFormat={{ bold: true, antiAliasType: 'advanced' }}
                        clip
                        verticalAlign="top"
                        layout={{ position: 'absolute', left: 10, width: 325, top: 9, height: 23 }}
                    />
                )}
                {!isFloodBlocked && (
                    <TextInput
                        value={value}
                        onChange={onChange}
                        onSelectionChange={(_start, end) => {
                            if (end !== cursor) setSuggestionsDismissedFor(null);
                            setCursor(end);
                        }}
                        selectionAfterChange={replacementCursor}
                        selectionRequestId={selectionRequestId}
                        onEnter={event => sendChat(event.shiftKey)}
                        onKeyDown={onKeyDown}
                        marks={invalidArguments}
                        focused={focused}
                        onFocusChange={setFocused}
                        placeholder={t('widgets.chatinput.default')}
                        placeholderColor="#777777"
                        maxLength={MAX_CHARS}
                        fontFamily="Ubuntu"
                        fontSize={17}
                        // `chat_input`'s own `antialias_type` var. Without it the field falls back
                        // to `regular`'s `normal`, which the exact renderer has only for the
                        // Volter faces - so Ubuntu 17 dropped to the browser's canvas text.
                        flashFormat={{ antiAliasType: 'advanced' }}
                        textColor="#000000"
                        flashPlacement
                        alwaysShowSelection
                        backgroundColor={null}
                        focusedBackgroundColor={null}
                        layout={{ position: 'absolute', left: 50, width: 326, top: 7, height: 24 }}
                    />
                )}
            </Border>
            <Region
                ref={stylesButtonRef}
                name="styles"
                onPointerTap={toggleStyles}
                cursor="pointer"
                layout={{ position: 'absolute', left: 0, width: 60, top: 0, height: 39 }}
            >
                <ThemeImage
                    name="style_bg"
                    src={LayoutImage('habbo-window-manager-com/common_chat_style_block.png')}
                    bitmap={{ stretchedX: false, stretchedY: false, fitSizeToContents: true }}
                    layout={{ position: 'absolute', left: 0, top: 0 }}
                />
                <ThemeImage
                    name="style_icon"
                    src={LayoutImage('habbo-window-manager-com/common_chat_styles.png')}
                    bitmap={{ stretchedX: false, stretchedY: false, pivot: 'center', etchingColor: 0x48000000, fitSizeToContents: true }}
                    dynamicRole="icon"
                    layout={{ position: 'absolute', left: 25, top: 10 }}
                />
                <Icon
                    variant="7"
                    dynamicStyle="brightness_and_shadow_under"
                    tintColor="#4c4c4c"
                    layout={{ position: 'absolute', left: 10, width: 10, top: 17, height: 5 }}
                />
                {stylesAnchor && (
                    <ChatStyleSelectorView
                        anchor={stylesAnchor}
                        styles={pickableStyles}
                        selectedStyleId={selectedStyleId}
                        // `gridItemWindowProc` only selects: the menu stays open until a click lands
                        // outside it (`hideIfClickAway`).
                        onSelect={styleId => setSelectedStyleId(styleId)}
                        fontSizeMode={chatSizePreference}
                        onSelectFontSize={mode => setChatFontSizeMode(send, mode)}
                        onClose={closeStyles}
                    />
                )}
            </Region>
            {showSuggestions && !isFloodBlocked && (
                <ChatCommandSuggestionsView
                    x={left + INPUT_BORDER_LEFT}
                    bottom={viewportHeight - bottom - CHAT_INPUT_ROW_HEIGHT}
                    width={INPUT_BORDER_WIDTH}
                    suggestions={suggestions}
                    highlightIndex={highlightIndex}
                    onHover={setHighlightIndex}
                    onSelect={(index) => {
                        takeSuggestion(index);
                        setFocused(true);
                    }}
                    onClose={() => setSuggestionsDismissedFor(value)}
                />
            )}
            {/*
              * `chat_extra_button` opens the habbicon selector, which is not ported. Flash shows it
              * only under `habbicons.enabled` (`RoomChatInputView.habbiconsEnabled`). Its
              * `chat_extra_set_icon` starts hidden (`createWindow`) and is left out.
              */}
            {habbiconsEnabled && (
                <Region
                    name="chat_extra_button"
                    dynamicStyle="lifted_hover"
                    layout={{ position: 'absolute', left: 427, width: 41, top: 0, height: 38 }}
                >
                    <Region
                        dynamicRole="icon"
                        layout={{ position: 'absolute', left: 0, width: 41, top: 0, height: 38 }}
                    >
                        <ThemeImage
                            name="chat_extra_bg"
                            src={LayoutImage('habbo-window-manager-com/habbicons_sticky_note.png')}
                            bitmap={{ stretchedX: false, stretchedY: false, etchingColor: 0x48000000, fitSizeToContents: true }}
                            layout={{ position: 'absolute', left: 0, top: 0 }}
                        />
                        <ThemeImage
                            name="chat_extra_icon"
                            src={LayoutImage('habbo-window-manager-com/habbicons_clip.png')}
                            bitmap={{ stretchedX: false, stretchedY: false, pivot: 'center', etchingColor: 0x48000000, fitSizeToContents: true }}
                            layout={{ position: 'absolute', left: 23, top: 2 }}
                        />
                        <ThemeImage
                            name="chat_extra_bg"
                            src={LayoutImage('habbo-window-manager-com/habbicons_sticky_note2.png')}
                            bitmap={{ stretchedX: false, stretchedY: false, etchingColor: 0x48000000, fitSizeToContents: true }}
                            layout={{ position: 'absolute', left: 24, top: 26 }}
                        />
                    </Region>
                </Region>
            )}
        </Box>
    );
};
