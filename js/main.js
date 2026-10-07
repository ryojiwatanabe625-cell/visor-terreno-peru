// Programa principal: crea la escena, carga los lugares y dibuja cada cuadro.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { INTERVALOS, MAX_TEXTURA, MAX_ZOOM_ALTURAS, COLOR_CIELO_DIA } from './config.js';
import { LUGARES } from './lugares.js';
import { PUNTOS } from './puntos.js';
import { descargarZona } from './mapas.js';
import {
  construirTerreno, crearMaterialTerreno, verticeMasCercano, latLonAEscena, escenaALatLon,
  alturaEscena, escenaAMetros,
} from './terreno.js';
import { Agua } from './agua.js';
import { Detalle } from './detalle.js';
import { Sol } from './sol.js';
import { Etiquetas } from './etiquetas.js';
import { Seleccion } from './seleccion.js';
import { crearInterfaz } from './interfaz.js';

// ---------- Shaders (archivos .vert/.frag/.glsl de la carpeta shaders/) ----------
async function cargarShaders() {
  const archivos = {
    sombras: 'sombras.glsl',
    terrenoVert: 'terreno.vert', terrenoFrag: 'terreno.frag',
    aguaVert: 'agua.vert', aguaFrag: 'agua.frag',
  };
  const textos = await Promise.all(Object.values(archivos).map(async archivo => {
    const r = await fetch(`shaders/${archivo}`);
    if (!r.ok) throw new Error(archivo);
    return r.text();
  }));
  return Object.fromEntries(Object.keys(archivos).map((clave, i) => [clave, textos[i]]));
}

let shaders;
try {
  shaders = await cargarShaders();
} catch {
  document.getElementById('datos').textContent =
    'No se pudieron leer los shaders. Abre el proyecto con un servidor local (ver README).';
  throw new Error('Shaders no disponibles');
}

// ---------- Escena, cámara, renderer y controles ----------
const colorCielo = new THREE.Color(COLOR_CIELO_DIA);   // compartido por fondo, niebla y agua
const escena = new THREE.Scene();
escena.background = colorCielo;
const camara = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.01, 5000);
const render = new THREE.WebGLRenderer({ antialias: true });
render.setPixelRatio(devicePixelRatio);
render.setSize(innerWidth, innerHeight);
document.body.appendChild(render.domElement);
const controles = new OrbitControls(camara, render.domElement);
controles.enableDamping = true;

// ---------- Objetos del visor ----------
const sol = new Sol(colorCielo);
const material = crearMaterialTerreno(shaders, sol.uniforms, colorCielo);
const u = material.uniforms;
const terreno = new THREE.Mesh(new THREE.BufferGeometry(), material);
escena.add(terreno);
const agua = new Agua(shaders, sol.uniforms, u, colorCielo);
escena.add(agua.malla);
const etiquetas = new Etiquetas(document.getElementById('etiquetas'), camara);
const seleccion = new Seleccion(escena, camara, terreno, document.getElementById('etiqueta'));
seleccion.conectar(render.domElement, () => zona, agua, acercarZona);
const detalle = new Detalle(u, render);

let zona = null;          // datos del lugar cargado (ver construirTerreno en terreno.js)
let lugarActual = null;
let cargaActual = 0;      // si se pide otro lugar mientras uno carga, el viejo se descarta
const historial = [];     // lugares anteriores, para el botón "Volver"
let hora = 7.5;
let animarDia = false;
let textoZona = '';

// ---------- Panel de control ----------
const ui = crearInterfaz({
  lugares: LUGARES,
  elegirLugar: lugar => {
    historial.length = 0;
    ui.permitirVolver(false);
    cargarLugar(lugar);
  },
  cambiarTamano: () => lugarActual && cargarLugar(lugarActual),
  cambiarNivel: ponerNivelAgua,
  cambiarHora: h => { hora = h; ponerHora(); },
  volver,
  tecla,
});
ui.mostrarHora(hora);

// ---------- Nivel de detalle de la foto ----------
// Cuando la cámara deja de moverse (400 ms sin cambios) se pide la foto de detalle
let esperaDetalle = null;
controles.addEventListener('change', () => {
  clearTimeout(esperaDetalle);
  esperaDetalle = setTimeout(() => {
    if (zona) detalle.actualizar(zona, controles.target, camara.position.distanceTo(controles.target));
  }, 400);
});

