# Epic: Creature Game

> **Source**: `design/game-brief.md` (workflow: minimal — no GDDs, ADRs or control manifest)
> **Engine**: Phaser 3.90.0 (TypeScript)
> **Created**: 2026-11-04

## Goal

Catch cute creatures with bait, put them to work in city shops on 4-hour shifts, and sell what they make to fill your album.

## Scope (brief MVP)

1. Town map (park, bakery, home) with top-down walking; art loaded by naming convention
2. Catching with bait (100% for common); rabbit, pigeon, cat, monkey
3. Bakery: 6 slots, 4-hour timestamp shift, timer, collect bread
4. Economy: sell goods, buy bait and food
5. Energy: shifts drain it; rest at home or eat
6. Album: silhouettes for uncaught, details for caught
7. Foundation: render-independent logic module, JSON config, swappable storage

## Order

Brief build order, with one change: the town map (MVP 1) moves ahead of catching, because catching needs walking and the park.

## Stories

| # | Story | Type | Status | ADR |
|---|-------|------|--------|-----|
| 001 | Logic core, JSON config and storage | Logic | Ready | N/A (minimal) |
| 002 | Bakery shifts | Logic | Ready | N/A (minimal) |
| 003 | Economy — sell and buy | Logic | Ready | N/A (minimal) |
| 004 | Energy, resting and feeding | Logic | Ready | N/A (minimal) |
| 005 | Town map and walking | Visual/Feel | Ready | N/A (minimal) |
| 006 | Catching in the park | Integration | Ready | N/A (minimal) |
| 007 | Album screen | UI | Ready | N/A (minimal) |
