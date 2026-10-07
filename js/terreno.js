// Malla del terreno a partir del mapa de alturas, su material (shader propio)
// y funciones para pasar entre metros, coordenadas geográficas y la escena 3D.
//
// Unidades de la escena: 1 unidad = 1 km. El eje x apunta al este, el z al sur
// y el y hacia arriba (las alturas se multiplican por EXAGERAR).

import * as THREE from 'three';
import { EXAGERAR } from './config.js';
import { lonATile, latATile, tileALon, tileALat } from './mapas.js';

const CIRCUNFERENCIA_TIERRA_KM = 40075.016686;

// Construye la malla del terreno. Devuelve la "zona": la malla y todos los datos
// que necesitan los demás módulos (agua, sol, etiquetas, clic).
export function construirTerreno({ alturas, N, x0, y0 }, lat, nTiles) {
  // 1. Leer las alturas. Formato "terrarium": altura (m) = R*256 + G + B/256 - 32768
  const PX = alturas.width;
  const px = alturas.getContext('2d').getImageData(0, 0, PX, PX).data;
  const leer = (i, j) => {
    const k = (j * PX + i) * 4;
    return px[k] * 256 + px[k + 1] + px[k + 2] / 256 - 32768;
  };

  // 2. Una cuadrícula de (SEG+1) x (SEG+1) vértices; más vértices si la zona es más grande
  const SEG = Math.min(128 * nTiles - 1, 511);
  const lado = SEG + 1;
  const latR = lat * Math.PI / 180;
  const anchoKm = nTiles * CIRCUNFERENCIA_TIERRA_KM * Math.cos(latR) / N;
  const alts = new Float32Array(lado * lado);
  for (let v = 0; v < alts.length; v++) {
    const i = v % lado, j = (v - i) / lado;
    alts[v] = leer(Math.round(i * (PX - 1) / SEG), Math.round(j * (PX - 1) / SEG));
  }
  const espaciadoM = anchoKm * 1000 / SEG;            // metros entre vértices vecinos
  quitarPicos(alts, lado, Math.max(500, 3 * espaciadoM));

  let min = Infinity, max = -Infinity, vMin = 0;
  for (let v = 0; v < alts.length; v++) {
    if (alts[v] < min) { min = alts[v]; vMin = v; }
    max = Math.max(max, alts[v]);
  }

  // 3. Plano subdividido y acostado (XZ); cada vértice sube según su altura
  const geo = new THREE.PlaneGeometry(anchoKm, anchoKm, SEG, SEG);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  for (let v = 0; v < pos.count; v++) pos.setY(v, (alts[v] - min) / 1000 * EXAGERAR);
  geo.setAttribute('altura', new THREE.BufferAttribute(alts, 1));     // metros reales, para el shader
  const attrMojado = new THREE.BufferAttribute(new Float32Array(pos.count), 1);
  geo.setAttribute('mojado', attrMojado);                             // lo llena el módulo del agua
  geo.computeVertexNormals();                                         // normales para la iluminación

  const relieveKm = (max - min) / 1000 * EXAGERAR;
  return { geo, alts, attrMojado, min, max, vMin, SEG, lado, anchoKm, relieveKm, latR, N, x0, y0, nTiles };
}

// Quitar picos falsos (errores en los datos): si un punto está demasiado por encima
// o por debajo de la mediana de sus 8 vecinos, se reemplaza por esa mediana.
// Se usa la mediana (y no el promedio) para que un error de 2 o 3 puntos
// juntos no "contamine" la comparación. El umbral crece con la distancia entre
// vértices: superarlo significaría una pendiente de más de 70° hacia todos lados.
function quitarPicos(alts, lado, umbral) {
  const original = Float32Array.from(alts);
  const vecinos = [];
  for (let v = 0; v < alts.length; v++) {
    const i = v % lado, j = (v - i) / lado;
    vecinos.length = 0;
    for (let dj = -1; dj <= 1; dj++)
      for (let di = -1; di <= 1; di++) {
        const ni = i + di, nj = j + dj;
        if ((di || dj) && ni >= 0 && nj >= 0 && ni < lado && nj < lado) vecinos.push(original[nj * lado + ni]);
      }
    vecinos.sort((a, b) => a - b);
    const mediana = vecinos[vecinos.length >> 1];
    if (Math.abs(original[v] - mediana) > umbral) alts[v] = mediana;
  }
}

