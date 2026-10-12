/**
 * Not Flash's: Turbo's starter room camera (`starter.rooms`), which `:starterroom add` and
 * `:starterroom picture` open in the room. It works as `RoomThumbnailCameraWidget` does - the
 * viewfinder shows the room stage under it, every frame, and the capture is the render data of the
 * room under it (`SpriteDataCollector`, `buildRenderRoomMessageData`), not its pixels - but its
 * viewfinder is the new user flow's round room picture: 296x284, the white ellipse Turbo draws the
 * picture into marked on it (centred 147.5,142.5, radii 148 x 142, a 10px ring), the corners dimmed.
 * The capture sends both the render data and the camera's own view of the room (a PNG of the room
 * stage under the viewfinder, walls and floors textured as the user sees them); Turbo frames the
 * view (`--frame starter-room --scene`) and draws the furni that break out of the frame from the
 * data, ring, shadow and all.
 *
 * The camera closes when Turbo has drawn the picture, says so when it could not, and closes on its
 * own when the room is left or zoomed out, as the thumbnail camera does.
 */
import { TurboStarterRoomPictureComposer } from '@nitrodevco/nitro-packets';
import { GetRenderer, GetRoomStage, GetTicker, SpriteDataCollector, TextureUtils } from '@nitrodevco/nitro-renderer';
import { Matrix, Rectangle, RenderTexture, Sprite } from 'pixi.js';
import { useEffect, useRef, useState } from 'react';

import { isRoomUnfit } from '#base/commands';
import { useWebSocketContext } from '#base/context/communication';
import { useOnboardingActions, useOnboardingStore } from '#base/context/onboarding';
import { useRoom } from '#base/context/room';
import { useConfigValue, useTranslation } from '#base/context/system';
import { useOwnSecurityLevel } from '#base/context/user';
import { GetSoundManager, HabboSoundTypesEnum } from '#base/sound';
import { Box, Button, Frame, ThemeText } from '#base/theme';
import { buildRenderRoomMessageData } from '#base/utils';

import { GetRoomBackgroundColor } from '../../roomBackgroundColor';

/** The picture's ellipse's bounding box: what is captured. */
const VIEWFINDER_WIDTH = 296;
const VIEWFINDER_HEIGHT = 284;
/** The ellipse in it, and its ring (Turbo's `starter-room` frame, measured from Habbo's pictures). */
const ELLIPSE = { cx: 147.5, cy: 142.5, rx: 148, ry: 142, ring: 10 };

/** The room stage's pixels under the viewfinder, as a PNG; empty when they cannot be read. */
const snapshotScene = async (x: number, y: number): Promise<Uint8Array> => {
    try {
        const { pixels, width, height } = GetRenderer().extract.pixels({ target: GetRoomStage(), frame: new Rectangle(x, y, VIEWFINDER_WIDTH, VIEWFINDER_HEIGHT), resolution: 1 });
        const canvas = document.createElement('canvas');

        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d')?.putImageData(new ImageData(new Uint8ClampedArray(pixels), width, height), 0, 0);

        const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));

        return blob ? new Uint8Array(await blob.arrayBuffer()) : new Uint8Array(0);
    } catch {
        return new Uint8Array(0);
    }
};

const PADDING = 10;
const BUTTON_HEIGHT = 30;
const HINT_HEIGHT = 34;

/** The viewfinder's four corners outside the ellipse, each a polygon: the corner, then the arc back. */
const CORNERS = [ [ 0, 0, Math.PI, 1.5 * Math.PI ], [ VIEWFINDER_WIDTH, 0, 1.5 * Math.PI, 2 * Math.PI ], [ VIEWFINDER_WIDTH, VIEWFINDER_HEIGHT, 0, 0.5 * Math.PI ], [ 0, VIEWFINDER_HEIGHT, 0.5 * Math.PI, Math.PI ] ]
    .map(([ x, y, from, to ]) => {
        const points = [ x, y ];

        for (let step = 0; step <= 24; step++) {
            const angle = from + (((to - from) * step) / 24);

            points.push(ELLIPSE.cx + (ELLIPSE.rx * Math.cos(angle)), ELLIPSE.cy + (ELLIPSE.ry * Math.sin(angle)));
        }

        return points;
    });

export const StarterRoomCameraWidget = () => {
    const camera = useOnboardingStore(x => x.starterRoomCamera);
    const room = useRoom();

    if (!camera || !room || (room.roomId !== camera.roomId)) return null;

    return <StarterRoomCameraView />;
};

