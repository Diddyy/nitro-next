/**
 * `FrameController.resizeToFitContent` on a template's frame window: `WindowController.resizeToAccommodateChildren`
 * of its content area - as wide and high as the right and bottom edges of its visible children
 * reach - which the content area's `reflect_resize_to_parent` passes on to the frame.
 */
import { LayoutWindow } from '#base/theme';

export const resizeFrameToFitContent = (frame: LayoutWindow | undefined) => {
    const content = frame?.children.find(child => child.frameContent);

    if (!content) return;

    let right = -2147483648;
    let bottom = -2147483648;
    let changed = false;

    for (const child of content.children) {
        if (child.visible && ((child.x + child.width) > right)) {
            right = child.x + child.width;
            changed = true;
        }

        if (child.visible && ((child.y + child.height) > bottom)) {
            bottom = child.y + child.height;
            changed = true;
        }
    }

    if (changed) content.setRectangle(content.x, content.y, right, bottom);
};
