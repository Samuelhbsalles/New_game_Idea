// PROTOTYPE - NOT FOR PRODUCTION
// Throwaway debug page for story 001. Not part of the game; not in the build.
import creatures from '../../src/data/creatures.json';
import items from '../../src/data/items.json';
import shops from '../../src/data/shops.json';
import start from '../../src/data/start.json';
import type { Clock } from '../../src/logic/clock';
import { parseConfig } from '../../src/logic/config';
import { Game } from '../../src/logic/game';
import { LocalStorageAdapter } from '../../src/logic/localStorageAdapter';

const SAVE_KEY = 'creatureGame.debug.save';
const OFFSET_KEY = 'creatureGame.debug.clockOffset';
const LOG_KEY = 'creatureGame.debug.log';

// A clock that runs at real speed but can be pushed forward. The offset is kept
// across reloads, so "fast-forward, then reload" behaves like being away that long.
let offsetMs = Number(localStorage.getItem(OFFSET_KEY) ?? 0) || 0;
const clock: Clock = { now: () => Date.now() + offsetMs };

const config = parseConfig({ species: creatures, shops, items, start });
const storage = new LocalStorageAdapter(SAVE_KEY, localStorage);
const hadSave = localStorage.getItem(SAVE_KEY) !== null;
const game = Game.load(config, clock, storage);

const $ = (id: string) => document.getElementById(id)!;
const fmtTime = (ms: number) => new Date(ms).toLocaleString();
const fmtDur = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 3600)}h ${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}m ${String(s % 60).padStart(2, '0')}s`;
};

function log(msg: string): void {
  const lines: string[] = JSON.parse(sessionStorage.getItem(LOG_KEY) ?? '[]');
  lines.unshift(`[${new Date().toLocaleTimeString()}] ${msg}`);
  sessionStorage.setItem(LOG_KEY, JSON.stringify(lines.slice(0, 30)));
  renderLog();
}

function renderLog(): void {
  const lines: string[] = JSON.parse(sessionStorage.getItem(LOG_KEY) ?? '[]');
  $('log').innerHTML = lines.map((l) => `<div>${l}</div>`).join('');
}

function speciesName(id: string): string {
  return config.species.find((s) => s.id === id)?.name ?? id;
}

function render(): void {
  const now = clock.now();
  $('real').textContent = fmtTime(Date.now());
  $('game').textContent = fmtTime(now);
  $('offset').textContent = fmtDur(offsetMs);

  const shopButtons = (creatureId: string) =>
    config.shops
      .map((shop) => `<button data-start="${creatureId}" data-shop="${shop.id}">Work at ${shop.name}</button>`)
      .join('');
  $('creatures').innerHTML =
    '<tr><th>Id</th><th>Species</th><th>Energy</th><th>Status</th><th></th></tr>' +
    game.state.creatures
      .map(
        (c) =>
          `<tr><td>${c.id}</td><td>${speciesName(c.speciesId)}</td><td>${c.energy}</td>` +
          `<td class="${c.status}">${c.status}</td><td>${c.status === 'working' ? '' : shopButtons(c.id)}</td></tr>`,
      )
      .join('');

  $('shifts').innerHTML = game.state.shifts.length
    ? '<tr><th>Shop</th><th>Slot</th><th>Creature</th><th>Started</th><th>Ends</th><th>Time left</th><th>Complete?</th></tr>' +
      game.state.shifts
        .map((s) => {
          const done = game.isShiftComplete(s.shopId, s.slot);
          return (
            `<tr><td>${s.shopId}</td><td>${s.slot}</td><td>${s.creatureId}</td>` +
            `<td>${fmtTime(s.startedAt)}</td><td>${fmtTime(s.endsAt)}</td>` +
            `<td>${done ? '—' : fmtDur(s.endsAt - now)}</td>` +
            `<td class="${done ? 'done' : 'working'}">${done ? 'YES' : 'no'}</td></tr>`
          );
        })
        .join('')
    : '<tr><td>No shifts yet. Start one from the Creatures table.</td></tr>';

  $('state').textContent = JSON.stringify(game.state, null, 2);
}

document.body.addEventListener('click', (e) => {
  const el = e.target as HTMLElement;
  if (el.dataset.start) {
    const shopId = el.dataset.shop!;
    const slot = game.state.shifts.filter((s) => s.shopId === shopId).length;
    game.startShift(el.dataset.start, shopId, slot);
    game.save();
    log(`Started shift: ${el.dataset.start} at ${shopId}, slot ${slot}. Saved.`);
  } else if (el.dataset.ff) {
    offsetMs += Number(el.dataset.ff);
    localStorage.setItem(OFFSET_KEY, String(offsetMs));
    log(`Clock fast-forwarded to +${fmtDur(offsetMs)}.`);
  } else if (el.id === 'ff-reset') {
    offsetMs = 0;
    localStorage.setItem(OFFSET_KEY, '0');
    log('Clock offset reset to 0.');
  } else if (el.id === 'save') {
    game.save();
    log('Saved.');
  } else if (el.id === 'reload') {
    log('Reloading…');
    location.reload();
  } else if (el.id === 'corrupt') {
    localStorage.setItem(SAVE_KEY, '{ this is not valid json');
    log('Save corrupted. Reloading — expect a fresh game, no crash.');
    location.reload();
  } else if (el.id === 'wipe') {
    localStorage.removeItem(SAVE_KEY);
    localStorage.setItem(OFFSET_KEY, '0');
    offsetMs = 0;
    log('Save deleted. Reloading — expect a fresh game.');
    location.reload();
  }
  render();
});

log(hadSave ? `Loaded save (${game.state.shifts.length} shift(s)).` : 'No save found — started a fresh game.');
render();
setInterval(render, 1000);
