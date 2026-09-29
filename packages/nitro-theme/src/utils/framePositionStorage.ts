const STORAGE_KEY_PREFIX = 'nitro:frame-position:';

export type FramePositionOffset = { dx: number; dy: number };

export const getStoredFramePosition = (id: string): FramePositionOffset | undefined => {
    if (typeof window === 'undefined') return undefined;

    try {
        const raw = window.localStorage.getItem(STORAGE_KEY_PREFIX + id);

        if (!raw) return undefined;

        const parsed = JSON.parse(raw);

        if (typeof parsed?.dx !== 'number' || typeof parsed?.dy !== 'number') return undefined;

        return { dx: parsed.dx, dy: parsed.dy };
    } catch {
        return undefined;
    }
};

export const setStoredFramePosition = (id: string, offset: FramePositionOffset): void => {
    if (typeof window === 'undefined') return;

    try {
        window.localStorage.setItem(STORAGE_KEY_PREFIX + id, JSON.stringify(offset));
    } catch {
        // storage may be unavailable/full — dragging still works, it just won't persist
    }
};
