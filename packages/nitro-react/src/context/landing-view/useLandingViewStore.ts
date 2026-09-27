import { useStore } from 'zustand';

import { LandingViewStore, landingViewStore } from './store/LandingViewStore';

/**
 * A slice of the LandingViewStore, re-rendering only when that slice changes. It reads the
 * app-wide singleton, so it works anywhere - there is no provider to be inside. Select one field
 * per call, never an object literal.
 */
export function useLandingViewStore<T>(selector: (state: LandingViewStore) => T) {
    return useStore(landingViewStore, selector);
}
