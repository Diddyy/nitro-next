/**
 * The messenger's message field - the window manager's `IlluminaInputWidget`, drawn from its
 * `illumina_input` layout at the messenger's `input_widget` size (232 wide, single line): a style
 * 105 border, the input, the grey `empty_message` while it is empty, and the `submit` button
 * (`widgets.chatinput.say`, the widget's default caption, which the messenger does not replace).
 * The button follows the right edge (its `params`), and the input fills what is left of it
 * (`refresh`: the button's x less the input's margin on both sides). Enter or the button submits;
 * the handler clears it (`MainView.onInput` sets `message = ""`).
 *
 * Only the messenger's use of the widget is carried: `multiline`, a custom `buttonCaption` and the
 * `properties` API are not set by any messenger layout or code, so they are not props here.
 */
import { useState } from 'react';

import { useTranslation } from '#base/context/system';
import { Border, Button, TextInput, ThemeText } from '#base/theme';

/** `illumina_input`: 244 wide, the button at 165 - so 79 from the right edge - and the input at 5. */
const LAYOUT_WIDTH = 244;
const BUTTON_X = 165;
const INPUT_X = 5;
const HEIGHT = 28;
/** The submit button fitted to its default caption (`widgets.chatinput.say`): caption plus 2 x 24px margins. */
const SAY_BUTTON_WIDTH = 67;
/** `empty_message`'s `0x888888`. */
const EMPTY_COLOR = '#888888';

export interface MessengerInputProps {
    width: number;
    emptyMessage: string;
    maxChars: number;
    onSubmit: (message: string) => void;
}

export const MessengerInput = ({ width, emptyMessage, maxChars, onSubmit }: MessengerInputProps) => {
    const t = useTranslation();
    const [ message, setMessage ] = useState('');
    // Where the right-following button starts: the input stops short of it (`refresh`).
    const buttonX = width + (BUTTON_X + 86 - LAYOUT_WIDTH) - SAY_BUTTON_WIDTH;
    const submit = () => {
        onSubmit(message);
        setMessage('');
    };

    return (
        <Border
            variant="105"
            layout={{ width, height: HEIGHT }}
        >
            {!message.length && (
                <ThemeText
                    text={emptyMessage}
                    textStyle="il_regular"
                    textOptions={{ fill: EMPTY_COLOR }}
                    layout={{ position: 'absolute', left: 6, top: 5 }}
                />
            )}
            <TextInput
                value={message}
                onChange={value => setMessage(value.slice(0, maxChars))}
                onEnter={submit}
                maxLength={maxChars}
                textStyle="il_regular"
                backgroundColor={null}
                focusedBackgroundColor={null}
                flashPlacement
                layout={{ position: 'absolute', left: INPUT_X, top: 5, width: buttonX - (INPUT_X * 2), height: 17 }}
            />
            <Button
                name="submit"
                variant="101"
                tintColor="#bbbbbb"
                onPointerTap={submit}
                // Flash sizes it to its caption: "Say" (~19px of `il_button`) plus the style's 24px
                // margins either side, 67 wide (a 45px face, as the official client draws it), 42 high;
                // its right edge 7px past the widget's, as in the layout - it follows the right edge.
                layout={{ position: 'absolute', right: -(BUTTON_X + 86 - LAYOUT_WIDTH), top: -7, width: SAY_BUTTON_WIDTH, minWidth: SAY_BUTTON_WIDTH, height: 42, minHeight: 42, maxHeight: 42 }}
            >
                {t('widgets.chatinput.say')}
            </Button>
        </Border>
    );
};
