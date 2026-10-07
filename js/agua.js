// Agua: un plano horizontal con su propio shader (olas, Fresnel, brillo del sol)
// y una inundación por relleno (flood fill) que decide hasta dónde llega.

import * as THREE from 'three';
import { metrosAEscena } from './terreno.js';

export class Agua {
  // uTerreno: uniforms del terreno (el terreno también necesita saber dónde hay agua)
  constructor(shaders, uniformsSol, uTerreno, colorCielo) {
    this.uTerreno = uTerreno;
    this.material = new THREE.ShaderMaterial({
      vertexShader: shaders.aguaVert,
      fragmentShader: shaders.sombras + shaders.aguaFrag,
      transparent: true,
      uniforms: {
        ...uniformsSol,                   // el mismo sol y las mismas sombras que el terreno
        uTiempo:      { value: 0 },
        uEscala:      { value: 1 },
        uColorAgua:   { value: new THREE.Color(0x1d5a7a) },
        uColorCielo:  { value: colorCielo },
        uNieblaColor: uTerreno.uNieblaColor,
        uNieblaCerca: uTerreno.uNieblaCerca,
        uNieblaLejos: uTerreno.uNieblaLejos,
        uMascara:     { value: null },
      },
    });
    this.malla = new THREE.Mesh(new THREE.BufferGeometry(), this.material);
    this.malla.visible = false;
    this.zona = null;
    this.semilla = 0;
    this.mascara = null;
  }

  // Prepara el agua para una zona nueva. "semilla" es el vértice desde donde sale el agua.
  preparar(zona, semilla) {
    const { anchoKm, lado } = zona;
    this.zona = zona;
    this.semilla = semilla;
    this.malla.geometry.dispose();
    this.malla.geometry = new THREE.PlaneGeometry(anchoKm, anchoKm).rotateX(-Math.PI / 2);
    this.material.uniforms.uEscala.value = 600 / anchoKm;
    this.uTerreno.uHundir.value = anchoKm * 0.002;

    // Máscara del agua como textura (1 byte por vértice) para el shader del agua
    this.mascara?.dispose();
    this.mascara = new THREE.DataTexture(new Uint8Array(lado * lado), lado, lado, THREE.RedFormat);
    this.mascara.magFilter = this.mascara.minFilter = THREE.LinearFilter;
    this.material.uniforms.uMascara.value = this.mascara;
  }

  // Inundación por relleno (flood fill): el agua sale de la semilla y avanza a los
  // vértices vecinos que estén más bajos que el nivel, como el balde de pintura de Paint.
  // Así no se inunda un valle que está separado del lago por una montaña.
  inundar(nivel) {
    const { alts, lado } = this.zona;
    const mojado = new Uint8Array(alts.length);
    if (alts[this.semilla] >= nivel) return mojado;
    const pila = [this.semilla];
    mojado[this.semilla] = 1;
    while (pila.length) {
      const v = pila.pop();
      const i = v % lado, j = (v - i) / lado;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const ni = i + di, nj = j + dj;
        if (ni < 0 || nj < 0 || ni >= lado || nj >= lado) continue;
        const w = nj * lado + ni;
        if (!mojado[w] && alts[w] < nivel) {
          mojado[w] = 1;
          pila.push(w);
        }
      }
    }
    return mojado;
  }

  // Pone el agua a "nivel" metros. Devuelve qué fracción de la zona (0..1) queda bajo el agua.
  ponerNivel(nivel) {
    const { lado, attrMojado } = this.zona;
    const mojado = this.inundar(nivel);
    let cuantos = 0;
    for (let v = 0; v < mojado.length; v++) {
      cuantos += mojado[v];
      attrMojado.array[v] = mojado[v];
      // En la textura la fila 0 es la de abajo (sur); en la malla es la de arriba (norte)
      const i = v % lado, j = (v - i) / lado;
      this.mascara.image.data[(lado - 1 - j) * lado + i] = mojado[v] * 255;
    }
    attrMojado.needsUpdate = true;
    this.mascara.needsUpdate = true;

    const hayAgua = cuantos > 0;
    const y = metrosAEscena(this.zona, nivel);
    this.uTerreno.uAgua.value = hayAgua;
    this.uTerreno.uNivelAgua.value = nivel;
    this.uTerreno.uNivelY.value = y;
    this.malla.visible = hayAgua;
    this.malla.position.y = y;
    return cuantos / mojado.length;
  }

  // ¿El vértice v, de altura h metros, está bajo el agua?
  cubre(v, h) {
    return this.uTerreno.uAgua.value && this.zona.attrMojado.array[v] > 0.5
      && h < this.uTerreno.uNivelAgua.value;
  }

  get nivel() { return this.uTerreno.uNivelAgua.value; }

  animar(segundos) { this.material.uniforms.uTiempo.value = segundos; }
}
