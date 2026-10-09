import { TemplateWindows } from '#base/theme';

/** `HabboLandingView.positionAfterAndStretch`'s gap between the two windows. */
const GAP = 5;

/**
 * `HabboLandingView.positionAfterAndStretch(container, a, b)`: `b` starts just past `a` - an
 * auto-sized title, so past its text - and keeps its right edge, growing by what it moved left.
 */
export const positionAfterAndStretch = ({ find }: TemplateWindows, first: string, second: string) => {
    const a = find(first);
    const b = find(second);

    if (!a || !b) return;

    const x = a.x + a.width + GAP;

    b.setRectangle(x, b.y, b.width + (b.x - x), b.height);
};
