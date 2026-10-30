// Edificios 3D a partir de OpenStreetMap.
//
// Los datos de altura (AWS Terrain Tiles) son del suelo "pelado": no traen edificios,
// así que una ciudad se ve como la foto pegada sobre el relieve. Aquí se descargan los
// contornos de los edificios y se "levantan" (extrusión): paredes verticales + techo plano.
//
// Fuentes (mosaicos vectoriales de zoom 14, ~2,4 km de lado, en formato binario PBF
// que se lee con @mapbox/vector-tile):
//  1. Overture Maps: junta OpenStreetMap con los edificios que Google y Microsoft detectaron
//     con inteligencia artificial en fotos satelitales. En el Perú tiene muchos más edificios
//     que OpenStreetMap solo (Cajamarca: ~9000 contra ~130 en el mismo mosaico).
//     Viene en un solo archivo PMTiles enorme; la librería pmtiles pide solo los bytes
//     de cada mosaico (peticiones HTTP con "Range").
//  2. OpenFreeMap (solo OpenStreetMap), por si Overture falla.
//
// Como una ciudad entera tiene cientos de miles de edificios, solo se piden los mosaicos
// que rodean el punto que mira la cámara, y solo cuando la cámara está cerca del suelo.

import * as THREE from 'three';
import { VectorTile } from '@mapbox/vector-tile';
import Pbf from 'pbf';
import { PMTiles } from 'pmtiles';
import { EXAGERAR, MOVIL } from './config.js';
import { alturaEscena, escenaALatLon } from './terreno.js';
import { lonATile, latATile } from './mapas.js';

const ZOOM_MOSAICO = 14;       // los edificios vienen completos en el zoom 14
const RADIO = MOVIL ? 0 : 1;   // mosaicos alrededor del punto que se mira: 3x3 (~7 km) o solo 1 en celulares
export const DISTANCIA_MAX = 6;   // km de la cámara al punto: más lejos no se cargan
const CATALOGO_OVERTURE = 'https://stac.overturemaps.org/catalog.json';   // lista de versiones publicadas
const VERSION_OVERTURE = '2026-10-21.0';                                  // si no se puede leer la lista
const INFO_OPENFREEMAP = 'https://tiles.openfreemap.org/planet';          // TileJSON con la URL vigente

// Colores de fachada (concreto, ladrillo tarrajeado, pintura clara), en sRGB
const TONOS = [0xd9d2c5, 0xcfc6b8, 0xe3ddd2, 0xc9b9a6, 0xd6cbb9, 0xbfb8ae, 0xe0cfa9, 0xc7c9c4]
  .map(c => new THREE.Color(c));

// Archivo PMTiles de la última versión de Overture (se busca una sola vez)
let overture = null;
function archivoOverture() {
  overture ??= (async () => {
    let version = VERSION_OVERTURE;
    try {
      const catalogo = await (await fetch(CATALOGO_OVERTURE)).json();
      const versiones = catalogo.links.filter(l => l.rel === 'child')
        .map(l => l.href.match(/(\d{4}-\d{2}-\d{2}\.\d+)/)?.[1]).filter(Boolean).sort();
      version = versiones.at(-1) ?? version;
    } catch { /* se usa la versión conocida */ }
    return new PMTiles(`https://tiles.overturemaps.org/${version}/buildings.pmtiles`);
  })();
  return overture;
}

let plantillaOpenFreeMap = null;   // ".../{z}/{x}/{y}.pbf", se pide una sola vez
async function mosaicoOpenFreeMap(x, y) {
  plantillaOpenFreeMap ??= (async () => (await (await fetch(INFO_OPENFREEMAP)).json()).tiles[0])();
  const url = (await plantillaOpenFreeMap).replace('{z}', ZOOM_MOSAICO).replace('{x}', x).replace('{y}', y);
  const r = await fetch(url);
  if (!r.ok) throw new Error(r.status);
  return r.arrayBuffer();
}

// Bytes del mosaico: primero Overture, si falla OpenFreeMap. null si no hay edificios.
async function descargarMosaico(x, y) {
  try {
    const mosaico = await (await archivoOverture()).getZxy(ZOOM_MOSAICO, x, y);
    return mosaico ? mosaico.data : null;
  } catch {
    return mosaicoOpenFreeMap(x, y);
  }
}

