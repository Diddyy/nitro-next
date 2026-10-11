/**
 * `HabboWebTools.openWebPageAndMinimizeClient`: a web page in a new browser tab, the client left as
 * it is (a browser tab cannot minimise its window). An empty url opens nothing.
 */
export const openWebPage = (url: string) => {
    if (url.length) window.open(url, '_blank', 'noopener');
};
