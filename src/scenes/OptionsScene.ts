import Phaser from 'phaser';
import { cycleLanguage, stepVolume } from '../logic/settings';
import { closeOverlay } from './overlay';
import { services } from './services';
import { Keys } from './ui/input';
import { MenuPanel } from './ui/MenuPanel';

/** Volume change per ←/→ press. */
const VOLUME_STEP = 0.1;

/** Options overlay: language and volumes. Changes save immediately. */
export class OptionsScene extends Phaser.Scene {
  private keys!: Keys;
  private menu: MenuPanel | null = null;
  private from = 'TitleScene';

  constructor() {
    super('OptionsScene');
  }

  init(data: { from?: string }): void {
    this.from = data.from ?? 'TitleScene';
  }

  create(): void {
    this.keys = new Keys(this);
    this.add.rectangle(0, 0, this.scale.width, this.scale.height, 0x000000, 0.45).setOrigin(0);
    this.build();
  }

  update(): void {
    // Release keys pressed in the scene that opened us, so E doesn't act twice.
    if (this.menu?.handle(this.keys.read()) === 'cancel') closeOverlay(this, this.from);
  }

  private build(): void {
    const s = services(this);
    const t = s.i18n.t;
    const pct = (v: number) => Math.round(v * 100);
    const lang = (dir: 1 | -1) => {
      s.updateSettings({ ...s.settings, language: cycleLanguage(s.settings.language, s.languages, dir) });
      this.build(); // every label changes language
    };
    const vol = (key: 'musicVolume' | 'sfxVolume', d: number) => () => {
      s.updateSettings({ ...s.settings, [key]: stepVolume(s.settings[key], d) });
      this.menu?.refresh();
    };
    this.menu?.destroy();
    this.menu = new MenuPanel(this, {
      title: t('options.title'),
      items: [
        {
          label: () => t('options.language', { value: t(`languages.${s.settings.language}`) }),
          onLeft: () => lang(-1),
          onRight: () => lang(1),
          onSelect: () => lang(1),
        },
        {
          label: () => t('options.music', { value: pct(s.settings.musicVolume) }),
          onLeft: vol('musicVolume', -VOLUME_STEP),
          onRight: vol('musicVolume', VOLUME_STEP),
        },
        {
          label: () => t('options.sfx', { value: pct(s.settings.sfxVolume) }),
          onLeft: vol('sfxVolume', -VOLUME_STEP),
          onRight: vol('sfxVolume', VOLUME_STEP),
        },
        { label: () => t('options.back'), onSelect: () => closeOverlay(this, this.from) },
      ],
      help: t('options.help'),
      anchor: { kind: 'center' },
      minWidth: 180,
    });
  }
}
