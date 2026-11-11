/** Swappable persistence for the serialised save string. */
export interface Storage {
  /** Returns the saved string, or null when nothing is saved. */
  load(): string | null;
  /** Replaces the saved string. */
  save(data: string): void;
}
