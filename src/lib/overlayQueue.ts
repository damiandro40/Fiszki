/** Pure helpers used by the modal and notification providers. */
export const appendOverlay = <T>(items: T[], item: T): T[] => [...items, item]

export const removeOverlay = <T extends { id: number }>(items: T[], id: number): T[] =>
  items.filter(item => item.id !== id)

export const latestOverlay = <T>(items: T[]): T | undefined => items.at(-1)

export const enqueueToast = <T>(items: T[], item: T, visibleLimit = 3): T[] =>
  [...items.slice(-Math.max(0, visibleLimit - 1)), item]
