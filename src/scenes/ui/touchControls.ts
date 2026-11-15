import ui from '../../data/ui.json';
import touchJson from '../../data/touch.json';
import { stickDirs, type StickDir } from '../../logic/touchStick';

/** Browser key codes the game already listens to (Phaser reads keyCode). */
const KEYS: Record<StickDir | 'action' | 'menu' | 'map', { key: string; code: string; keyCode: number }> = {
  up: { key: 'ArrowUp', code: 'ArrowUp', keyCode: 38 },
  down: { key: 'ArrowDown', code: 'ArrowDown', keyCode: 40 },
  left: { key: 'ArrowLeft', code: 'ArrowLeft', keyCode: 37 },
  right: { key: 'ArrowRight', code: 'ArrowRight', keyCode: 39 },
  action: { key: 'e', code: 'KeyE', keyCode: 69 },
  menu: { key: 'Escape', code: 'Escape', keyCode: 27 },
  map: { key: 'm', code: 'KeyM', keyCode: 77 },
};

/** Sends a key event the game treats like a real key (keyCode forced: some browsers drop it from the init dict). */
function sendKey(type: 'keydown' | 'keyup', k: keyof typeof KEYS): void {
  const { key, code, keyCode } = KEYS[k];
  const ev = new KeyboardEvent(type, { key, code, bubbles: true, cancelable: true });
  Object.defineProperty(ev, 'keyCode', { get: () => keyCode });
  Object.defineProperty(ev, 'which', { get: () => keyCode });
  window.dispatchEvent(ev);
}

/** Keeps a finger's moves coming to `el` even off its edge; harmless if the browser refuses. */
function capture(el: Element, pointerId: number): void {
  try {
    el.setPointerCapture(pointerId);
  } catch {
    // Synthetic or already-ended pointers can't be captured; the control still works without it.
  }
}

/**
 * True when the controls should show from the start: phones and tablets (a
 * touch screen without a hovering mouse), or ?touch=1 to try it on a desktop.
 * Either way they also appear on the first touch and hide on a real key press.
 */
export function wantsTouchControls(): boolean {
  if (new URLSearchParams(location.search).get('touch') === '1') return true;
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const touchNoMouse = navigator.maxTouchPoints > 0 && !window.matchMedia('(hover: hover)').matches;
  return coarse || touchNoMouse;
}

/**
 * On-screen controls for touch screens, drawn over the game as plain HTML:
 * a stick on the left (presses the arrow keys) and Action / Menu / Map buttons
 * on the right (E, Esc, M). Because they press the same keys as a keyboard,
 * every scene, menu and minigame works with them unchanged.
 * Sizes and dead zone: src/data/touch.json.
 */
