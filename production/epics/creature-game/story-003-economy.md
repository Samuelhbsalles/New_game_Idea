# Story 003: Economy — sell and buy

> **Epic**: Creature Game
> **Status**: Ready
> **Layer**: Core
> **Type**: Logic
> **Estimate**: M
> **Manifest Version**: N/A (minimal — no control manifest)
> **Last Updated**: [set by /dev-story when implementation begins]

## Context

**GDD**: `design/game-brief.md`
**Requirement**: Brief MVP feature 4

**ADR Governing Implementation**: N/A (minimal — no ADRs)
**ADR Decision Summary**: N/A (minimal — no ADRs)
**ADR Version**: N/A (minimal — no ADRs)

**Engine**: Phaser 3.90.0 | **Risk**: LOW
**Engine Notes**: none (no ADR engine-compatibility analysis at minimal)

**Control Manifest Rules (this layer)**: N/A (minimal — no control manifest)

---

## Acceptance Criteria

*From `design/game-brief.md` (MVP 4; core loop), scoped to this story:*

- [ ] Goods sell at the fixed price in JSON (sold to an NPC, for the prototype). Coins rise by price × quantity.
- [ ] You can't sell more goods than you hold.
- [ ] Bait and food can be bought at JSON prices, only when coins ≥ cost.
- [ ] Coins never go negative. A failed purchase changes nothing.
- [ ] Coins and inventory counts survive save/load.
- [ ] A bare sell/buy UI shows coins, inventory and prices.

---

## Implementation Notes

- The starting coins and inventory come from JSON.
- The game bible leaves "where goods are sold" open (NPC, player market or both). The prototype uses an NPC at a fixed price; keep the sale behind a function so a market can replace it later.

---

## Out of Scope

- Story 004: using food on creatures
- Story 006: using bait to catch

---

## Files

- `src/logic/` (economy)
- `src/data/items.json`
- `tests/unit/logic/story-003-economy.test.ts`

---

## QA Test Cases

*N/A — no qa-lead specs at this tier; implement against the Acceptance Criteria above*

---

## Test Evidence

**Story Type**: Logic
**Required evidence**: `tests/unit/logic/story-003-economy.test.ts` (advisory at `qa.level: minimal`)

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: `production/epics/creature-game/story-001-logic-core.md`, `production/epics/creature-game/story-002-bakery-shifts.md`
- Unlocks: `production/epics/creature-game/story-004-energy.md`, `production/epics/creature-game/story-006-catching.md`
