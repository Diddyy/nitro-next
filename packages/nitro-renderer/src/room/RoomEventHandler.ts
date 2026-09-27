import {
    IEventDispatcher,
    IRoom,
    IRoomEventHandler,
    IRoomObject,
    IRoomObjectEvent,
    IRoomSpriteMouseEvent,
    RoomObjectCategoryEnum,
    type RoomObjectEvent, RoomObjectFurniIconAssetEvent, RoomSpriteMouseEvent } from '@nitrodevco/nitro-api';

import { GetFurniIconImageManager } from './FurniIconImageManager';
import { RoomEnterEffect } from './utils';

/**
 * The engine's end of Flash `RoomObjectEventHandler`: room object events and canvas mouse events
 * pass through here on their way to the UI, which holds the rest of that class
 * (`RoomEventHandler.tsx`, `useRoomEventHandler`). What is decided here is what Flash decided
 * before looking at the event at all - the head of `processRoomCanvasMouseEvent` - and the one
 * request the engine answers without the UI, a furni asking for another furni's icon.
 */
export class RoomEventHandler implements IRoomEventHandler {
    private _roomObjectEventHandler: ((event: RoomObjectEvent) => void) | undefined = undefined;
    private _roomCanvasMouseHandler: ((event: RoomSpriteMouseEvent, object: IRoomObject) => void) | undefined = undefined;

    constructor(private _room: IRoom) { }

    public handleRoomObjectEvent(event: RoomObjectEvent): void {
        if (!event) return;

        // `RoomObjectEventHandler.handleObjectFurniIconAssetEvent`: Flash's room engine answered this itself.
        if (event instanceof RoomObjectFurniIconAssetEvent && event.type === RoomObjectFurniIconAssetEvent.LOAD_FURNI_ICON) {
            const object = this._room.getRoomObject(event.objectId, this._room.getRoomObjectCategoryForType(event.objectType));

            if (object) GetFurniIconImageManager().requestFurniIconAsset(object, event.wallItem, event.typeId, event.extra);

            return;
        }

        if (!this._roomObjectEventHandler) return;

        this._roomObjectEventHandler(event);
    }

    public handleRoomCanvasMouseEvent(event: RoomSpriteMouseEvent, object: IRoomObject): void {
        if (!event || !object || RoomEnterEffect.isRunning() || !this._roomCanvasMouseHandler) return;

        if (this.isClickThrough(object)) return;

        this._roomCanvasMouseHandler(event, object);
    }

    /**
     * `RoomEngine.setClickSettings`: every mouse event of a click-through category is dropped, not
     * only clicks, and before the object can claim the event id - so the canvas's next hit, the
     * furni or tile behind, is the one that handles it.
     */
    private isClickThrough(object: IRoomObject): boolean {
        if (!this._room.clickThroughUsers && !this._room.clickThroughFurni) return false;

        switch (this._room.getRoomObjectCategoryForType(object.type)) {
            case RoomObjectCategoryEnum.Unit:
                return this._room.clickThroughUsers;
            case RoomObjectCategoryEnum.Floor:
            case RoomObjectCategoryEnum.Wall:
                return this._room.clickThroughFurni;
        }

        return false;
    }

    public setRoomObjectEventHandler(handler: ((event: IRoomObjectEvent) => void) | undefined): void {
        this._roomObjectEventHandler = handler;
    }

    public setRoomCanvasMouseHandler(handler: ((event: IRoomSpriteMouseEvent, object: IRoomObject) => void) | undefined): void {
        this._roomCanvasMouseHandler = handler;
    }

    public get eventDispatcher(): IEventDispatcher {
        return this._room.eventDispatcher;
    }
}