export class Edificios {
  constructor(shaders, uniformsSol, uTerreno) {
    this.material = new THREE.ShaderMaterial({
      vertexShader: shaders.edificiosVert,
      fragmentShader: shaders.sombras + shaders.edificiosFrag,
      side: THREE.DoubleSide,     // por si algún contorno viene en sentido contrario
      uniforms: {
        ...uniformsSol,
        // La foto satelital del terreno (los mismos objetos: cuando el terreno cambia
        // de foto, los techos también) para pintar los techos con su foto real
        uMapa:          uTerreno.uMapa,
        uDetalle:       uTerreno.uDetalle,
        uDetalleRect:   uTerreno.uDetalleRect,
        uDetalleMezcla: uTerreno.uDetalleMezcla,
        uModo:          uTerreno.uModo,
        uNieblaColor:   uTerreno.uNieblaColor,
        uNieblaCerca:   uTerreno.uNieblaCerca,
        uNieblaLejos:   uTerreno.uNieblaLejos,
      },
    });
    this.grupo = new THREE.Group();
    this.zona = null;
    this.mosaicos = new Set();  // mosaicos ya pedidos ("x/y")
    this.cargando = 0;          // mosaicos en camino
    this.total = 0;             // edificios dibujados
    this.carga = 0;             // para descartar descargas de una zona anterior
    this.activos = true;
    this.alCambiar = () => {};  // avisa al panel: texto o '' para ocultar
  }

  preparar(zona) {
    this.limpiar();
    this.zona = zona;
  }

  limpiar() {
    this.carga++;
    this.mosaicos.clear();
    this.cargando = 0;
    this.total = 0;
    for (const malla of this.grupo.children) malla.geometry.dispose();
    this.grupo.clear();
    this.alCambiar('');
  }

  alternar() {
    this.activos = !this.activos;
    this.grupo.visible = this.activos;
    this.avisar();
  }

  avisar(error) {
    if (!this.activos) return this.alCambiar('');
    if (this.cargando) return this.alCambiar(`cargando… (${this.total} edificios)`);
    if (error) return this.alCambiar('no se pudieron descargar');
    if (this.lejos) return this.alCambiar(this.total ? `${this.total} edificios · acércate para cargar más`
      : `acércate (cámara a menos de ${DISTANCIA_MAX} km del suelo) para verlos`);
    this.alCambiar(this.total ? `${this.total} edificios` : '');
  }

  // objetivo: punto que mira la cámara; distancia: de la cámara a ese punto (km)
  actualizar(objetivo, distancia) {
    const zona = this.zona;
    if (!this.activos || !zona) return;
    this.lejos = distancia > DISTANCIA_MAX;
    if (this.lejos) return this.avisar();
    const { lat, lon } = escenaALatLon(zona, objetivo.x, objetivo.z);
    const N = 2 ** ZOOM_MOSAICO;
    const cx = Math.floor(lonATile(lon, N)), cy = Math.floor(latATile(lat, N));
    // Primero el mosaico del centro, después los vecinos
    const lista = [];
    for (let y = cy - RADIO; y <= cy + RADIO; y++)
      for (let x = cx - RADIO; x <= cx + RADIO; x++) lista.push([x, y]);
    lista.sort((a, b) => Math.hypot(a[0] - cx, a[1] - cy) - Math.hypot(b[0] - cx, b[1] - cy));
    for (const [x, y] of lista) this.cargarMosaico(x, y);
  }

  async cargarMosaico(x, y) {
    const clave = `${x}/${y}`;
    if (this.mosaicos.has(clave) || !this.tocaZona(x, y)) return;
    this.mosaicos.add(clave);
    const miCarga = this.carga;
    this.cargando++;
    this.avisar();

    let capa = null, error = false;
    try {
      const datos = await descargarMosaico(x, y);
      capa = datos ? new VectorTile(new Pbf(datos)).layers.building ?? null : null;
    } catch {
      error = true;
    }
    if (miCarga !== this.carga) return;       // mientras tanto se cargó otra zona
    this.cargando--;
    if (error) this.mosaicos.delete(clave);   // se puede volver a pedir después
    else if (capa) {
      const { geo, cuantos } = construirMalla(this.zona, capa, x, y);
      if (cuantos) {
        this.grupo.add(new THREE.Mesh(geo, this.material));
        this.total += cuantos;
      } else geo.dispose();
    }
    this.avisar(error);
  }

  // ¿El mosaico se superpone con la zona del terreno?
  tocaZona(x, y) {
    const f = this.zona.N / 2 ** ZOOM_MOSAICO;   // tiles de la zona por tile de edificios
    const x0 = x * f, y0 = y * f;
    const { x0: zx, y0: zy, nTiles } = this.zona;
    return x0 + f > zx && x0 < zx + nTiles && y0 + f > zy && y0 < zy + nTiles;
  }
}

