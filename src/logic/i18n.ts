/** A nested table of UI strings: leaves are strings, branches group them. */
export interface StringTable {
  [key: string]: string | StringTable;
}

/** Translator for one language. */
export interface I18n {
  readonly language: string;
  /**
   * Looks up a dotted key ("menu.pet", "status.idle") and fills {placeholders}.
   * Missing keys fall back to the fallback language, then to the key itself,
   * so a missing translation shows up on screen instead of crashing.
   */
  t(key: string, vars?: Record<string, string | number>): string;
}

function lookup(table: StringTable | undefined, key: string): string | undefined {
  let node: string | StringTable | undefined = table;
  for (const part of key.split('.')) {
    if (node === undefined || typeof node === 'string') return undefined;
    node = node[part];
  }
  return typeof node === 'string' ? node : undefined;
}

/** Replaces {name} placeholders; unknown names are left as-is. */
export function format(s: string, vars: Record<string, string | number> = {}): string {
  return s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}

/**
 * Builds a translator.
 * @example const i18n = createI18n({ 'pt-BR': pt, en }, 'en', 'pt-BR'); i18n.t('menu.pet')
 */
export function createI18n(tables: Record<string, StringTable>, language: string, fallback: string): I18n {
  const lang = language in tables ? language : fallback;
  return {
    language: lang,
    t(key, vars) {
      const s = lookup(tables[lang], key) ?? lookup(tables[fallback], key) ?? key;
      return format(s, vars);
    },
  };
}

/** Keys present in `reference` but missing from `other` (for keeping translations complete). */
export function missingKeys(reference: StringTable, other: StringTable, prefix = ''): string[] {
  const out: string[] = [];
  for (const [k, v] of Object.entries(reference)) {
    const path = prefix ? `${prefix}.${k}` : k;
    const o = other[k];
    if (typeof v === 'string') {
      if (typeof o !== 'string') out.push(path);
    } else if (typeof o !== 'object' || o === null) {
      out.push(path);
    } else {
      out.push(...missingKeys(v, o, path));
    }
  }
  return out;
}
