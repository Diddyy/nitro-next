import { TemplateWindow } from '#base/theme';

export interface FurnitureClothingChangeViewProps {
    onSelectGender: (isMale: boolean) => void;
    onClose: () => void;
}

/**
 * Which of the booth's two outfits to dress - `ClothingChangeFurnitureWidget.showGenderSelectionInterface`,
 * which builds the `boygirl` layout and centres it. A clothing booth holds one look for each gender,
 * so this is the only question it asks before handing over to the avatar editor.
 *
 * `onGenderSelectionMouseEvent`: `Boy` requests the editor for `M`, `Girl` for `F`; the frame's close
 * (`findChildByTag("close")`, `onGenderSelectionWindowClose`) only takes the window down.
 */
export const FurnitureClothingChangeView = ({ onSelectGender, onClose }: FurnitureClothingChangeViewProps) => (
    <TemplateWindow
        id="habbo-room-ui-com/boygirl"
        frame={{ id: 'furniture-clothing-change', centered: true, rememberPosition: false, onClose }}
        bindings={{
            Boy: { onPointerTap: () => onSelectGender(true) },
            Girl: { onPointerTap: () => onSelectGender(false) },
        }}
    />
);
