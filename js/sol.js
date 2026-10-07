// Sol: posición según la hora y la latitud, color de la luz y del cielo,
// y el mapa de sombras (shadow mapping hecho a mano).

import * as THREE from 'three';
import { TAM_SOMBRA, COLOR_CIELO_DIA, COLOR_CIELO_ATARDECER } from './config.js';

const CIELO_DIA = new THREE.Color(COLOR_CIELO_DIA);
const CIELO_ATARDECER = new THREE.Color(COLOR_CIELO_ATARDECER);
const SOL_BLANCO = new THREE.Color(1, 0.98, 0.92);
const SOL_NARANJA = new THREE.Color(1, 0.55, 0.3);

export class Sol {
  constructor(colorCielo) {
    this.colorCielo = colorCielo;   // se cambia en el lugar: lo comparten el fondo, la niebla y el agua

    // El mapa de sombras es una "foto" de profundidad tomada desde el sol con una
    // cámara ortográfica (los rayos del sol llegan paralelos)
    this.mapa = new THREE.WebGLRenderTarget(TAM_SOMBRA, TAM_SOMBRA);
    this.mapa.depthTexture = new THREE.DepthTexture(TAM_SOMBRA, TAM_SOMBRA);
    this.camara = new THREE.OrthographicCamera();
    this.camara.up.set(0, 0, 1);
    this.matProfundidad = new THREE.MeshBasicMaterial({ colorWrite: false });

    // Uniforms compartidos por el terreno y el agua
    this.uniforms = {
      uLuzDir:        { value: new THREE.Vector3(1, 1, 0.5) },
      uColorSol:      { value: new THREE.Color(1, 1, 1) },
      uAmbiente:      { value: 1 },
      uMapaSombra:    { value: this.mapa.depthTexture },
      uSombras:       { value: true },
      uTexelSombra:   { value: 1 / TAM_SOMBRA },
      uSombraMatriz:  { value: new THREE.Matrix4() },
      uDesplazNormal: { value: 0 },
    };
  }

  get sombras() { return this.uniforms.uSombras.value; }
  set sombras(activas) { this.uniforms.uSombras.value = activas; }

  ponerHora(hora, zona) {
    // El sol recorre el ecuador celeste (como en un equinoccio): sale por el este (+x),
    // sube y se pone por el oeste (-x). Su inclinación depende de la latitud:
    // en el Perú (hemisferio sur) a mediodía el sol queda hacia el norte (-z).
    const a = (hora - 6) / 12 * Math.PI;
    const lat = zona.latR;
    const dir = this.uniforms.uLuzDir.value
      .set(Math.cos(a), Math.sin(a) * Math.cos(lat), Math.sin(a) * Math.sin(lat))
      .normalize();

    // Color: naranja y más tenue cerca del horizonte, blanco cuando está alto
    const t = THREE.MathUtils.smoothstep(dir.y, 0, 0.4);
    this.uniforms.uColorSol.value.lerpColors(SOL_NARANJA, SOL_BLANCO, t);
    this.uniforms.uAmbiente.value = 0.5 + 0.5 * t;
    this.colorCielo.lerpColors(CIELO_ATARDECER, CIELO_DIA, t);

    // Cámara del sol: mira al centro del terreno desde la dirección del sol y
    // su "caja" ortográfica encierra todo el terreno
    const { anchoKm, relieveKm } = zona;
    const r = anchoKm * 0.75 + relieveKm;
    const centro = new THREE.Vector3(0, relieveKm / 2, 0);
    const cam = this.camara;
    cam.position.copy(centro).addScaledVector(dir, r * 2);
    cam.lookAt(centro);
    cam.left = cam.bottom = -r;
    cam.right = cam.top = r;
    cam.near = r;
    cam.far = r * 3;
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld();
    this.uniforms.uSombraMatriz.value.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
    this.uniforms.uDesplazNormal.value = 1.5 * (2 * r / TAM_SOMBRA);   // 1.5 píxeles del mapa
  }

  // Pasada 1 del dibujo: la profundidad de la escena vista desde el sol.
  // Los objetos de "ocultar" (el agua) no proyectan sombra.
  dibujarMapaSombras(render, escena, ocultar = []) {
    if (!this.sombras) return;
    const visibles = ocultar.map(o => o.visible);
    ocultar.forEach(o => { o.visible = false; });
    escena.overrideMaterial = this.matProfundidad;
    render.setRenderTarget(this.mapa);
    render.render(escena, this.camara);
    render.setRenderTarget(null);
    escena.overrideMaterial = null;
    ocultar.forEach((o, i) => { o.visible = visibles[i]; });
  }
}
