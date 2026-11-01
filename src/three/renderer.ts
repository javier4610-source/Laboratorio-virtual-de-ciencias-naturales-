/**
 * Motor WebGL del kit de escenas 3D (three.js). Este es el ÚNICO módulo que importa 'three' y <Scene3D> lo carga con
 * import() diferido: three.js queda en un fragmento propio que solo se descarga cuando una práctica con escena 3D se
 * abre en un equipo con WebGL (nunca en la entrada ni en las demás páginas). Ver docs/v2/KIT-3D.md.
 *
 * Importaciones con nombre (tree shaking) y sin complementos de three/examples: la órbita, el teclado y los rótulos
 * los hace el kit. Mallas reutilizadas por `id` entre cuadros: en una animación solo cambian las transformaciones.
 */
import {
  BoxGeometry, CatmullRomCurve3, ConeGeometry, CylinderGeometry, DirectionalLight, DoubleSide, EdgesGeometry,
  Group, HemisphereLight, InstancedMesh, LineBasicMaterial, LineSegments, Matrix4, Mesh, MeshStandardMaterial,
  PerspectiveCamera, PlaneGeometry, Quaternion, Raycaster, REVISION, Scene, SphereGeometry, TubeGeometry, Vector2, Vector3,
  WebGLRenderer, type BufferGeometry, type Material, type Object3D,
} from 'three';
import { paletteColor, type Palette } from './colors';
import { cameraPosition, FOV_DEG, length, normalize, sub, type Orbit, type SceneItem, type Vec3 } from './scene';

export interface SceneRenderer {
  canvas: HTMLCanvasElement;
  setSize(width: number, height: number): void;
  setView(orbit: Orbit, target: Vec3, extent: number): void;
  update(items: readonly SceneItem[], palette: Palette, selectedId: string | null): void;
  render(): void;
  /** Id de la primitiva elegible bajo el punto (coordenadas de la ventana), o null. */
  pick(clientX: number, clientY: number): string | null;
  /** Prueba: dibuja y devuelve la imagen del lienzo (PNG en data URL) sin preserveDrawingBuffer. */
  snapshot(): string;
  dispose(): void;
}

interface Entry { kind: SceneItem['kind']; obj: Object3D; mats: Material[]; geoms: BufferGeometry[]; key: string }

const Y = new Vector3(0, 1, 0);
const v3 = (p: Vec3) => new Vector3(p[0], p[1], p[2]);

