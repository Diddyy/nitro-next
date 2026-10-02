import { useUserStore } from '../../useUserStore';

/**
 * The friends the friend bar shows, in its order - `HabboFriendBarData.getFriendAt`: the online
 * friends as `friendBarIds` lists them (see `friendBarOrder`). A group chat's entry (negative id)
 * gets no tab: `HabboFriendBarView.populateFriendEntities` allocates tabs only for `id > 0`.
 */
export const useFriendBarFriends = () => {
    const ids = useUserStore(x => x.friendBarIds);
    const friends = useUserStore(x => x.friends);

    return ids.map(id => friends[id]).filter(friend => !!friend && (friend.playerId > 0));
};
