/**
 * Kit de escenas 3D para física, biología y ambiente (ver docs/v2/KIT-3D.md). Este índice NO importa three.js: el
 * motor (src/three/renderer.ts) se descarga aparte, con import() diferido, solo cuando una escena se monta con WebGL.
 */
export { Scene3D, loadSceneEngine, webglAvailable, forcedFallback, type Scene3DProps, type SceneEngine, type Scene3DHost } from './Scene3D';
export * from './scene';
export * from './colors';
