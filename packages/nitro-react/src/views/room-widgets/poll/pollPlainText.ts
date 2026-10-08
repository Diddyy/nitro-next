/**
 * A poll's `htmlText` (`PollOfferDialog`'s headline and summary) as the plain text a template text
 * window takes: `<br>` and a closing `</p>` break the line, other tags are dropped and the common
 * entities read as their characters. A template text binding has no `htmlText`, so the markup's
 * styling (bold, colour) is lost; the words and lines stay.
 */
const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: '\'', nbsp: ' ' };

export const pollPlainText = (html: string) => html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&(amp|lt|gt|quot|apos|nbsp);/g, (_, name: string) => ENTITIES[name])
    .replace(/\n+$/, '');
