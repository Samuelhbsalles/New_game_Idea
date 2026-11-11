# Story 006: Catching in the park

> **Epic**: Creature Game
> **Status**: Ready
> **Layer**: Feature
> **Type**: Integration
> **Estimate**: M
> **Manifest Version**: N/A (minimal — no control manifest)
> **Last Updated**: [set by /dev-story when implementation begins]

## Context

**GDD**: `design/game-brief.md`
**Requirement**: Brief MVP feature 2

**ADR Governing Implementation**: N/A (minimal — no ADRs)
**ADR Decision Summary**: N/A (minimal — no ADRs)
**ADR Version**: N/A (minimal — no ADRs)

**Engine**: Phaser 3.90.0 | **Risk**: LOW
**Engine Notes**: none (no ADR engine-compatibility analysis at minimal)

**Control Manifest Rules (this layer)**: N/A (minimal — no control manifest)

---

## Acceptance Criteria

*From `design/game-brief.md` (MVP 2; core loop), scoped to this story:*

- [ ] Wild rabbit, pigeon, cat and monkey appear in the park, with species and spawn rules from JSON.
- [ ] Using bait near a wild common creature catches it 100% of the time (chance from JSON).
- [ ] One bait is consumed per catch attempt.
- [ ] With no bait, a catch can't be attempted, and the UI says so.
- [ ] A caught creature joins the player's roster, can be placed at the bakery, and survives save/load.
- [ ] A first catch of a species marks it caught for the album (story 007).

---

## Implementation Notes

- Capture rules live in `src/logic/`. The park scene only calls them.
- Keep the catch chance in data, so rare creatures with a fail chance can be added later.

---

## Out of Scope

- Per-species bait (game bible), legendary minigame, rare variants

---

## Files

- `src/logic/` (capture)
- `src/scenes/` (park)
- `src/data/creatures.json`
- `tests/integration/catching/story-006-catching.test.ts`

---

## QA Test Cases

*N/A — no qa-lead specs at this tier; implement against the Acceptance Criteria above*

---

## Test Evidence

**Story Type**: Integration
**Required evidence**: `tests/integration/catching/story-006-catching.test.ts` or a documented playtest (advisory at `qa.level: minimal`)

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: `production/epics/creature-game/story-003-economy.md`, `production/epics/creature-game/story-005-town-map.md`
- Unlocks: `production/epics/creature-game/story-007-album.md`
