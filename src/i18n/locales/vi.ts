import type { Copy } from './en';

type DeepPartial<T> = { readonly [K in keyof T]?: DeepPartial<T[K]> };
export type PartialCopy = DeepPartial<Copy>;

/**
 * Vietnamese locale stub (ADR-014). Intentionally empty: missing keys fall
 * back to English, so translating is a data change, not a refactor.
 */
export const vi: PartialCopy = {};
