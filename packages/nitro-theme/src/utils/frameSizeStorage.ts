const STORAGE_KEY_PREFIX = 'nitro:frame-size:';

export type FrameSize = { width: number; height: number };

export const getStoredFrameSize = (id: string): FrameSize | undefined => {
    if (typeof window === 'undefined') return undefined;

    try {
        const raw = window.localStorage.getItem(STORAGE_KEY_PREFIX + id);

        if (!raw) return undefined;

        const parsed = JSON.parse(raw);

        if (typeof parsed?.width !== 'number' || typeof parsed?.height !== 'number') return undefined;

        return { width: parsed.width, height: parsed.height };
    } catch {
        return undefined;
    }
};

export const setStoredFrameSize = (id: string, size: FrameSize): void => {
    if (typeof window === 'undefined') return;

    try {
        window.localStorage.setItem(STORAGE_KEY_PREFIX + id, JSON.stringify(size));
    } catch {
        return;
    }
};

export const clearStoredFrameSize = (id: string): void => {
    if (typeof window === 'undefined') return;

    try {
        window.localStorage.removeItem(STORAGE_KEY_PREFIX + id);
    } catch {
        return;
    }
};
