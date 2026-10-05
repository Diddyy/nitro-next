/**
 * `nav_error_popup` as `TextFieldManager.displayError` places it: a style 0 border around the
 * message (`error_text` at 8,4, Volter 9, black) with `popup_arrow_down` under it, the whole thing
 * centred on the refused field and standing on its top edge (`y = field.y - height + 3`). The popup
 * is 33 high as laid out; its width follows the text (`textWidth + 5`, the border 15 more).
 *
 * Give it the field's rect in the coordinates of the field's parent - Flash adds the popup to the
 * field's own parent.
 */
import { Border, LayoutImage, Region, ThemeImage, ThemeText } from '#base/theme';

/** `nav_error_popup`'s `popup_container` height. */
const POPUP_HEIGHT = 33;

export interface NavigatorErrorPopupProps {
    text: string;
    /** The refused field's rect, in its parent's coordinates. */
    fieldLeft: number;
    fieldTop: number;
    fieldWidth: number;
}

export const NavigatorErrorPopup = ({ text, fieldLeft, fieldTop, fieldWidth }: NavigatorErrorPopupProps) => (
    <Region
        name="popup_container"
        layout={{ position: 'absolute', left: fieldLeft, width: fieldWidth, top: fieldTop - POPUP_HEIGHT + 3, height: POPUP_HEIGHT, flexDirection: 'column', alignItems: 'center' }}
    >
        <Border
            variant="0"
            name="border"
            layout={{ height: 23, paddingLeft: 8, paddingRight: 8, paddingTop: 4 }}
        >
            <ThemeText
                text={text}
                textStyle="regular"
                textOptions={{ fontFamily: 'Volter', fontSize: 9, fill: '#000000' }}
                verticalAlign="top"
            />
        </Border>
        <ThemeImage
            name="popup_arrow_down"
            src={LayoutImage('habbo-navigator-com/popup_arrow_down.png')}
            bitmap={{}}
            layout={{ width: 11, height: 11, marginTop: -1 }}
        />
    </Region>
);
