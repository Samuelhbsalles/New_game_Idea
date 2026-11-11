import type { Storage } from './storage';

/**
 * Storage backed by localStorage. The backend is injected, so this file never
 * references a browser global itself.
 * @example const storage = new LocalStorageAdapter('creatureGame.save', browserBackend);
 */
export class LocalStorageAdapter implements Storage {
  constructor(
    private readonly key: string,
    private readonly backend: { getItem(k: string): string | null; setItem(k: string, v: string): void },
  ) {}

  load(): string | null {
    return this.backend.getItem(this.key);
  }

  save(data: string): void {
    this.backend.setItem(this.key, data);
  }
}
