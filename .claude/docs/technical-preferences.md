# Technical Preferences

<!-- project.yaml at the repo root is the machine-readable source of truth for
     engine, specialists, naming, performance, platform, and testing.framework.
     This file is the human-readable LEGACY FALLBACK: agents and skills resolve
     each key from project.yaml first and fall back here only when the
     project.yaml key is absent. /setup-engine dual-writes both.
     Forbidden patterns and allowed libraries are NOT migrated — they live only
     in this file. Populated by /setup-engine; updated as decisions are made. -->

## Engine & Language

- **Engine**: Phaser 3.90.0 (custom web stack — outside the studio's Godot/Unity/Unreal support)
- **Language**: TypeScript 5.9 (Vite 8 build)
- **Rendering**: WebGL (Canvas fallback)
- **Physics**: Arcade Physics

## Input & Platform

<!-- Written by /setup-engine. Read by /ux-design, /ux-review, /test-setup, /team-ui, and /dev-story -->
<!-- to scope interaction specs, test helpers, and implementation to the correct input methods. -->

- **Target Platforms**: Web (desktop browser); mobile browser later
- **Input Methods**: Keyboard/Mouse; Touch later
- **Primary Input**: Keyboard/Mouse
- **Gamepad Support**: None
- **Touch Support**: Partial (mobile layout is out of MVP scope)
- **Platform Notes**: No hover-only interactions, so the later mobile layout doesn't need a redesign.

## Naming Conventions

- **Classes**: PascalCase (e.g., `ShiftTimer`)
- **Variables**: camelCase (e.g., `shiftEndsAt`)
- **Signals/Events**: camelCase event names (e.g., `'shiftCompleted'`)
- **Files**: camelCase source files (e.g., `shiftTimer.ts`); asset files snake_case (e.g., `rabbit_walk_down_01.png`)
- **Scenes/Prefabs**: PascalCase Phaser Scene classes (e.g., `TownScene`)
- **Constants**: SCREAMING_SNAKE (e.g., `SHIFT_LENGTH_MS`)

## Performance Budgets

- **Target Framerate**: 60 fps
- **Frame Budget**: 16.6 ms
- **Draw Calls**: [TO BE CONFIGURED]
- **Memory Ceiling**: [TO BE CONFIGURED]

## Testing

- **Framework**: Vitest — covers the render-independent logic module; Phaser scenes are observed manually
- **Minimum Coverage**: [TO BE CONFIGURED]
- **Required Tests**: Balance formulas, gameplay systems, networking (if applicable)

## Forbidden Patterns

<!-- Add patterns that should never appear in this project's codebase -->
- [None configured yet — add as architectural decisions are made]

## Allowed Libraries / Addons

<!-- Add approved third-party dependencies here -->
- [None configured yet — add as dependencies are approved]

## Architecture Decisions Log

<!-- Quick reference linking to full ADRs in docs/architecture/ -->
- [No ADRs yet — use /architecture-decision to create one]

## Engine Specialists

<!-- Written by /setup-engine when engine is configured. -->
<!-- Read by /code-review, /architecture-decision, /architecture-review, and team skills -->
<!-- to know which specialist to spawn for engine-specific validation. -->

- **Primary**: gameplay-programmer (no Phaser specialist exists)
- **Language/Code Specialist**: gameplay-programmer
- **Shader Specialist**: technical-artist
- **UI Specialist**: ui-programmer
- **Additional Specialists**: lead-programmer (architecture, logic-module boundary)
- **Routing Notes**: Generic agents stand in for engine specialists. Godot/Unity/Unreal specialists must not be spawned for this project.

### File Extension Routing

<!-- Skills use this table to select the right specialist per file type. -->
<!-- If a row says [TO BE CONFIGURED], fall back to Primary for that file type. -->

| File Extension / Type | Specialist to Spawn |
|-----------------------|---------------------|
| Game code (.ts files) | gameplay-programmer |
| Shader / material files (.glsl, .frag) | technical-artist |
| UI / screen files (UI scenes, .css) | ui-programmer |
| Scene / prefab / level files (Phaser Scenes, tilemap .json) | gameplay-programmer |
| Native extension / plugin files | N/A |
| General architecture review | lead-programmer |