// Altura en metros: la medida (Overture "height" u OpenFreeMap "render_height"), o los pisos
// por 3 m. Los edificios detectados por IA casi nunca traen altura: se les da de 1 a 3 pisos
// (lo común en las ciudades del Perú), variando con "azar" para que no salgan todos iguales.
function alturaMetros(p, azar) {
  if (+p.height > 0) return +p.height;
  if (+p.num_floors > 0) return +p.num_floors * 3 + 1;
  if (+p.render_height > 5) return +p.render_height;   // OpenFreeMap pone 5 m cuando no sabe
  return (1 + Math.floor(azar * 3)) * 3 + 0.5;
}

// Área con signo de un anillo (en coordenadas del mosaico, con y hacia abajo).
// Los contornos exteriores y los huecos (patios) tienen signos opuestos.
function areaAnillo(anillo) {
  let a = 0;
  for (let i = 0, j = anillo.length - 1; i < anillo.length; j = i++)
    a += (anillo[j].x - anillo[i].x) * (anillo[j].y + anillo[i].y);
  return a;
}

// Recorta un anillo al cuadrado [0, extent] del mosaico (algoritmo de Sutherland-Hodgman).
// Los mosaicos traen un margen extra: sin recortar, un edificio en el borde se dibujaría dos veces.
function recortar(anillo, extent) {
  const bordes = [
    [p => p.x >= 0,      (a, b) => a.x / (a.x - b.x)],
    [p => p.x <= extent, (a, b) => (a.x - extent) / (a.x - b.x)],
    [p => p.y >= 0,      (a, b) => a.y / (a.y - b.y)],
    [p => p.y <= extent, (a, b) => (a.y - extent) / (a.y - b.y)],
  ];
  let puntos = anillo;
  for (const [dentro, corte] of bordes) {
    const entrada = puntos;
    puntos = [];
    for (let i = 0; i < entrada.length; i++) {
      const a = entrada[(i + entrada.length - 1) % entrada.length], b = entrada[i];
      const t = corte(a, b);
      const cruce = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
      if (dentro(b)) {
        if (!dentro(a)) puntos.push(cruce);
        puntos.push(b);
      } else if (dentro(a)) puntos.push(cruce);
    }
    if (puntos.length < 3) return [];
  }
  return puntos;
}

