/**
 * The room's WIRED leaderboard panels (WIN63-202610131318 `VariableLeaderboardController`'s views):
 * each published leaderboard (`VariableLeaderboardSnapshot`) is drawn over the room - not opened by
 * using its add-on - in a room-scaled window anchored above the location its add-on names.
 *
 * - `synchronizeViews` / `refreshView`: the panel shows the page of the selected variable, "Loading..."
 *   while a chunk the page needs has not come, "No entries" with no variable or no entry
 *   (`getBodyState`), and the pager.
 * - `projectView` (`VariableLeaderboardLocationProjector.project`): the anchor is the location's tile
 *   centre on the floor, `offsetX` room pixels right and `altitude` up, at the room's zoom; the
 *   panel's bottom centre sits on it (`getWindowPosition`), redone on every room frame.
 * - `update`: the times in the rows are told again every 30 s (`refreshRelativeTimes`).
 * - `applyLocationEditVisuals`: while an add-on's editor sets one leaderboard's location, every
 *   other one is faded to 0.35.
 */
import { IRoom, Vector3d } from '@nitrodevco/nitro-api';
import { IVariableLeaderboardDescriptor } from '@nitrodevco/nitro-packets';
import { useEffect, useState } from 'react';

import { openProfile } from '#base/commands';
import { useWebSocketContext } from '#base/context/communication';
import { useRoom } from '#base/context/room';
import { leaderboardPageCount, leaderboardPageRows, leaderboardPageSize, useWiredStore, VariableLeaderboardOverlay } from '#base/context/wired';
import { moveLeaderboardPage, selectLeaderboardVariable } from '#base/handlers';
import { VariableLeaderboardBodyState, VariableLeaderboardView } from '#base/views/room-widgets/variable-leaderboard/VariableLeaderboardView';

import { ScaledRoomOverlay } from '../../overlay';

/** `VariableLeaderboardController.update`: how often the rows' relative times are told again. */
const RELATIVE_TIME_REFRESH_MS = 30000;

/** `VariableLeaderboardView.setLocationEditState`: a leaderboard faded while another one's location is edited. */
const LOCATION_EDIT_BLEND = 0.35;

/**
 * `VariableLeaderboardLocationProjector.project` + `getWindowPosition`: the location's tile centre
 * (`projectTileCenter`, as the room puts a point on screen), moved by `offsetX` and up by
 * `altitude` at the room's zoom; the window's bottom centre on it. Nowhere without a canvas.
 */
const placeAt = (room: IRoom, descriptor: IVariableLeaderboardDescriptor) => (width: number, height: number, scale: number) => {
    const canvas = room.canvas;

    if (!canvas) return null;

    const point = canvas.geometry.getScreenPoint(new Vector3d(descriptor.tileX + 0.5, descriptor.tileY + 0.5, 0));

    if (!point) return null;

    const canvasScale = canvas.isFlipped ? -canvas.scale : canvas.scale;
    const x = (point.x * canvasScale) + ((canvas.width >> 1) * canvasScale) + canvas.screenOffsetX + (descriptor.offsetX * scale);
    const y = (point.y * canvasScale) + ((canvas.height >> 1) * canvasScale) + canvas.screenOffsetY - (descriptor.altitude * scale);

    return { x: x - (width / 2), y: y - height };
};

/** `getBodyState`: no variable or no entry, a chunk the page needs still to come, or the rows. */
const bodyStateOf = (overlay: VariableLeaderboardOverlay, rows: unknown[] | null): VariableLeaderboardBodyState => {
    if (!overlay.selectedVariableId || (overlay.totalCount === 0)) return 2;

    return rows ? 1 : 0;
};

export const VariableLeaderboardWidget = () => {
    const room = useRoom();
    const leaderboards = useWiredStore(x => x.leaderboards);
    const locationEditId = useWiredStore(x => x.leaderboardLocationEditId);
    const { send } = useWebSocketContext();
    // `choice_dropdown`'s `visible`, by leaderboard, and the choice row under the pointer.
    const [ openDropdowns, setOpenDropdowns ] = useState<ReadonlySet<number>>(new Set());
    const [ hoveredChoice, setHoveredChoice ] = useState<{ overlayInstanceId: number; variableId: string } | null>(null);
    const [ now, setNow ] = useState(() => Date.now());

    useEffect(() => {
        if (!leaderboards.length) return;

        const timer = setInterval(() => setNow(Date.now()), RELATIVE_TIME_REFRESH_MS);

        return () => clearInterval(timer);
    }, [ leaderboards.length ]);

    const setDropdown = (overlayInstanceId: number, open: boolean) => setOpenDropdowns((current) => {
        const next = new Set(current);

        if (open) next.add(overlayInstanceId);
        else next.delete(overlayInstanceId);

        return next;
    });

    if (!room) return null;

    return (
        <>
            {leaderboards.map((overlay) => {
                const { descriptor } = overlay;
                const id = descriptor.overlayInstanceId;
                const rows = leaderboardPageRows(overlay);
                const bodyState = bodyStateOf(overlay, rows);
                const totalKnown = (overlay.totalCount !== null) && (overlay.totalCount > 0);
                const pageCount = leaderboardPageCount(overlay);
                const faded = (locationEditId !== null) && (locationEditId !== id);

                return (
                    <ScaledRoomOverlay
                        key={id}
                        place={placeAt(room, descriptor)}
                        alpha={faded ? LOCATION_EDIT_BLEND : 1}
                    >
                        <VariableLeaderboardView
                            descriptor={descriptor}
                            selectedVariableId={overlay.selectedVariableId}
                            bodyState={bodyState}
                            rows={(rows ?? []).slice(0, leaderboardPageSize(descriptor))}
                            page={overlay.page}
                            pageCount={pageCount}
                            canPrevious={totalKnown && (overlay.page > 0)}
                            canNext={totalKnown && ((overlay.page + 1) < pageCount)}
                            now={now}
                            dropdownOpen={openDropdowns.has(id)}
                            hoveredChoice={(hoveredChoice?.overlayInstanceId === id) ? hoveredChoice.variableId : null}
                            onToggleChoices={() => setDropdown(id, !openDropdowns.has(id))}
                            onHoverChoice={variableId => setHoveredChoice(variableId ? { overlayInstanceId: id, variableId } : null)}
                            onSelectChoice={(variableId) => {
                                selectLeaderboardVariable(id, variableId);
                                setDropdown(id, false);
                            }}
                            onPrevious={() => moveLeaderboardPage(id, -1)}
                            onNext={() => moveLeaderboardPage(id, 1)}
                            onProfile={userId => openProfile(send, userId)}
                        />
                    </ScaledRoomOverlay>
                );
            })}
        </>
    );
};
