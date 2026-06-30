export interface MergeField {
  key: string;
  label: string;
  fallback?: string;
}

export const MERGE_FIELDS: MergeField[] = [
  { key: 'first_name', label: 'First Name', fallback: 'there' },
  { key: 'last_name', label: 'Last Name' },
  { key: 'phone_number', label: 'Phone Number' },
  { key: 'birthday', label: 'Birthday' },
];

export const MERGE_FIELDS_MAP: Record<string, MergeField> = Object.fromEntries(
  MERGE_FIELDS.map((f) => [f.key, f])
);

export const MERGE_TAG_REGEX = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

export function getLabel(key: string): string {
  return MERGE_FIELDS_MAP[key]?.label ?? `{{${key}}}`;
}

export function getFallback(key: string): string | undefined {
  return MERGE_FIELDS_MAP[key]?.fallback;
}

export function isKnownField(key: string): boolean {
  return key in MERGE_FIELDS_MAP;
}

export function extractMergeTags(raw: string): string[] {
  const keys: string[] = [];
  const re = new RegExp(MERGE_TAG_REGEX.source, 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) {
    keys.push(m[1]);
  }
  return keys;
}

export function extractUnknownTags(raw: string): string[] {
  const seen = new Set<string>();
  for (const key of extractMergeTags(raw)) {
    if (!isKnownField(key)) seen.add(key);
  }
  return Array.from(seen);
}

export interface MergeableContact {
  id?: string;
  first_name?: string | null;
  last_name?: string | null;
  phone_number?: string | null;
  birthday?: string | null;
  [key: string]: unknown;
}

export function resolveMergeTags(
  template: string,
  contact: MergeableContact,
  fields: MergeField[] = MERGE_FIELDS
): string {
  const fieldMap: Record<string, MergeField> = Object.fromEntries(
    fields.map((f) => [f.key, f])
  );
  return template.replace(MERGE_TAG_REGEX, (match, key: string) => {
    const field = fieldMap[key];
    if (!field) return match;
    const value = contact[key];
    if (value !== null && value !== undefined && String(value).trim() !== '') {
      return String(value);
    }
    if (field.fallback && field.fallback.trim() !== '') {
      return field.fallback;
    }
    console.warn(
      `[send-sms] Missing value for merge tag "${key}" for contact ${contact.id ?? 'unknown'}; no fallback configured.`
    );
    return match;
  });
}

export function getEffectiveText(raw: string): string {
  return raw.replace(MERGE_TAG_REGEX, (match, key: string) => {
    const field = MERGE_FIELDS_MAP[key];
    if (!field) return match;
    return field.fallback ?? '';
  });
}

export interface PreviewSegment {
  text: string;
  unknown?: boolean;
}

export function resolveForPreview(
  raw: string,
  contact: MergeableContact | null
): PreviewSegment[] {
  const segments: PreviewSegment[] = [];
  const re = new RegExp(MERGE_TAG_REGEX.source, 'g');
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) {
    if (m.index > last) segments.push({ text: raw.slice(last, m.index) });
    const key = m[1];
    const field = MERGE_FIELDS_MAP[key];
    if (field) {
      const value = contact ? contact[key] : undefined;
      if (value !== null && value !== undefined && String(value).trim() !== '') {
        segments.push({ text: String(value) });
      } else if (field.fallback && field.fallback.trim() !== '') {
        segments.push({ text: field.fallback });
      } else {
        segments.push({ text: m[0] });
      }
    } else {
      segments.push({ text: m[0], unknown: true });
    }
    last = re.lastIndex;
  }
  if (last < raw.length) segments.push({ text: raw.slice(last) });
  return segments;
}