const StarterRoomCameraView = () => {
    const t = useTranslation();
    const { send } = useWebSocketContext();
    const room = useRoom();
    const camera = useOnboardingStore(x => x.starterRoomCamera);
    const { setStarterRoomCameraStatus, closeStarterRoomCamera } = useOnboardingActions();
    const securityLevel = useOwnSecurityLevel();
    const imageLibraryUrl = useConfigValue<string>('image.library.url') ?? '';
    const groupBadgeUrl = useConfigValue<string>('group.badge.url') ?? '';
    const [ texture ] = useState(() => RenderTexture.create({ width: VIEWFINDER_WIDTH, height: VIEWFINDER_HEIGHT }));
    const viewfinder = useRef<Sprite>(null);
    const taking = camera?.status === 'taking';

    useEffect(() => () => texture.destroy(true), [ texture ]);

    useEffect(() => {
        if (taking) return;

        const update = () => {
            // The camera works at normal zoom and up, upright - as the thumbnail camera does.
            if (isRoomUnfit()) {
                closeStarterRoomCamera();

                return;
            }

            const sprite = viewfinder.current;

            if (!sprite) return;

            const position = sprite.getGlobalPosition();

            TextureUtils.writeToTexture(GetRoomStage(), texture, true, new Matrix().translate(-position.x, -position.y));
        };

        GetTicker().add(update);

        return () => {
            GetTicker().remove(update);
        };
    }, [ taking, texture, closeStarterRoomCamera ]);

    const capture = async () => {
        GetSoundManager().playSound(HabboSoundTypesEnum.CAMERA_SHUTTER);

        const canvas = room?.canvas;
        const sprite = viewfinder.current;

        if (!room || !canvas || !sprite) return;

        const position = sprite.getGlobalPosition();
        const viewport = new Rectangle(Math.round(position.x), Math.round(position.y), VIEWFINDER_WIDTH, VIEWFINDER_HEIGHT);
        const collector = new SpriteDataCollector(room, canvas, imageLibraryUrl, groupBadgeUrl);
        const sprites = collector.getFurniData(viewport, -1);
        const modifiers = collector.getRoomRenderingModifiers();
        const planes = collector.getRoomPlanes(viewport, GetRoomBackgroundColor());

        setStarterRoomCameraStatus('taking');

        const scene = await snapshotScene(viewport.x, viewport.y);
        const data = await buildRenderRoomMessageData({ planes, sprites, modifiers, roomId: room.roomId, topSecurityLevel: securityLevel, time: Date.now() });

        send(new TurboStarterRoomPictureComposer({ roomId: room.roomId, data, scene }));
    };

    const width = VIEWFINDER_WIDTH + (PADDING * 2);
    const height = VIEWFINDER_HEIGHT + HINT_HEIGHT + BUTTON_HEIGHT + (PADDING * 4) + 30;

    return (
        <Frame
            variant="3"
            id="starter-room-camera"
            caption={t('starterroom.camera.title', 'Starter room picture')}
            onClose={closeStarterRoomCamera}
            centered
            margins={[ 1, 30, 1, 1 ]}
            layout={{ width, height, minWidth: width, minHeight: height }}
        >
            <Box layout={{ position: 'absolute', left: PADDING, top: PADDING, width: VIEWFINDER_WIDTH, height: VIEWFINDER_HEIGHT }}>
                <pixiSprite
                    ref={viewfinder}
                    texture={texture}
                    eventMode="none"
                    layout={false}
                />
                <pixiGraphics
                    eventMode="none"
                    layout={false}
                    draw={(graphics) => {
                        graphics.clear();
                        for (const corner of CORNERS) graphics.poly(corner).fill({ color: 0x000000, alpha: 0.55 });
                        graphics.ellipse(ELLIPSE.cx, ELLIPSE.cy, ELLIPSE.rx - (ELLIPSE.ring / 2), ELLIPSE.ry - (ELLIPSE.ring / 2)).stroke({ width: ELLIPSE.ring, color: 0xffffff });
                    }}
                />
            </Box>
            <Box layout={{ position: 'absolute', left: PADDING, top: VIEWFINDER_HEIGHT + (PADDING * 2), width: VIEWFINDER_WIDTH }}>
                <ThemeText
                    text={(camera?.status === 'failed')
                        ? t('starterroom.camera.failed', 'The picture could not be drawn. Try again.')
                        : t('starterroom.camera.hint', 'Frame the room in the circle (step out of it yourself). Furni at the front may break out of it.')}
                    textStyle="u_regular"
                    textOptions={{ wordWrap: true, wordWrapWidth: VIEWFINDER_WIDTH - 4 }}
                    verticalAlign="top"
                    layout={{ width: VIEWFINDER_WIDTH }}
                />
            </Box>
            <Button
                variant="101"
                name="cancel"
                tintColor="#bbbbbb"
                disabled={taking}
                onPointerTap={closeStarterRoomCamera}
                layout={{ position: 'absolute', left: PADDING, bottom: PADDING, width: 100, height: BUTTON_HEIGHT }}
            >
                {t('generic.cancel', 'Cancel')}
            </Button>
            <Button
                variant="101"
                name="capture"
                tintColor="#bbbbbb"
                disabled={taking}
                onPointerTap={() => void capture()}
                layout={{ position: 'absolute', right: PADDING, bottom: PADDING, width: 140, height: BUTTON_HEIGHT }}
            >
                {taking ? t('starterroom.camera.taking', 'Drawing...') : t('starterroom.camera.capture', 'Take picture')}
            </Button>
        </Frame>
    );
};
