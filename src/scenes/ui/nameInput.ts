import ui from '../../data/ui.json';

/**
 * A plain HTML text box laid over the game canvas (Phaser has no text input).
 * Enter submits; the box stays until destroy(). Placed at a point given in
 * game pixels, so it follows the canvas's pixel zoom.
 */
export class NameInput {
  readonly el: HTMLInputElement;

  constructor(
    canvas: HTMLCanvasElement,
    at: { x: number; y: number },
    gameSize: { width: number; height: number },
    initial: string,
    onSubmit: (value: string) => void,
  ) {
    const el = document.createElement('input');
    el.type = 'text';
    el.maxLength = 16;
    el.value = initial;
    el.autocomplete = 'off';
    el.spellcheck = false;
    const s = el.style;
    s.position = 'fixed';
    s.transform = 'translate(-50%, -50%)';
    s.color = ui.ink;
    s.background = ui.panel;
    s.textAlign = 'center';
    s.outline = 'none';
    s.zIndex = '10';
    el.addEventListener('keydown', (e) => {
      e.stopPropagation(); // keep the game's key handling out of typing
      if (e.key === 'Enter') onSubmit(el.value);
    });
    document.body.appendChild(el);
    this.el = el;
    // Sized in game pixels times the canvas's on-screen zoom, so it matches the pixel art.
    const place = () => {
      const r = canvas.getBoundingClientRect();
      const k = r.height / gameSize.height;
      s.left = `${r.left + (at.x / gameSize.width) * r.width}px`;
      s.top = `${r.top + (at.y / gameSize.height) * r.height}px`;
      s.font = `${ui.fontSize * k}px ${ui.fontFamily}`;
      s.width = `${130 * k}px`;
      s.padding = `${2 * k}px ${4 * k}px`;
      s.border = `${2 * k}px solid ${ui.ink}`;
    };
    place();
    window.addEventListener('resize', place);
    this.unplace = () => window.removeEventListener('resize', place);
    el.focus();
    el.select();
  }

  private readonly unplace: () => void;

  setEnabled(on: boolean): void {
    this.el.disabled = !on;
    if (on) this.el.focus();
  }

  destroy(): void {
    this.unplace();
    this.el.remove();
  }
}
