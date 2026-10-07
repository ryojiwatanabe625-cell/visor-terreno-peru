// Etiquetas de los puntos de interés (ciudades, ruinas, lagunas, nevados...).
// Son elementos HTML que siguen a un punto 3D: en cada cuadro se proyecta el punto
// a la pantalla, y se ocultan si una montaña lo tapa.

import * as THREE from 'three';
import { latLonAEscena, alturaEscena } from './terreno.js';

const ICONOS = {
  ciudad: '🏙️', ruinas: '🏛️', nevado: '🏔️', montana: '⛰️', volcan: '🌋',
  agua: '💧', isla: '🏝️', mirador: '🦅', naturaleza: '🌿', aeropuerto: '✈️',
};

export class Etiquetas {
  constructor(contenedor, camara) {
    this.contenedor = contenedor;
    this.camara = camara;
    this.lista = [];
    this.zona = null;
    this.activas = true;
    this.proyectado = new THREE.Vector3();
  }

  // Crea las etiquetas de los puntos que caen dentro de la zona
  preparar(zona, puntos) {
    this.limpiar();
    this.zona = zona;
    for (const punto of puntos) {
      const { x, z, dentro } = latLonAEscena(zona, punto.lat, punto.lon);
      if (!dentro) continue;
      const div = document.createElement('div');
      div.className = 'poi';
      div.innerHTML = `<span>${ICONOS[punto.tipo] ?? '📍'} ${punto.nombre}</span><i></i>`;
      this.contenedor.append(div);
      this.lista.push({ div, pos: new THREE.Vector3(x, alturaEscena(zona, x, z), z) });
    }
  }

  limpiar() {
    this.contenedor.replaceChildren();
    this.lista = [];
  }

  alternar() {
    this.activas = !this.activas;
    this.contenedor.style.display = this.activas ? '' : 'none';
  }

  // ¿Se ve el punto desde la cámara, o lo tapa el terreno?
  // Ray marching sobre el mapa de alturas: se avanza a pasos por la línea cámara -> punto
  // y en cada paso se compara la altura de la línea con la del terreno debajo.
  seVe(destino) {
    const cam = this.camara.position;
    const margen = this.zona.anchoKm * 0.003;
    const PASOS = 96;
    for (let s = 1; s < PASOS - 3; s++) {           // los últimos pasos son el propio punto
      const t = s / PASOS;
      const x = cam.x + (destino.x - cam.x) * t;
      const y = cam.y + (destino.y - cam.y) * t;
      const z = cam.z + (destino.z - cam.z) * t;
      const h = alturaEscena(this.zona, x, z);
      if (h !== null && h > y + margen) return false;
    }
    return true;
  }

  actualizar() {
    if (!this.activas) return;
    const p = this.proyectado;

    // 1. Qué etiquetas se ven y dónde caen en la pantalla
    const candidatas = [];
    for (const etiqueta of this.lista) {
      p.copy(etiqueta.pos).project(this.camara);       // 3D -> coordenadas de pantalla (-1..1)
      const enPantalla = p.z < 1 && Math.abs(p.x) < 1.05 && Math.abs(p.y) < 1.05;
      if (enPantalla && this.seVe(etiqueta.pos)) {
        etiqueta.x = (p.x + 1) / 2 * innerWidth;
        etiqueta.y = (1 - p.y) / 2 * innerHeight;
        etiqueta.dist = this.camara.position.distanceTo(etiqueta.pos);
        candidatas.push(etiqueta);
      } else {
        etiqueta.div.style.display = 'none';
      }
    }

    // 2. Evitar que se encimen: de las más cercanas a las más lejanas, una etiqueta
    //    solo se muestra si su rectángulo no choca con el de otra ya mostrada
    candidatas.sort((a, b) => a.dist - b.dist);
    const ocupados = [];
    for (const etiqueta of candidatas) {
      const { div, x, y } = etiqueta;
      div.style.display = '';
      etiqueta.ancho ||= div.offsetWidth;
      etiqueta.alto ||= div.offsetHeight;
      const r = { x1: x - etiqueta.ancho / 2, x2: x + etiqueta.ancho / 2, y1: y - etiqueta.alto, y2: y };
      if (ocupados.some(o => r.x1 < o.x2 && r.x2 > o.x1 && r.y1 < o.y2 && r.y2 > o.y1)) {
        div.style.display = 'none';
        continue;
      }
      ocupados.push(r);
      div.style.left = `${x}px`;
      div.style.top = `${y}px`;
    }
  }
}
