import type { Shop, Species } from './types';

/**
 * Items one finished shift yields:
 *   round(baseProduction × affinity × shiftHours × rate), at least 1,
 * where affinity is the species' multiplier for this shop (1 when it has none).
 * Source: production/epics/creature-game/story-002-bakery-shifts.md (AC3);
 * `rate` scales the story's formula down to item counts that fit the economy.
 * @example shiftOutput(monkey, bakery); // 10 × 4 × 4 × 0.1 = 16
 */
export function shiftOutput(species: Species, shop: Shop): number {
  const affinity = species.affinities[shop.id] ?? 1;
  return Math.max(1, Math.round(species.baseProduction * affinity * shop.shiftHours * shop.rate));
}