export function createSceneRenderer(host: HTMLElement): SceneRenderer {
  const renderer = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.setClearColor(0x000000, 0);
  const canvas = renderer.domElement;
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.display = 'block';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  host.appendChild(canvas);

  const scene = new Scene();
  const camera = new PerspectiveCamera(FOV_DEG, 1, 0.01, 1000);
  scene.add(camera);
  scene.add(new HemisphereLight(0xffffff, 0x8a8f99, 1.9));
  // La luz principal va con la cámara: el lado que se mira siempre está iluminado al girar.
  const key = new DirectionalLight(0xffffff, 1.6);
  key.position.set(1.5, 2.5, 3);
  camera.add(key);

  // Geometrías unitarias compartidas (se escalan por primitiva).
  const shared = {
    sphere: new SphereGeometry(1, 32, 20),
    cylinder: new CylinderGeometry(1, 1, 1, 16, 1),
    cone: new ConeGeometry(1, 1, 20, 1),
    box: new BoxGeometry(1, 1, 1),
    plane: new PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
  };
  const boxEdges = new EdgesGeometry(shared.box);
  const entries = new Map<string, Entry>();
  let extent = 1;
  let size = { w: 1, h: 1 };
  const raycaster = new Raycaster();

  const material = (hex: string, opacity: number, selected: boolean) => {
    const m = new MeshStandardMaterial({ roughness: 0.55, metalness: 0.05, side: DoubleSide });
    paint(m, hex, opacity, selected);
    return m;
  };
  function paint(m: Material, hex: string, opacity: number, selected: boolean) {
    m.transparent = opacity < 1;
    m.opacity = opacity;
    m.depthWrite = opacity >= 1;
    if (m instanceof MeshStandardMaterial) {
      m.color.set(hex);
      m.emissive.set(selected ? hex : '#000000');
      m.emissiveIntensity = selected ? 0.55 : 0;
    } else if (m instanceof LineBasicMaterial) m.color.set(hex);
  }

  /** Clave de la geometría propia (resortes, partículas): si cambia, se reconstruye la malla. */
  const keyOf = (it: SceneItem) => {
    if (it.kind === 'spring') return `${it.coils}|${it.radius}|${it.wire ?? 0}|${(length(sub(it.to, it.from))).toFixed(3)}`;
    if (it.kind === 'particles') return String(it.points.length);
    if (it.kind === 'box') return it.edges ? 'e' : '';
    return '';
  };

  function build(it: SceneItem, hex: string, opacity: number, selected: boolean): Entry {
    const mats: Material[] = [];
    const geoms: BufferGeometry[] = [];
    const mat = () => { const m = material(hex, opacity, selected); mats.push(m); return m; };
    let obj: Object3D;
    switch (it.kind) {
      case 'sphere': case 'ellipsoid': obj = new Mesh(shared.sphere, mat()); break;
      case 'rod': obj = new Mesh(shared.cylinder, mat()); break;
      case 'plane': obj = new Mesh(shared.plane, mat()); break;
      case 'box': {
        const g = new Group();
        g.add(new Mesh(shared.box, mat()));
        if (it.edges) { const lm = new LineBasicMaterial({ color: hex }); mats.push(lm); g.add(new LineSegments(boxEdges, lm)); }
        obj = g;
        break;
      }
      case 'arrow': {
        const g = new Group();
        const m = mat();
        g.add(new Mesh(shared.cylinder, m), new Mesh(shared.cone, m));
        obj = g;
        break;
      }
      case 'spring': {
        const L = Math.max(1e-6, length(sub(it.to, it.from)));
        const n = Math.max(8, Math.round(it.coils * 24));
        const pts = Array.from({ length: n + 1 }, (_, i) => {
          const a = (i / n) * it.coils * 2 * Math.PI;
          return new Vector3(it.radius * Math.cos(a), (i / n) * L, it.radius * Math.sin(a));
        });
        const geo = new TubeGeometry(new CatmullRomCurve3(pts), n * 2, it.wire ?? it.radius * 0.12, 8, false);
        geoms.push(geo);
        obj = new Mesh(geo, mat());
        break;
      }
      case 'particles': {
        const inst = new InstancedMesh(shared.sphere, mat(), Math.max(1, it.points.length));
        obj = inst;
        break;
      }
    }
    obj.userData.id = it.id;
    obj.traverse((o) => { o.userData.id = it.id; });
    scene.add(obj);
    return { kind: it.kind, obj, mats, geoms, key: keyOf(it) };
  }

  const q = new Quaternion();
  const m4 = new Matrix4();
  /** Orienta `obj` (eje y local) de `from` hacia `to`. */
  function orient(obj: Object3D, from: Vec3, dir: Vec3) {
    obj.position.copy(v3(from));
    const d = normalize(dir);
    if (length(d) === 0) q.identity(); else q.setFromUnitVectors(Y, v3(d));
    obj.quaternion.copy(q);
  }

  function place(e: Entry, it: SceneItem) {
    const o = e.obj;
    switch (it.kind) {
      case 'sphere': o.position.copy(v3(it.center)); o.scale.setScalar(it.radius); break;
      case 'ellipsoid': o.position.copy(v3(it.center)); o.scale.set(...it.radii); break;
      case 'box': o.position.copy(v3(it.center)); o.scale.set(...it.size); break;
      case 'plane': o.position.copy(v3(it.center)); o.scale.set(it.size[0], 1, it.size[1]); break;
      case 'rod': {
        const d = sub(it.to, it.from);
        orient(o, it.from, d);
        // El cilindro unitario está centrado: se desplaza medio largo a lo largo de su eje.
        const L = length(d);
        o.scale.set(it.radius, L, it.radius);
        o.position.add(v3(d).multiplyScalar(0.5));
        break;
      }
      case 'arrow': {
        const L = length(it.vector);
        orient(o, it.from, it.vector);
        const r = it.radius ?? extent * 0.012;
        const head = Math.min(L * 0.4, r * 4.5);
        const [shaft, cone] = (o as Group).children;
        shaft.scale.set(r, Math.max(1e-6, L - head), r);
        shaft.position.set(0, (L - head) / 2, 0);
        cone.scale.set(r * 2.4, head, r * 2.4);
        cone.position.set(0, L - head / 2, 0);
        o.visible = L > 1e-9;
        break;
      }
      case 'spring': orient(o, it.from, sub(it.to, it.from)); break;
      case 'particles': {
        const inst = o as InstancedMesh;
        it.points.forEach((p, i) => { m4.makeScale(it.radius, it.radius, it.radius).setPosition(p[0], p[1], p[2]); inst.setMatrixAt(i, m4); });
        inst.count = it.points.length;
        inst.instanceMatrix.needsUpdate = true;
        inst.computeBoundingSphere();
        break;
      }
    }
  }

  function drop(id: string) {
    const e = entries.get(id);
    if (!e) return;
    scene.remove(e.obj);
    e.mats.forEach((m) => m.dispose());
    e.geoms.forEach((g) => g.dispose());
    if (e.obj instanceof InstancedMesh) e.obj.dispose();
    entries.delete(id);
  }

  return {
    canvas,
    setSize(w, h) {
      size = { w: Math.max(1, Math.round(w)), h: Math.max(1, Math.round(h)) };
      renderer.setSize(size.w, size.h, false);
      camera.aspect = size.w / size.h;
      camera.updateProjectionMatrix();
    },
    setView(orbit, target, ext) {
      extent = ext;
      const pos = cameraPosition(orbit, target, ext, size.w / size.h);
      camera.position.set(pos[0], pos[1], pos[2]);
      camera.near = ext * 0.02;
      camera.far = ext * 60;
      camera.up.set(0, 1, 0);
      camera.lookAt(v3(target));
      camera.updateProjectionMatrix();
    },
    update(items, palette, selectedId) {
      const seen = new Set<string>();
      for (const it of items) {
        seen.add(it.id);
        const hex = paletteColor(palette, it.color);
        const opacity = it.opacity ?? 1;
        const selected = selectedId === it.id;
        let e = entries.get(it.id);
        if (e && (e.kind !== it.kind || e.key !== keyOf(it))) { drop(it.id); e = undefined; }
        if (!e) { e = build(it, hex, opacity, selected); entries.set(it.id, e); }
        else e.mats.forEach((m) => paint(m, hex, opacity, selected));
        place(e, it);
      }
      for (const id of [...entries.keys()]) if (!seen.has(id)) drop(id);
    },
    render() { renderer.render(scene, camera); },
    pick(clientX, clientY) {
      const r = canvas.getBoundingClientRect();
      if (!r.width || !r.height) return null;
      raycaster.setFromCamera(new Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1), camera);
      const hits = raycaster.intersectObjects([...entries.values()].map((e) => e.obj), true).filter((h) => h.object.userData.id && h.object.visible);
      // Lo opaco que se ve A TRAVÉS de una envoltura translúcida (núcleo dentro de la célula) gana a la envoltura.
      const solid = hits.find((h) => { const m = (h.object as Mesh).material as Material | undefined; return !!m && !Array.isArray(m) && m.opacity >= 1; });
      const hit = solid ?? hits[0];
      return hit ? String(hit.object.userData.id) : null;
    },
    snapshot() { renderer.render(scene, camera); return canvas.toDataURL('image/png'); },
    dispose() {
      for (const id of [...entries.keys()]) drop(id);
      Object.values(shared).forEach((g) => g.dispose());
      boxEdges.dispose();
      renderer.dispose();
      try { renderer.forceContextLoss(); } catch { /* ya perdido */ }
      canvas.remove();
    },
  };
}

/** Versión de three.js cargada (se muestra en el aviso de depuración y en las pruebas). */
export const THREE_REVISION = REVISION;