// ---------- Conversiones ----------

export const metrosAEscena = (zona, h) => (h - zona.min) / 1000 * EXAGERAR;
export const escenaAMetros = (zona, y) => zona.min + y / EXAGERAR * 1000;

// (lat, lon) -> (x, z) de la escena; "dentro" indica si cae dentro de la zona
export function latLonAEscena(zona, lat, lon) {
  const fx = (lonATile(lon, zona.N) - zona.x0) / zona.nTiles;   // 0..1 de oeste a este
  const fz = (latATile(lat, zona.N) - zona.y0) / zona.nTiles;   // 0..1 de norte a sur
  return {
    x: (fx - 0.5) * zona.anchoKm,
    z: (fz - 0.5) * zona.anchoKm,
    dentro: fx >= 0 && fx <= 1 && fz >= 0 && fz <= 1,
  };
}

// (x, z) de la escena -> (lat, lon)
export function escenaALatLon(zona, x, z) {
  const fx = x / zona.anchoKm + 0.5, fz = z / zona.anchoKm + 0.5;
  return {
    lat: tileALat(zona.y0 + fz * zona.nTiles, zona.N),
    lon: tileALon(zona.x0 + fx * zona.nTiles, zona.N),
  };
}

// Índice del vértice de la cuadrícula más cercano a (x, z)
export function verticeMasCercano(zona, x, z) {
  const limitar = g => Math.min(zona.SEG, Math.max(0, Math.round(g)));
  const i = limitar((x / zona.anchoKm + 0.5) * zona.SEG);
  const j = limitar((z / zona.anchoKm + 0.5) * zona.SEG);
  return j * zona.lado + i;
}

// Altura del terreno (unidades de la escena) en (x, z), interpolando entre los
// 4 vértices vecinos (interpolación bilineal). Devuelve null fuera de la zona.
export function alturaEscena(zona, x, z) {
  const { SEG, lado } = zona;
  const gx = (x / zona.anchoKm + 0.5) * SEG, gz = (z / zona.anchoKm + 0.5) * SEG;
  if (gx < 0 || gz < 0 || gx > SEG || gz > SEG) return null;
  const i = Math.min(Math.floor(gx), SEG - 1), j = Math.min(Math.floor(gz), SEG - 1);
  const fx = gx - i, fz = gz - j;
  const p = zona.geo.attributes.position.array;
  const y = v => p[v * 3 + 1];
  const v = j * lado + i;
  const arriba = y(v) * (1 - fx) + y(v + 1) * fx;
  const abajo = y(v + lado) * (1 - fx) + y(v + lado + 1) * fx;
  return arriba * (1 - fz) + abajo * fz;
}

// ---------- Material ----------

export function crearMaterialTerreno(shaders, uniformsSol, colorCielo) {
  return new THREE.ShaderMaterial({
    vertexShader: shaders.terrenoVert,
    fragmentShader: shaders.sombras + shaders.terrenoFrag,
    uniforms: {
      ...uniformsSol,
      uMapa:           { value: null },
      uDetalle:        { value: null },
      uDetalleRect:    { value: new THREE.Vector4(0, 0, 1, 1) },
      uDetalleMezcla:  { value: 0 },
      uModo:           { value: 0 },
      uCurvas:         { value: false },
      uIntervalo:      { value: 100 },
      uNieblaColor:    { value: colorCielo },
      uNieblaCerca:    { value: 100 },
      uNieblaLejos:    { value: 300 },
      uAgua:           { value: false },
      uNivelAgua:      { value: 0 },
      uNivelY:         { value: 0 },
      uHundir:         { value: 0 },
      uColorFondoAgua: { value: new THREE.Color(0x0d3048) },
    },
  });
}
