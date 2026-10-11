/**
 * Códigos para compartir asignaciones y listas sin servidor: el contenido se
 * codifica en base64 (no está cifrado; no incluir datos personales sensibles).
 */
export interface Assignment {
  id: string;
  course: string;
  practiceId: string;
  objectives: string;
  activities: string;
  due: string; // AAAA-MM-DD
  createdAt: number;
}

export interface PracticeList { id: string; name: string; unit: string; practiceIds: string[]; notes: string; createdAt: number; }

function toBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  bytes.forEach((b) => { bin += String.fromCharCode(b); });
  return btoa(bin);
}

function fromBase64(b64: string): string {
  const bin = atob(b64);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function encodeAssignment(a: Assignment): string {
  return 'LVCN-A:' + toBase64(JSON.stringify(a));
}

export function encodeList(l: PracticeList): string {
  return 'LVCN-L:' + toBase64(JSON.stringify(l));
}

export type Decoded = { kind: 'asignacion'; value: Assignment } | { kind: 'lista'; value: PracticeList };

export function decodeCode(code: string): Decoded {
  const c = code.trim();
  try {
    if (c.startsWith('LVCN-A:')) {
      const v = JSON.parse(fromBase64(c.slice(7))) as Assignment;
      if (!v.practiceId || !v.course) throw new Error();
      return { kind: 'asignacion', value: v };
    }
    if (c.startsWith('LVCN-L:')) {
      const v = JSON.parse(fromBase64(c.slice(7))) as PracticeList;
      if (!Array.isArray(v.practiceIds)) throw new Error();
      return { kind: 'lista', value: v };
    }
  } catch {
    throw new Error('El código está incompleto o dañado. Cópialo de nuevo completo.');
  }
  throw new Error('No es un código del Laboratorio Virtual. Debe empezar por LVCN-A: o LVCN-L:.');
}

export function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
