import { RoomControllerLevelEnum } from '@nitrodevco/nitro-api';

import { useOwnIsAnyRoomController } from '#base/context/user';

import { useRoomStore } from '../../useRoomStore';

export const useRoomCanDecorate = () => {
    const controllerLevel = useRoomStore(x => x.controllerLevel);
    const isRoomOwner = useRoomStore(x => x.isRoomOwner);
    const isAnyRoomController = useOwnIsAnyRoomController();

    return isRoomOwner || isAnyRoomController || controllerLevel > RoomControllerLevelEnum.Guest;
};
