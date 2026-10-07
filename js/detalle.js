// Nivel de detalle (LOD) de la foto satelital.
//
// La foto de toda la zona tiene un número limitado de píxeles, así que al acercarse
// se ve borrosa. Cuando la cámara se detiene, se calcula qué zoom haría falta para
// el área que se está mirando y se descarga una foto más nítida SOLO de esa área.
// El shader del terreno la pone encima de la foto base (ver shaders/terreno.frag).

import * as THREE from 'three';
import { MAX_ZOOM_DETALLE, TILES_DETALLE } from './config.js';
import { descargarMosaico, urlSatelite, lonATile, latATile } from './mapas.js';
import { escenaALatLon } from './terreno.js';

const CIRCUNFERENCIA_TIERRA_KM = 40075.016686;

export class Detalle {
  constructor(uTerreno, render) {
    this.u = uTerreno;                // uniforms del terreno: uDetalle, uDetalleRect, uDetalleMezcla
    this.anisotropia = render.capabilities.getMaxAnisotropy();
    this.carga = 0;                   // para descartar descargas viejas
    this.actual = null;               // { zoom, x0, y0 } de la foto de detalle que se muestra
    this.mezclaObjetivo = 0;
    this.alCambiar = () => {};        // avisa al panel: zoom del detalle, texto o null
  }

  quitar() {
    this.carga++;
    this.actual = null;
    this.mezclaObjetivo = 0;
    this.u.uDetalleMezcla.value = 0;
    this.u.uDetalle.value?.dispose();
    this.u.uDetalle.value = null;
    this.alCambiar(null);
  }

  // objetivo: punto que mira la cámara; distancia: de la cámara a ese punto (km)
  async actualizar(zona, objetivo, distancia) {
    // 1. El área visible mide aprox. el doble de la distancia a la cámara.
    //    Se elige el zoom con el que TILES_DETALLE tiles cubren esa área.
    const anchoMundoKm = CIRCUNFERENCIA_TIERRA_KM * Math.cos(zona.latR);   // un tile de zoom 0
    const ladoKm = 2 * Math.max(distancia, 0.2);
    const zoom = Math.min(MAX_ZOOM_DETALLE,
      Math.floor(Math.log2(anchoMundoKm * (TILES_DETALLE - 1) / ladoKm)));
    if (zoom <= zona.zoomSatelite) {           // la foto base ya es suficiente
      if (this.actual) this.quitar();
      return;
    }

    // 2. Tiles de ese zoom alrededor del punto que se mira
    const { lat, lon } = escenaALatLon(zona, objetivo.x, objetivo.z);
    const N = 2 ** zoom;
    const x0 = Math.floor(lonATile(lon, N)) - TILES_DETALLE / 2 + 1;
    const y0 = Math.floor(latATile(lat, N)) - TILES_DETALLE / 2 + 1;
    const a = this.actual;
    if (a && a.zoom === zoom && Math.abs(a.x0 - x0) <= 1 && Math.abs(a.y0 - y0) <= 1) return;   // ya cubierto

    const miCarga = ++this.carga;
    this.alCambiar(`cargando zoom ${zoom}…`);
    const canvas = await descargarMosaico(x0, y0, TILES_DETALLE, (x, y) => urlSatelite(zoom, x, y), true);
    if (miCarga !== this.carga) return;        // mientras tanto se pidió otra cosa

    // 3. Dónde cae la foto en el terreno: tiles de detalle -> tiles de la zona -> UV (0..1).
    //    En UV, v = 1 es el norte; el canvas también tiene el norte arriba (flipY de la textura).
    const f = 2 ** (zoom - zona.zoom);
    const u0 = (x0 / f - zona.x0) / zona.nTiles;
    const u1 = ((x0 + TILES_DETALLE) / f - zona.x0) / zona.nTiles;
    const norte = (y0 / f - zona.y0) / zona.nTiles;
    const sur = ((y0 + TILES_DETALLE) / f - zona.y0) / zona.nTiles;
    this.u.uDetalleRect.value.set(u0, 1 - sur, u1, 1 - norte);

    const textura = new THREE.CanvasTexture(canvas);
    textura.colorSpace = THREE.SRGBColorSpace;
    textura.anisotropy = this.anisotropia;
    this.u.uDetalle.value?.dispose();
    this.u.uDetalle.value = textura;
    this.u.uDetalleMezcla.value = 0;           // aparece poco a poco (ver animar)
    this.mezclaObjetivo = 1;
    this.actual = { zoom, x0, y0 };
    this.alCambiar(zoom);
  }

  animar(dt) {
    const m = this.u.uDetalleMezcla;
    m.value = Math.min(this.mezclaObjetivo, m.value + dt * 2.5);   // fundido de ~0,4 s
  }
}
