# Story 004: Energy, resting and feeding

> **Epic**: Creature Game
> **Status**: Ready
> **Layer**: Core
> **Type**: Logic
> **Estimate**: M
> **Manifest Version**: N/A (minimal — no control manifest)
> **Last Updated**: [set by /dev-story when implementation begins]

## Context

**GDD**: `design/game-brief.md`
**Requirement**: Brief MVP feature 5

**ADR Governing Implementation**: N/A (minimal — no ADRs)
**ADR Decision Summary**: N/A (minimal — no ADRs)
**ADR Version**: N/A (minimal — no ADRs)

**Engine**: Phaser 3.90.0 | **Risk**: LOW
**Engine Notes**: none (no ADR engine-compatibility analysis at minimal)

**Control Manifest Rules (this layer)**: N/A (minimal — no control manifest)

---

## Acceptance Criteria

*From `design/game-brief.md` (MVP 5; Player goal & fail state: no fail state), scoped to this story:*

- [ ] Each creature has energy (max from JSON). A completed shift drains the JSON cost.
- [ ] A creature without enough energy can't start a shift. It only stops working: it never dies, sickens or leaves.
- [ ] A creature resting at home regains energy over time from timestamps, including while the game is closed, capped at max.
- [ ] Feeding uses one food item and restores the JSON amount at once, capped at max.
- [ ] Feeding with no food in the inventory does nothing.
- [ ] Each creature's state (idle / working / tired / resting) is shown in a bare UI.

---

## Implementation Notes

- The rest rate is a JSON tuning knob. The bible leaves rest time open.

---

## Out of Scope

- Preferred food, levels and variants (game bible, not MVP)

---

## Files

- `src/logic/` (energy)
- `src/data/creatures.json`, `src/data/items.json`
- `tests/unit/logic/story-004-energy.test.ts`

---

## QA Test Cases

*N/A — no qa-lead specs at this tier; implement against the Acceptance Criteria above*

---

## Test Evidence

**Story Type**: Logic
**Required evidence**: `tests/unit/logic/story-004-energy.test.ts` (advisory at `qa.level: minimal`)

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: `production/epics/creature-game/story-002-bakery-shifts.md`, `production/epics/creature-game/story-003-economy.md`
- Unlocks: None
