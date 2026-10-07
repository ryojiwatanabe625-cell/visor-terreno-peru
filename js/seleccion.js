// Clic en el terreno: ray casting para encontrar el punto 3D, un alfiler rojo
// y una etiqueta con la altura, las coordenadas y la región natural.

import * as THREE from 'three';
import { escenaAMetros, escenaALatLon, verticeMasCercano } from './terreno.js';

// Regiones naturales del Perú según Javier Pulgar Vidal (por altura)
export function regionNatural(h) {
  if (h < 500)  return 'Chala u Omagua';
  if (h < 2300) return 'Yunga';
  if (h < 3500) return 'Quechua';
  if (h < 4000) return 'Suni';
  if (h < 4800) return 'Puna';
  return 'Janca';
}

export class Seleccion {
  constructor(escena, camara, terreno, etiqueta) {
    this.camara = camara;
    this.terreno = terreno;
    this.etiqueta = etiqueta;
    this.raycaster = new THREE.Raycaster();
    this.punta = new THREE.Vector3();

    // Alfiler: un cilindro con una esfera encima (mide 1 unidad; se escala según la zona)
    const material = new THREE.MeshBasicMaterial({ color: 0xe53935 });
    const palo = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1, 8), material);
    palo.position.y = 0.5;
    const cabeza = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 12), material);
    cabeza.position.y = 1;
    this.marcador = new THREE.Group();
    this.marcador.add(palo, cabeza);
    this.marcador.visible = false;
    escena.add(this.marcador);
  }

  // Escucha los clics sobre el canvas. Un clic se distingue de arrastrar la cámara
  // comparando dónde se apretó y dónde se soltó el botón.
  // alDobleClic(punto) se llama con el punto 3D donde se hizo doble clic.
  // Un doble clic también produce dos clics simples: por eso el clic simple espera
  // 250 ms y se cancela si en ese tiempo llega el doble clic.
  conectar(canvas, obtenerZona, agua, alDobleClic) {
    let inicio = null;
    let esperaClic = null;
    canvas.addEventListener('pointerdown', e => { inicio = [e.clientX, e.clientY]; });
    canvas.addEventListener('pointerup', e => {
      const zona = obtenerZona();
      if (!zona || !inicio || Math.hypot(e.clientX - inicio[0], e.clientY - inicio[1]) > 5) return;
      const punto = this.puntoBajo(e, canvas);
      clearTimeout(esperaClic);
      esperaClic = setTimeout(() => {
        if (obtenerZona() !== zona) return;      // mientras tanto se cargó otra zona
        if (punto) this.mostrar(punto, zona, agua);
        else this.ocultar();
      }, 250);
    });
    canvas.addEventListener('dblclick', e => {
      clearTimeout(esperaClic);
      const punto = obtenerZona() && this.puntoBajo(e, canvas);
      if (punto) alDobleClic(punto);
    });
  }

  // Ray casting: píxel -> coordenadas normalizadas (-1..1) -> rayo desde la cámara
  // -> primer triángulo del terreno que atraviesa. Devuelve el punto 3D o null.
  puntoBajo(e, canvas) {
    const r = canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      (e.clientX - r.left) / r.width * 2 - 1,
      -((e.clientY - r.top) / r.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camara);
    const [choque] = this.raycaster.intersectObject(this.terreno);   // el más cercano
    return choque ? choque.point : null;
  }

  preparar(zona) {
    this.marcador.scale.setScalar(zona.anchoKm * 0.04);
    this.ocultar();
  }

  mostrar(punto, zona, agua) {
    const h = escenaAMetros(zona, punto.y);
    const { lat, lon } = escenaALatLon(zona, punto.x, punto.z);
    let texto = `<b>${Math.round(h)} m</b><br>${lat.toFixed(4)}°, ${lon.toFixed(4)}°`;
    if (agua.cubre(verticeMasCercano(zona, punto.x, punto.z), h))
      texto += `<br>Bajo el agua: ${Math.round(agua.nivel - h)} m de profundidad`;
    else if (h >= 0)
      texto += `<br>Región natural: ${regionNatural(h)}`;
    this.etiqueta.innerHTML = texto;
    this.marcador.position.copy(punto);
    this.marcador.visible = true;
  }

  ocultar() {
    this.marcador.visible = false;
    this.etiqueta.style.display = 'none';
  }

  // La etiqueta sigue a la punta del alfiler
  actualizar() {
    if (!this.marcador.visible) return;
    const p = this.marcador.localToWorld(this.punta.set(0, 1.15, 0)).project(this.camara);
    if (p.z > 1) { this.etiqueta.style.display = 'none'; return; }   // quedó detrás de la cámara
    this.etiqueta.style.display = 'block';
    this.etiqueta.style.left = `${(p.x + 1) / 2 * innerWidth}px`;
    this.etiqueta.style.top = `${(1 - p.y) / 2 * innerHeight}px`;
  }
}
