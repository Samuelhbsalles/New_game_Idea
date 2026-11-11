# Story 007: Album screen

> **Epic**: Creature Game
> **Status**: Ready
> **Layer**: Presentation
> **Type**: UI
> **Estimate**: S
> **Manifest Version**: N/A (minimal — no control manifest)
> **Last Updated**: [set by /dev-story when implementation begins]

## Context

**GDD**: `design/game-brief.md`
**Requirement**: Brief MVP feature 6

**ADR Governing Implementation**: N/A (minimal — no ADRs)
**ADR Decision Summary**: N/A (minimal — no ADRs)
**ADR Version**: N/A (minimal — no ADRs)

**Engine**: Phaser 3.90.0 | **Risk**: LOW
**Engine Notes**: none (no ADR engine-compatibility analysis at minimal)

**Control Manifest Rules (this layer)**: N/A (minimal — no control manifest)

---

## Acceptance Criteria

*From `design/game-brief.md` (MVP 6; Player goal: collect every species), scoped to this story:*

- [ ] The album lists every species defined in JSON.
- [ ] Uncaught species show as a flat Ink Plum silhouette with "?" (art bible Section 4).
- [ ] Caught species show their sprite, name and shop affinity.
- [ ] The album shows a progress count (caught / total).
- [ ] A species caught in story 006 appears as caught the next time the album opens, and after reload.
- [ ] The album opens and closes from the town without losing game state.

---

## Implementation Notes

- Album layout and colors: art bible Sections 2 and 4 (Paper Cream page, plum silhouettes).

---

## Out of Scope

- Album hints for uncaught species and album-page rewards (game bible, not MVP)

---

## Files

- `src/scenes/` (album)

---

## QA Test Cases

*N/A — no qa-lead specs at this tier; implement against the Acceptance Criteria above*

---

## Test Evidence

**Story Type**: UI
**Required evidence**: a retained screenshot of the album in `production/qa/evidence/` (captured manually). Not waived at `qa.level: minimal`.

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: `production/epics/creature-game/story-006-catching.md`
- Unlocks: None
