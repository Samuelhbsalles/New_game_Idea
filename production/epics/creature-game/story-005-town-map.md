# Story 005: Town map and walking

> **Epic**: Creature Game
> **Status**: Ready
> **Layer**: Presentation
> **Type**: Visual/Feel
> **Estimate**: L
> **Manifest Version**: N/A (minimal — no control manifest)
> **Last Updated**: [set by /dev-story when implementation begins]

## Context

**GDD**: `design/game-brief.md`
**Requirement**: Brief MVP feature 1

**ADR Governing Implementation**: N/A (minimal — no ADRs)
**ADR Decision Summary**: N/A (minimal — no ADRs)
**ADR Version**: N/A (minimal — no ADRs)

**Engine**: Phaser 3.90.0 | **Risk**: LOW
**Engine Notes**: none (no ADR engine-compatibility analysis at minimal)

**Control Manifest Rules (this layer)**: N/A (minimal — no control manifest)

---

## Acceptance Criteria

*From `design/game-brief.md` (MVP 1; Art & audio direction), scoped to this story:*

- [ ] A top-down town map on a 32x32 tile grid has three areas: park, bakery and home apartment.
- [ ] The player walks with arrow keys or WASD, collides with walls and props, and the camera follows.
- [ ] Walking into the bakery or home switches to that interior (placeholder room). The bakery slots (story 002) and home rest/feed view (story 004) plug in later.
- [ ] Sprites load by naming convention `<species>_<action>_<dir>_<frame>.png`. A missing file falls back to a colored block and never errors.
- [ ] The map follows art bible Sections 1–4 for placeholder colors (district palettes, creature outline rule).
- [ ] Scenes read game state from `src/logic/` and never own rules.

---

## Implementation Notes

- Colors and palette: `design/art/art-bible.md` Section 4.
- The map data is a JSON tilemap so layouts change without code.

---

## Out of Scope

- Story 006: wild creatures and catching
- Story 002/004: the bakery slot UI and home rest/feed UI inside the interiors
- Mobile layout and touch input (later)

---

## Files

- `src/scenes/` (town, bakery, home)
- `src/render/` (asset loader)
- `public/assets/`

---

## QA Test Cases

*N/A — no qa-lead specs at this tier; implement against the Acceptance Criteria above*

---

## Test Evidence

**Story Type**: Visual/Feel
**Required evidence**: a retained screenshot in `production/qa/evidence/` + sign-off in `production/qa/evidence/story-005-town-map-evidence.md`. Captured manually, since there's no Phaser capture recipe. Not waived at `qa.level: minimal`.

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: `production/epics/creature-game/story-001-logic-core.md`
- Unlocks: `production/epics/creature-game/story-006-catching.md`
