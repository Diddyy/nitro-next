import { Box, Region, ThemeText } from '#base/theme';

/** `FriendCategory.PAGE_SIZE`: friends a category shows at once. */
export const FRIEND_LIST_PAGE_SIZE = 100;

export interface FriendListPagerProps {
    pageCount: number;
    pageIndex: number;
    /** The category row's `color`: each `pagelink` takes it (`FriendListLaf.getRowShadingColor(1, odd)`). */
    color?: string;
    onSelectPage: (pageIndex: number) => void;
}

/**
 * A category's `pager` (`FriendsView.refreshPager`), shown under an open category of two pages or
 * more: one `pagelink` per page (Volter 9, as wide as its text plus 5), laid out left to right in
 * the pager's 190 pixels and wrapped onto 15-pixel rows (`Util.layoutChildrenInArea`). Every link
 * but the current page's is underlined, and each reads its page's full hundred
 * (`(page * 100 + 1) + "-" + (page + 1) * 100`) whatever the category holds.
 */
export const FriendListPager = ({ pageCount, pageIndex, color, onSelectPage }: FriendListPagerProps) => (
    <Region
        name="pager"
        backgroundColor={color}
        layout={{ position: 'relative', width: '100%', flexShrink: 0 }}
    >
        <Box layout={{ position: 'relative', width: 190, flexDirection: 'row', flexWrap: 'wrap' }}>
            {Array.from({ length: pageCount }, (_, page) => (
                <Region
                    key={page}
                    name={`page.${page}`}
                    cursor="pointer"
                    onPointerTap={() => onSelectPage(page)}
                    layout={{ position: 'relative', height: 15, paddingRight: 5 }}
                >
                    <ThemeText
                        text={`${(page * FRIEND_LIST_PAGE_SIZE) + 1}-${(page + 1) * FRIEND_LIST_PAGE_SIZE}`}
                        textOptions={{ fontFamily: 'Volter', fontSize: 9 }}
                        flashFormat={{ underline: page !== pageIndex }}
                        verticalAlign="top"
                    />
                </Region>
            ))}
        </Box>
    </Region>
);
