/** AS3 quest `ProgressBar` (layout `ProgressBar`, 300x23): framed track, animated fill and centred text. */
import { useEffect, useRef, useState } from 'react';

import { LayoutImage, Region, ThemeImage, ThemeText } from '#base/theme';

interface AchievementProgressBarProps {
    x: number;
    y: number;
    /** `_progressBarWidth`. */
    width: number;
    /** `refresh` arguments: current and maximum amount, the level key and `scoreAtStartOfLevel`. */
    current: number;
    max: number;
    levelKey: number;
    scoreAtStartOfLevel: number;
    /** Builds the caption from the progress and limit `ProgressBar.updateView` registers. */
    caption: (progress: number, limit: number) => string;
}

/** `ProgressBar.getProgressWidth`. */
const progressWidth = (width: number, amount: number, max: number) => (max > 0 ? Math.max(0, Math.round((width * amount) / max)) : 0);

export const AchievementProgressBar = ({ x, y, width, current, max, levelKey, scoreAtStartOfLevel, caption }: AchievementProgressBarProps) => {
    const target = progressWidth(width, current, max);
    const [ shown, setShown ] = useState(target);
    const [ start, setStart ] = useState(target);
    const previous = useRef({ levelKey, max });
    const shownRef = useRef(shown);

    useEffect(() => {
        shownRef.current = shown;
    });

    useEffect(() => {
        // `refresh`: a new level or maximum jumps to the target; otherwise the bar animates from where it is.
        const reset = previous.current.levelKey !== levelKey || previous.current.max !== max;

        previous.current = { levelKey, max };

        if (reset) {
            setShown(target);
            setStart(target);

            return undefined;
        }

        setStart(shownRef.current);

        let frame = 0;
        let last = performance.now();
        let currentWidth = shownRef.current;
        const step = (now: number) => {
            // `updateView`: `max(1, dt / 32 * round(sqrt(|distance|)))` pixels a frame.
            const distance = target - currentWidth;
            const pixels = Math.max(1, ((now - last) / 32) * Math.round(Math.sqrt(Math.abs(distance))));

            last = now;
            currentWidth = distance > 0 ? Math.min(target, currentWidth + pixels) : Math.max(target, currentWidth - pixels);
            setShown(currentWidth);

            if (currentWidth !== target) frame = requestAnimationFrame(step);
        };

        if (currentWidth !== target) frame = requestAnimationFrame(step);

        return () => cancelAnimationFrame(frame);
    }, [ target, levelKey, max ]);

    const animating = shown !== target;
    const blend = animating && target !== start ? Math.min(1, Math.max(0, 1 - ((target - shown) / (target - start)))) : 1;
    const progress = animating ? Math.round((shown / width) * max) : current;

    return (
        <Region layout={{ position: 'absolute', left: x, top: y, width: width + 10, height: 23 }}>
            <ThemeImage
                src={LayoutImage('shared/achievement_ach_progressbar1.png')}
                bitmap={{}}
                layout={{ position: 'absolute', left: 0, top: 0, width: 4, height: 23 }}
            />
            <ThemeImage
                src={LayoutImage('shared/achievement_ach_progressbar2.png')}
                bitmap={{}}
                layout={{ position: 'absolute', left: 4, top: 0, width, height: 23 }}
            />
            <ThemeImage
                src={LayoutImage('shared/achievement_ach_progressbar3.png')}
                bitmap={{}}
                layout={{ position: 'absolute', left: width + 4, top: 0, width: 4, height: 23 }}
            />
            <Region
                backgroundColor="#ffff00"
                layout={{ position: 'absolute', left: 4, top: 3, width: shown + 1, height: 17 }}
            />
            <ThemeImage
                src={LayoutImage('shared/achievement_ach_progressbar4.png')}
                bitmap={{}}
                alpha={blend}
                layout={{ position: 'absolute', left: 4, top: 3, width: shown, height: 17 }}
            />
            <ThemeImage
                src={LayoutImage('shared/achievement_ach_progressbar5.png')}
                bitmap={{}}
                alpha={blend}
                layout={{ position: 'absolute', left: shown + 4, top: 3, width: 1, height: 17 }}
            />
            <ThemeText
                text={caption(progress + scoreAtStartOfLevel, max + scoreAtStartOfLevel)}
                textOptions={{ fill: '#ffffff', fontFamily: 'Ubuntu', fontSize: 12, align: 'center' }}
                flashFormat={{ bold: true, antiAliasType: 'advanced' }}
                verticalAlign="top"
                layout={{ position: 'absolute', left: 7, width, top: 3 }}
            />
        </Region>
    );
};
