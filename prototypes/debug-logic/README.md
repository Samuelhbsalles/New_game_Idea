# PROTOTYPE - NOT FOR PRODUCTION: debug-logic

**Hypothesis:** the story 001 logic core (timestamp shifts, save/load, corrupt-save recovery) behaves correctly in a real browser, with real localStorage and reloads, and not only in the unit tests.

**How to run:** `npm run dev`, then open http://localhost:5173/prototypes/debug-logic/

**Try:**
1. Click "Work at Bakery" on the rabbit. A shift starts and saves.
2. Click "+4 h". The shift shows Complete? YES.
3. Instead of step 2, click "Reload page" after starting a shift. The shift is still there (save/load).
4. Fast-forward, then reload. It's still complete (offline progress).
5. "Corrupt the save + reload": a fresh game, no crash.

**Notes:**
- It imports from `src/logic/` and `src/data/` on purpose: it exists to drive the real logic. Nothing in `src/` imports from here.
- It uses its own localStorage keys (`creatureGame.debug.*`), so it never touches the real game's save.
- Not built by `npm run build`, since only the root `index.html` is a build entry.
- It doesn't collect bread or free slots: that's story 002.

**Status:** in-progress

**Findings:** [fill in after trying it]
