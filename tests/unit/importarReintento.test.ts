import { afterEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { failedModuleUrl, isChunkLoadError, retryableImport, retryableThen, setImportUrlForTests, withRetryParam } from '../../src/lib/importar';

const URL_FRAGMENTO = 'https://ejemplo.org/lab/assets/grado8-BNWi1q4n.js';
const chromium = (u: string) => new TypeError(`Failed to fetch dynamically imported module: ${u}`);
const firefox = (u: string) => new TypeError(`error loading dynamically imported module: ${u}`);
const safari = () => new TypeError('Importing a module script failed.');

afterEach(() => setImportUrlForTests((u) => import(/* @vite-ignore */ u)));

describe('reintento de un import() fallido sin recargar (src/lib/importar.ts)', () => {
  it('lee la dirección del fragmento del mensaje de Chromium y de Firefox; Safari no la trae', () => {
    expect(failedModuleUrl(chromium(URL_FRAGMENTO))).toBe(URL_FRAGMENTO);
    expect(failedModuleUrl(firefox(URL_FRAGMENTO))).toBe(URL_FRAGMENTO);
    expect(failedModuleUrl(safari())).toBeNull();
    // Un error del propio código del módulo no es una descarga fallida.
    expect(failedModuleUrl(new Error('x is not defined'))).toBeNull();
    expect(isChunkLoadError(chromium(URL_FRAGMENTO))).toBe(true);
    expect(isChunkLoadError(safari())).toBe(true);
    expect(isChunkLoadError(new Error('x is not defined'))).toBe(false);
  });

  it('agrega o reemplaza ?reintento=n sin tocar los demás parámetros', () => {
    expect(withRetryParam(URL_FRAGMENTO, 1)).toBe(`${URL_FRAGMENTO}?reintento=1`);
    expect(withRetryParam(`${URL_FRAGMENTO}?reintento=1`, 2)).toBe(`${URL_FRAGMENTO}?reintento=2`);
    expect(withRetryParam(`${URL_FRAGMENTO}?v=3`, 1)).toBe(`${URL_FRAGMENTO}?v=3&reintento=1`);
  });

  it('tras un fallo pide la misma dirección con ?reintento=1, 2…, y lo que llegó se reutiliza', async () => {
    const pedidos: string[] = [];
    let red = false;
    setImportUrlForTests(async (u) => { pedidos.push(u); if (!red) throw chromium(u); return { BANCO: [u] }; });
    let originales = 0;
    const cargar = retryableThen(async () => { originales++; throw chromium(URL_FRAGMENTO); }, (m: { BANCO: string[] }) => m.BANCO);
    await expect(cargar()).rejects.toThrow(/dynamically imported module/);
    await expect(cargar()).rejects.toThrow(/dynamically imported module/);
    red = true;
    expect(await cargar()).toEqual([`${URL_FRAGMENTO}?reintento=2`]);
    // Ya llegó: no se pide una tercera copia del módulo.
    expect(await cargar()).toEqual([`${URL_FRAGMENTO}?reintento=2`]);
    expect(originales).toBe(1);
    expect(pedidos).toEqual([`${URL_FRAGMENTO}?reintento=1`, `${URL_FRAGMENTO}?reintento=2`]);
  });

  it('sin dirección en el mensaje (Safari) repite el import() original', async () => {
    let n = 0;
    const cargar = retryableImport(async () => { if (n++ === 0) throw safari(); return 'ok'; });
    await expect(cargar()).rejects.toThrow(/module script/);
    expect(await cargar()).toBe('ok');
    expect(n).toBe(2);
  });

  it('los cargadores de prácticas, bancos y motores 3D usan el reintento', () => {
    const usa = (f: string, patron: RegExp) => expect(readFileSync(f, 'utf8'), f).toMatch(patron);
    usa('src/curriculum/loader.ts', /retryableThen\(\(\) => import\('\.\/practices\//);
    usa('src/assessment/banco/cargar.ts', /retryableThen\(\(\) => import\('\.\/grado6'\)/);
    usa('src/assessment/avanzado/cargar.ts', /retryableThen\(\(\) => import\('\.\/bloqueA'\)/);
    usa('src/three/Scene3D.tsx', /retryableImport\(\(\) => import\('\.\/renderer'\)\)/);
    usa('src/labs/WaterQualityLab.tsx', /lazyWithRetry\(\(\) => import\('\.\/lote3d7\/AguaView3D'\)\)/);
    usa('src/App.tsx', /lazyWithRetry\(\(\) => import\('\.\/pages\/PracticePage'\)/);
    expect(readFileSync('src/curriculum/loader.ts', 'utf8')).not.toMatch(/: \(\) => import\(/);
  });
});
