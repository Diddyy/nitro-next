import type { LayoutWindow } from '#base/theme';

/** `breed_pets_preview_bg_png`, 122x130: the backdrop `updatePreviewImage` copies into a plant's or a seed's `preview_image` first. */
export const BREED_PREVIEW_BACKGROUND = 'habbo-room-ui-com-breed_pets_preview_bg';

/**
 * `FrameController.resizeToFitContent`, which the breeding dialogs' `arrangeListItems` ends in:
 * `WindowController.resizeToAccommodateChildren(content)` - the frame's content area made as wide
 * and as high as the right and bottom edges of its children (hidden ones too, as Flash counts every
 * child), the frame following by the content's reflect params, within its own limits.
 */
export const resizeToFitContent = (frame: LayoutWindow | undefined): void => {
    // A frame's first child is its content area (`FrameController.content`), which holds its layout's children.
    const content = frame?.children[0];

    if (!content?.children.length) return;

    let right = Number.MIN_SAFE_INTEGER;
    let bottom = Number.MIN_SAFE_INTEGER;

    for (const child of content.children) {
        right = Math.max(right, child.x + child.width);
        bottom = Math.max(bottom, child.y + child.height);
    }

    content.setWidth(right);
    content.setHeight(bottom);
};
