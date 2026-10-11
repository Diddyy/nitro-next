/**
 * A Flash colour number as the `#rrggbb` string Pixi and canvas take: the low 24 bits, zero padded
 * to six digits, so an `0xAARRGGBB` value loses its alpha byte (read that separately).
 */
export const toCssHexColor = (color: number): string => `#${(color & 0xFFFFFF).toString(16).padStart(6, '0')}`;
