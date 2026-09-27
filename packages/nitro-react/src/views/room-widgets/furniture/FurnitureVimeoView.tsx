import { useState } from 'react';

import { useTranslation } from '#base/context/system';
import { Border, Frame, Region, TextInput, ThemeText } from '#base/theme';

/** `vimeo_viewer`'s `video_id` input as the layout leaves it - `createWindow` never overwrites it. */
const DEFAULT_VIDEO_ID_INPUT = '40036380';

export interface FurnitureVimeoViewProps {
    /** The video on the screen; 0 for none. */
    videoId: number;
    /** `hasSecurity(5)`: staff get the `video_id_editor` over the picture. */
    canEdit: boolean;
    /** Enter in the id input: the new id, already the number `int(caption)` makes of it. */
    onSetVideo: (videoId: number) => void;
    onClose: () => void;
}

/**
 * A Vimeo screen, on the `vimeo_viewer` layout (451x356, style 3, no caption) that
 * `VimeoDisplayWidget.createWindow` builds and centres: the black `video_background` with its
 * centred `no_videos_label`, and for staff the `video_id_editor` strip across its top, whose
 * Enter sets the screen's video.
 *
 * The video itself is not played. Flash put a `VimeoPlayer` in `video_wrapper` over the label,
 * shown while the id is above 0; the port draws into one Pixi canvas with no DOM to embed a player
 * in, so - as `FurnitureYoutubeView` does - the label names the id of the video in place of the
 * player, and says there is none when there is not. The window keeps its opening size: Flash's is
 * resizable (minimum 400x350), which only mattered for the player's size.
 */
export const FurnitureVimeoView = ({ videoId, canEdit, onSetVideo, onClose }: FurnitureVimeoViewProps) => {
    const t = useTranslation();
    const [ videoIdInput, setVideoIdInput ] = useState(DEFAULT_VIDEO_ID_INPUT);

    return (
        <Frame
            variant="3"
            id="vimeo_viewer"
            tintColor="#67a3bf"
            dropShadow={{ distance: 4, alpha: 0.35, blur: 4 }}
            onClose={onClose}
            centered
            rememberPosition={false}
            resizeDirection="none"
            margins={[ 3, 36, 3, 3 ]}
            layout={{ width: 451, height: 356 }}
        >
            <Region
                name="video_background"
                backgroundColor="#000000"
                layout={{ position: 'absolute', left: 7, right: 7, top: 6, bottom: 9, alignItems: 'center', justifyContent: 'center' }}
            >
                <ThemeText
                    text={(videoId > 0) ? String(videoId) : t('widget.furni.video_viewer.no_videos')}
                    textStyle="il_regular_white"
                    verticalAlign="top"
                />
            </Region>
            {canEdit && (
                <Border
                    variant="3"
                    name="video_id_editor"
                    layout={{ position: 'absolute', left: 12, right: 12, top: 12, height: 19 }}
                >
                    <ThemeText
                        text="Video id:"
                        textStyle="u_bold"
                        verticalAlign="top"
                        layout={{ position: 'absolute', left: 1, top: 1 }}
                    />
                    <TextInput
                        value={videoIdInput}
                        onChange={setVideoIdInput}
                        onEnter={() => onSetVideo(parseInt(videoIdInput, 10) | 0)}
                        textStyle="u_regular"
                        flashPlacement
                        restrict="0123456789"
                        backgroundColor={null}
                        focusedBackgroundColor={null}
                        layout={{ position: 'absolute', left: 53, right: 2, top: 1, height: 17 }}
                    />
                </Border>
            )}
        </Frame>
    );
};