export function installTouchControls(visible: boolean): void {
  const t = touchJson;
  const root = document.createElement('div');
  root.id = 'touch-controls';
  const show = (on: boolean) => (root.style.display = on ? '' : 'none');
  show(visible);
  // Someone touched the screen: they need the controls. A real keyboard key: they don't.
  // (Our own buttons send untrusted key events, so they never hide the controls.)
  window.addEventListener('touchstart', () => show(true), { passive: true });
  window.addEventListener('keydown', (e) => e.isTrusted && show(false));
  root.innerHTML = `
    <div class="tc-stick"><div class="tc-knob"></div></div>
    <div class="tc-buttons">
      <button class="tc-btn tc-menu" data-k="menu" aria-label="Menu">☰</button>
      <button class="tc-btn tc-map" data-k="map" aria-label="Map">M</button>
      <button class="tc-btn tc-action" data-k="action" aria-label="Action">E</button>
    </div>`;
  const style = document.createElement('style');
  style.textContent = `
    #touch-controls { position: fixed; inset: 0; pointer-events: none; z-index: 10; font-family: ${ui.fontFamily}; -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; }
    #touch-controls .tc-stick { position: absolute; left: ${t.margin}px; bottom: ${t.margin}px; width: ${t.stickRadius * 2}px; height: ${t.stickRadius * 2}px;
      border-radius: 50%; background: ${ui.panel}33; border: 3px solid ${ui.panel}88; pointer-events: auto; touch-action: none; }
    #touch-controls .tc-knob { position: absolute; left: 50%; top: 50%; width: ${t.knobRadius * 2}px; height: ${t.knobRadius * 2}px; margin: -${t.knobRadius}px 0 0 -${t.knobRadius}px;
      border-radius: 50%; background: ${ui.panel}cc; border: 3px solid ${ui.ink}; box-sizing: border-box; }
    #touch-controls .tc-buttons { position: absolute; right: ${t.margin}px; bottom: ${t.margin}px; width: ${t.buttonSize * 2.3}px; height: ${t.buttonSize * 2.3}px; }
    #touch-controls .tc-btn { position: absolute; pointer-events: auto; touch-action: none; border-radius: 50%; border: 3px solid ${ui.ink};
      background: ${ui.panel}dd; color: ${ui.ink}; font: 700 ${Math.round(t.buttonSize * 0.42)}px ${ui.fontFamily}; padding: 0; }
    #touch-controls .tc-btn.on { background: ${ui.highlight}; transform: scale(0.94); }
    #touch-controls .tc-action { right: 0; bottom: ${t.buttonSize * 0.35}px; width: ${t.buttonSize * 1.25}px; height: ${t.buttonSize * 1.25}px; background: ${ui.heart}dd; color: ${ui.panel}; }
    #touch-controls .tc-menu { right: ${t.buttonSize * 0.15}px; top: 0; width: ${t.buttonSize * 0.8}px; height: ${t.buttonSize * 0.8}px; font-size: ${Math.round(t.buttonSize * 0.32)}px; }
    #touch-controls .tc-map { left: 0; bottom: 0; width: ${t.buttonSize * 0.9}px; height: ${t.buttonSize * 0.9}px; }`;
  document.head.appendChild(style);
  document.body.appendChild(root);

  // Buttons: key down while the finger is on it, key up when it lifts or slides off.
  root.querySelectorAll<HTMLButtonElement>('.tc-btn').forEach((btn) => {
    const k = btn.dataset.k as 'action' | 'menu' | 'map';
    let held = false;
    const up = () => {
      if (!held) return;
      held = false;
      btn.classList.remove('on');
      sendKey('keyup', k);
    };
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      capture(btn, e.pointerId);
      held = true;
      btn.classList.add('on');
      sendKey('keydown', k);
    });
    btn.addEventListener('pointerup', up);
    btn.addEventListener('pointercancel', up);
  });

  // Stick: arrow keys follow the finger; diagonals press two.
  const stick = root.querySelector<HTMLDivElement>('.tc-stick')!;
  const knob = root.querySelector<HTMLDivElement>('.tc-knob')!;
  let pressed = new Set<StickDir>();
  let pointer: number | null = null;
  const setDirs = (dirs: StickDir[]) => {
    const next = new Set(dirs);
    for (const d of pressed) if (!next.has(d)) sendKey('keyup', d);
    for (const d of next) if (!pressed.has(d)) sendKey('keydown', d);
    pressed = next;
  };
  const move = (e: PointerEvent) => {
    const r = stick.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2);
    const dy = e.clientY - (r.top + r.height / 2);
    const len = Math.hypot(dx, dy);
    const max = t.stickRadius - t.knobRadius;
    const k = len > max ? max / len : 1;
    knob.style.transform = `translate(${dx * k}px, ${dy * k}px)`;
    setDirs(stickDirs(dx, dy, t.stickRadius, t.deadZone));
  };
  const release = () => {
    pointer = null;
    knob.style.transform = '';
    setDirs([]);
  };
  stick.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    pointer = e.pointerId;
    capture(stick, e.pointerId);
    move(e);
  });
  stick.addEventListener('pointermove', (e) => {
    if (e.pointerId === pointer) move(e);
  });
  stick.addEventListener('pointerup', release);
  stick.addEventListener('pointercancel', release);
  // Leaving the page (app switch) must not leave a key stuck down.
  document.addEventListener('visibilitychange', () => document.hidden && release());
}
