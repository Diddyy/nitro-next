import { LayoutImage, ModalDialog, TemplateWindow, useTemplateFrame } from '#base/theme';

export interface FurnitureMysteryBoxViewProps {
    /**
     * Whether you are the one who put the box down. The box holder and the key holder see the
     * same dialog with the halves swapped: each waits for what the other has.
     */
    isOwner: boolean;
    onCancel: () => void;
    onClose: () => void;
}

/** A `mysterybox_*` bitmap, as `assetUri` names it - the window manager's art. */
const mysteryBoxImage = (name: string) => LayoutImage(`habbo-window-manager-com/${name}.png`);

/**
 * A mystery box that has been started and is waiting on the other half -
 * `MysteryBoxOpenDialogView.showWaitWindow`, which builds `mystery_box_open_dialog` as a modal dialog
 * (`buildModalDialogFromXML`) and captions the window, `subtitle_text`, `waiting_text` and
 * `cancel_button` from `mysterybox.dialog.owner.*` or `.other.*`, with your half in
 * `reward_base` / `reward_overlay` and the half you wait for in `needed_base` / `needed_overlay`.
 * Nothing here decides anything: the server says when to show it, when to take it away, and what
 * came out.
 *
 * `cancel_button` calls the wait off (`waitWindowProcedure`). Flash sends the cancel for the header
 * close too; the port's header close only closes, as it did before. Flash also tints both `*_base`
 * bitmaps with `MysteryBoxToolbarExtension.KEY_COLORS` of the session's box or key colour, which
 * the port's session does not keep, so they draw in their own colour.
 */
export const FurnitureMysteryBoxView = ({ isOwner, onCancel, onClose }: FurnitureMysteryBoxViewProps) => {
    const frame = useTemplateFrame({ id: 'mystery-box-open-dialog', modal: true, draggable: false, rememberPosition: false, onClose });
    const prefix = isOwner ? 'mysterybox.dialog.owner.' : 'mysterybox.dialog.other.';
    const mine = isOwner ? 'box' : 'key';
    const theirs = isOwner ? 'key' : 'box';

    return (
        <ModalDialog>
            <TemplateWindow
                id="habbo-room-ui-com/mystery_box_open_dialog"
                frame={frame}
                bindings={{
                    '': { caption: `\${${prefix}title}` },
                    subtitle_text: { caption: `\${${prefix}subtitle}` },
                    waiting_text: { caption: `\${${prefix}waiting}` },
                    cancel_button: { caption: `\${${prefix}cancel}`, onPointerTap: onCancel },
                    reward_base: { asset: mysteryBoxImage(`mysterybox_${mine}_base`) },
                    reward_overlay: { asset: mysteryBoxImage(`mysterybox_${mine}_overlay`) },
                    needed_base: { asset: mysteryBoxImage(`mysterybox_${theirs}_base`) },
                    needed_overlay: { asset: mysteryBoxImage(`mysterybox_${theirs}_overlay`) },
                }}
            />
        </ModalDialog>
    );
};