const metrosPorPixel = z => 40075016.686 * Math.cos(zona.latR) / (256 * 2 ** z);
detalle.alCambiar = estado => {
  if (!zona) return;
  let texto = `Foto: zoom ${zona.zoomSatelite} (${metrosPorPixel(zona.zoomSatelite).toFixed(1)} m/píxel)`;
  if (typeof estado === 'string') texto += ` · detalle: ${estado}`;
  if (typeof estado === 'number') texto += ` · detalle: zoom ${estado} (${metrosPorPixel(estado).toFixed(1)} m/píxel)`;
  ui.mostrarFoto(texto);
};

// ---------- Doble clic: cargar esa zona con más zoom (más detalle en relieve y foto) ----------
function acercarZona(punto) {
  if (zona.zoom >= MAX_ZOOM_ALTURAS) {
    ui.mostrarDatos(`${textoZona} · ya es el máximo detalle`);
    return;
  }
  const { lat, lon } = escenaALatLon(zona, punto.x, punto.z);
  const lugar = { nombre: 'Detalle', lat, lon, zoom: Math.min(zona.zoom + 2, MAX_ZOOM_ALTURAS) };
  if (u.uAgua.value) {
    // se mantiene el agua; si el clic fue sobre el agua, esa es la nueva fuente
    const bajoAgua = agua.cubre(verticeMasCercano(zona, punto.x, punto.z), escenaAMetros(zona, punto.y));
    lugar.agua = agua.nivel;
    lugar.fuente = bajoAgua ? [lat, lon] : lugarActual.fuente;
  }
  historial.push(lugarActual);
  ui.permitirVolver(true);
  cargarLugar(lugar);
}

function volver() {
  const anterior = historial.pop();
  ui.permitirVolver(historial.length > 0);
  if (anterior) cargarLugar(anterior);
}

function mostrarDatos() {
  ui.mostrarDatos(textoZona + (u.uCurvas.value ? ` · curvas cada ${u.uIntervalo.value} m` : ''));
}

function ponerNivelAgua(nivel) {
  const fraccion = agua.ponerNivel(nivel);
  ui.mostrarNivel(fraccion > 0 ? `${nivel} m · ${Math.round(fraccion * 100)}% bajo el agua` : 'sin agua');
}

function ponerHora() {
  ui.mostrarHora(hora);
  if (zona) sol.ponerHora(hora, zona);
}

