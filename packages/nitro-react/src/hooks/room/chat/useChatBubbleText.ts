import { useEffect, useMemo } from 'react';

import { ChatBubbleTextRender, renderChatBubbleText } from '#base/chat';
import { destroyOwnedTexture } from '#base/utils';

/**
 * Rasterises a bubble's markup through the Flash text renderer and owns the resulting texture -
 * destroyed when the markup changes or the bubble unmounts. `undefined` for empty markup.
 * `tableTabs` lays `[a]` columns out (`ChatTabLayout`) at the chat font's `fontSizeScale`.
 */
export const useChatBubbleText = (markup: string, fontFace: string, fontSize: number, color: number, wrapWidth: number, tableTabs: boolean = false, fontSizeScale: number = 1): ChatBubbleTextRender | undefined => {
    const render = useMemo(() => renderChatBubbleText(markup, fontFace, fontSize, color, wrapWidth, tableTabs, fontSizeScale), [ markup, fontFace, fontSize, color, wrapWidth, tableTabs, fontSizeScale ]);

    useEffect(() => () => destroyOwnedTexture(render?.texture), [ render ]);

    return render;
};
