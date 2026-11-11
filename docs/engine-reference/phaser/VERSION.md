# Phaser — Version Reference

| Field | Value |
|-------|-------|
| **Engine Version** | Phaser 3.90.0 (final 3.x release) |
| **Installed at pin time** | npm package, installed per project via `npm install`; Node 26.13.0 / npm 11.20.0 on the dev machine |
| **Release Date** | 2025-05-23 (npm registry) |
| **Project Pinned** | 2026-11-04 |
| **Last Docs Verified** | 2026-11-04 (npm registry dist-tags and publish times) |
| **LLM Knowledge Cutoff** | June 2026 |
| **Knowledge Risk** | LOW — 3.90.0 predates the cutoff and the 3.x line is frozen |

## Toolchain pins

| Package | Pinned | Notes |
|---------|--------|-------|
| phaser | 3.90.0 | Phaser 4 is current (4.0.0 on 2026-04-10, 4.2.1 on 2026-07-09); 3.x was chosen deliberately |
| vite | 8.3.5 | latest at pin time |
| vitest | 5.1.0 | latest at pin time |
| typescript | 5.9.3 | 7.0.2 is latest; 5.9 was chosen for stability |

## Not supported by the studio

Phaser is not one of the studio's engines (Godot/Unity/Unreal). There are no
Phaser specialist agents, no `run-and-observe.md` recipe, and engine-specific
skill branches won't match `engine.name: Phaser`. Treat any skill output that
assumes another engine as NOT ASSESSED for this project.

## Upgrade path to Phaser 4

The game logic lives in a render-independent module, so a move to Phaser 4
only touches scene and rendering code. Check the Phaser 4 migration guide
before upgrading. It is not covered here.
