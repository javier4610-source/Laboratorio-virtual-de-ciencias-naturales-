import { describe, expect, it } from 'vitest';
import { CATALOG } from '../../src/curriculum/catalog';
import { parseHash } from '../../src/lib/router';
import { PRACTICE_ID_RE, PUBLIC_BASE, practicePermalink } from '../../src/lib/permalink';

describe('enlaces permanentes de las prácticas', () => {
  it('la base pública es la de GitHub Pages, en https y con barra final', () => {
    const u = new URL(PUBLIC_BASE);
    expect(u.protocol).toBe('https:');
    expect(u.host).toBe('javier4610-source.github.io');
    expect(PUBLIC_BASE.endsWith('/')).toBe(true);
    expect(u.hash).toBe('');
  });

  it('los ids del catálogo son únicos y seguros en URL', () => {
    const ids = CATALOG.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(id, id).toMatch(PRACTICE_ID_RE);
      expect(encodeURIComponent(id)).toBe(id);
    }
  });

  it('cada práctica produce una URL válida que el enrutador resuelve a esa misma práctica', () => {
    for (const { id } of CATALOG) {
      const url = practicePermalink(id);
      expect(url).toBe(`${PUBLIC_BASE}#/practica/${id}`);
      const u = new URL(url);
      expect(u.origin + u.pathname).toBe(PUBLIC_BASE);
      expect(parseHash(u.hash).path).toEqual(['practica', id]);
    }
  });
});