// ---------- Cargar un lugar ----------
async function cargarLugar(lugar) {
  const { lat, lon, zoom } = lugar;
  const nTiles = ui.tamano;                      // 3, 5 o 7 tiles por lado
  const miCarga = ++cargaActual;
  lugarActual = lugar;
  ui.mostrarDatos('Cargando terreno…');
  seleccion.ocultar();
  etiquetas.limpiar();

  // 1. Descargar alturas y foto satelital
  let descarga;
  try {
    const maxTextura = Math.min(MAX_TEXTURA, render.capabilities.maxTextureSize);
    descarga = await descargarZona(lat, lon, zoom, nTiles, maxTextura);
  } catch {
    if (miCarga === cargaActual) ui.mostrarDatos('No se pudieron descargar los datos de altura.');
    return;
  }
  if (miCarga !== cargaActual) return;

  // 2. Malla del terreno
  const nueva = construirTerreno(descarga, lat, nTiles);
  nueva.zoom = zoom;
  nueva.zoomSatelite = descarga.zoomSatelite;
  detalle.quitar();                              // la foto de detalle era de la zona anterior
  terreno.geometry.dispose();
  terreno.geometry = nueva.geo;

  // 3. Foto satelital como textura
  u.uMapa.value?.dispose();
  const textura = new THREE.CanvasTexture(descarga.satelite);
  textura.colorSpace = THREE.SRGBColorSpace;
  textura.anisotropy = render.capabilities.getMaxAnisotropy();
  u.uMapa.value = textura;

  // 4. Curvas de nivel: unas 20 entre la parte más baja y la más alta
  u.uIntervalo.value = INTERVALOS.find(i => i >= (nueva.max - nueva.min) / 20) ?? 1000;

  // 5. Cámara y niebla según el tamaño de la zona. La cámara mira al lugar elegido
  //    desde el sur y desde arriba, para que no lo tapen los cerros
  const { anchoKm, relieveKm } = nueva;
  u.uNieblaCerca.value = anchoKm * 1.2;
  u.uNieblaLejos.value = anchoKm * 3;
  const centro = latLonAEscena(nueva, lat, lon);
  const yCentro = alturaEscena(nueva, centro.x, centro.z) ?? 0;
  // Descartar el giro que quede pendiente por la inercia (damping) de los controles;
  // si no, la cámara seguiría girando en la zona nueva
  controles.enableDamping = false;
  controles.update();
  controles.enableDamping = true;
  controles.target.set(centro.x, yCentro, centro.z);
  camara.position.set(centro.x, Math.max(yCentro + anchoKm * 0.45, relieveKm * 1.3), centro.z + anchoKm * 0.45);
  camara.near = anchoKm / 5000;
  camara.far = anchoKm * 20;
  camara.updateProjectionMatrix();
  controles.update();

  // 6. Agua: sale de la "fuente" del lugar (lago o mar) o, si no tiene o queda
  //    fuera de la zona, del punto más bajo
  let semilla = nueva.vMin;
  if (lugar.fuente) {
    const { x, z, dentro } = latLonAEscena(nueva, lugar.fuente[0], lugar.fuente[1]);
    if (dentro) semilla = verticeMasCercano(nueva, x, z);
  }
  agua.preparar(nueva, semilla);
  zona = nueva;
  detalle.alCambiar(null);
  ponerNivelAgua(ui.configurarNivel(nueva.min, nueva.max, lugar.agua));

  // 7. Sol (su recorrido depende de la latitud), alfiler y etiquetas de lugares
  ponerHora();
  seleccion.preparar(zona);
  etiquetas.preparar(zona, PUNTOS);

  textoZona = `Zoom ${zoom} · zona de ${anchoKm.toFixed(anchoKm < 10 ? 1 : 0)} km · altura mín: ${nueva.min.toFixed(0)} m · máx: ${nueva.max.toFixed(0)} m`;
  mostrarDatos();
}

// ---------- Teclado ----------
function tecla(k) {
  if (k === 't') {
    u.uModo.value = 1 - u.uModo.value;
    ui.mostrarLeyenda(u.uModo.value === 1);
  }
  if (k === 'c') u.uCurvas.value = !u.uCurvas.value;
  if (k === 'w') material.wireframe = !material.wireframe;
  if (k === 's') sol.sombras = !sol.sombras;
  if (k === 'd') animarDia = !animarDia;
  if (k === 'l') etiquetas.alternar();
  if (k === 'escape') seleccion.ocultar();
  if (k === 'backspace') volver();
  if (k === '+' || k === '=' || k === '-') {
    const i = INTERVALOS.indexOf(u.uIntervalo.value) + (k === '-' ? -1 : 1);
    u.uIntervalo.value = INTERVALOS[Math.max(0, Math.min(INTERVALOS.length - 1, i))];
    u.uCurvas.value = true;
  }
  mostrarDatos();
}

addEventListener('resize', () => {
  camara.aspect = innerWidth / innerHeight;
  camara.updateProjectionMatrix();
  render.setSize(innerWidth, innerHeight);
});

// ---------- Bucle de dibujo ----------
let msAnterior = 0;
render.setAnimationLoop(ms => {
  const dt = (ms - msAnterior) / 1000;
  msAnterior = ms;
  agua.animar(ms / 1000);
  detalle.animar(dt);

  if (animarDia) {                       // un día completo en unos 14 segundos
    hora += dt * 0.8;
    if (hora > 17.5) hora = 6.5;
    ponerHora();
  }

  if (zona) {
    sol.dibujarMapaSombras(render, escena, [agua.malla]);   // pasada 1: desde el sol
    controles.update();
    render.render(escena, camara);                          // pasada 2: desde la cámara
    seleccion.actualizar();
    etiquetas.actualizar();
  }
});

cargarLugar(LUGARES[0]);