// Extrusión: un prisma por edificio, todos los del mosaico juntos en una sola geometría
// (una sola llamada de dibujo para miles de edificios).
// Además de posición y normal, cada vértice lleva lo que necesita el shader para las texturas:
//  - fachada: (metros a lo largo del contorno, metros sobre la base) -> ventanas y pisos
//  - uvMapa: dónde cae en la foto satelital del terreno -> techos con su foto real
//  - techo: 1 en el techo, 0 en las paredes
//  - semilla: número al azar (fijo por edificio) para variar el tamaño de las ventanas
function construirMalla(zona, capa, mx, my) {
  const pos = [], nor = [], tono = [], fachada = [], uvMapa = [], techoAttr = [], semilla = [];
  const color = new THREE.Color();
  const ext = capa.extent;
  const f = zona.N / 2 ** ZOOM_MOSAICO;
  // Coordenadas del mosaico (0..extent) -> escena (km); x al este, z al sur
  const aEscena = p => {
    const fx = ((mx + p.x / ext) * f - zona.x0) / zona.nTiles;
    const fz = ((my + p.y / ext) * f - zona.y0) / zona.nTiles;
    return { x: (fx - 0.5) * zona.anchoKm, z: (fz - 0.5) * zona.anchoKm, dentro: fx >= 0 && fx <= 1 && fz >= 0 && fz <= 1 };
  };
  const uvDe = (x, z) => [x / zona.anchoKm + 0.5, 0.5 - z / zona.anchoKm];   // v = 1 es el norte
  let cuantos = 0;

  for (let n = 0; n < capa.length; n++) {
    const rasgo = capa.feature(n);
    if (rasgo.type !== 3) continue;                 // solo polígonos
    const p = rasgo.properties;
    if (p.is_underground === true) continue;
    const azar = ((rasgo.id ?? n) * 0.618034) % 1;
    const altoM = Math.max(alturaMetros(p, azar), 3);
    const minM = Math.min(+(p.min_height ?? p.render_min_height) || 0, altoM - 1);
    color.copy(TONOS[Math.floor(azar * TONOS.length)]).multiplyScalar(0.92 + azar * 0.12);

    // Agrupar anillos en polígonos: un contorno exterior seguido de sus huecos
    // (el primer anillo siempre es exterior: su signo indica cuál es el de los exteriores)
    const poligonos = [];
    let signoExterior = 0;
    for (const anillo of rasgo.loadGeometry()) {
      const area = areaAnillo(anillo);
      if (area === 0) continue;
      signoExterior ||= Math.sign(area);
      const recortado = recortar(anillo.slice(0, -1), ext);   // el último punto repite el primero
      if (recortado.length < 3) continue;
      if (Math.sign(area) === signoExterior) poligonos.push({ exterior: recortado, huecos: [] });
      else poligonos.at(-1)?.huecos.push(recortado);
    }

    for (const { exterior, huecos } of poligonos) {
      const anillos = [exterior, ...huecos].map(a => a.map(aEscena));
      if (anillos[0].some(p => !p.dentro)) continue;

      // Base: el punto más bajo del terreno bajo el edificio (así no queda flotando)
      let suelo = Infinity;
      for (const p of anillos[0]) suelo = Math.min(suelo, alturaEscena(zona, p.x, p.z) ?? Infinity);
      if (!Number.isFinite(suelo)) continue;
      const base = suelo + minM / 1000 * EXAGERAR;
      const techo = suelo + altoM / 1000 * EXAGERAR;
      const altoVisible = altoM - minM;

      // Paredes: un rectángulo (2 triángulos) por lado, con normal plana.
      // "recorrido" son los metros de contorno acumulados: así las ventanas siguen
      // seguidas de una pared a la siguiente.
      for (const anillo of anillos) {
        // Sentido del anillo en la escena, para que las normales miren hacia afuera del muro
        let area = 0;
        for (let i = 0; i < anillo.length; i++) {
          const a = anillo[i], b = anillo[(i + 1) % anillo.length];
          area += a.x * b.z - b.x * a.z;
        }
        const s = area > 0 ? 1 : -1;
        let recorrido = 0;
        for (let i = 0; i < anillo.length; i++) {
          const a = anillo[i], b = anillo[(i + 1) % anillo.length];
          const dx = b.x - a.x, dz = b.z - a.z;
          const largo = Math.hypot(dx, dz);
          if (largo < 1e-6) continue;
          const nx = s * dz / largo, nz = -s * dx / largo;
          const u0 = recorrido, u1 = recorrido + largo * 1000;
          recorrido = u1;
          for (const [x, y, z, fu, fv] of [
            [a.x, base, a.z, u0, minM], [b.x, base, b.z, u1, minM], [b.x, techo, b.z, u1, altoM],
            [a.x, base, a.z, u0, minM], [b.x, techo, b.z, u1, altoM], [a.x, techo, a.z, u0, altoM],
          ]) {
            pos.push(x, y, z); nor.push(nx, 0, nz); tono.push(color.r, color.g, color.b);
            fachada.push(fu, fv - minM + (minM ? 3 : 0)); uvMapa.push(...uvDe(x, z));
            techoAttr.push(0); semilla.push(azar);
          }
        }
      }

      // Techo plano: el polígono (con sus patios) dividido en triángulos
      const plano = anillos.flat();
      const triangulos = THREE.ShapeUtils.triangulateShape(
        anillos[0].map(p => new THREE.Vector2(p.x, p.z)),
        anillos.slice(1).map(a => a.map(p => new THREE.Vector2(p.x, p.z))));
      for (const tri of triangulos)
        for (const k of tri) {
          const { x, z } = plano[k];
          pos.push(x, techo, z); nor.push(0, 1, 0); tono.push(color.r, color.g, color.b);
          fachada.push(0, altoVisible); uvMapa.push(...uvDe(x, z)); techoAttr.push(1); semilla.push(azar);
        }
      cuantos++;
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('tono', new THREE.Float32BufferAttribute(tono, 3));
  geo.setAttribute('fachada', new THREE.Float32BufferAttribute(fachada, 2));
  geo.setAttribute('uvMapa', new THREE.Float32BufferAttribute(uvMapa, 2));
  geo.setAttribute('techo', new THREE.Float32BufferAttribute(techoAttr, 1));
  geo.setAttribute('semilla', new THREE.Float32BufferAttribute(semilla, 1));
  return { geo, cuantos };
}
