/**
 * `performance.now()` for countdowns, refreshed every second: reading the time during render is
 * impure, so a component that counts down reads it through this instead.
 */
import { useSyncExternalStore } from 'react';

import { clockTicker } from '#base/utils';

const TICK_MS = 1000;

/** The clock React reads, updated once a second so the render itself never asks the time. */
const clock = clockTicker(() => performance.now(), TICK_MS);

export const useSecondsClock = () => useSyncExternalStore(clock.subscribe, clock.getSnapshot);
