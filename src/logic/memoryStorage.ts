import type { Storage } from './storage';

/**
 * In-memory Storage, mainly for tests.
 * @example const storage = new MemoryStorage(); storage.save('x'); storage.load(); // 'x'
 */
export class MemoryStorage implements Storage {
  private data: string | null;

  constructor(initial: string | null = null) {
    this.data = initial;
  }

  load(): string | null {
    return this.data;
  }

  save(data: string): void {
    this.data = data;
  }
}
