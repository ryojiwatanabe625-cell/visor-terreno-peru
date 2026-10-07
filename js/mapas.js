// Descarga de datos de mapas y conversiones de la proyección Web Mercator.
//  - Alturas: AWS Terrain Tiles, formato "terrarium" (cada píxel guarda una altura)
//  - Foto satelital: Esri World Imagery
// Ambos servicios dividen el mundo en "tiles" de 256x256 px; con zoom z hay 2^z tiles por lado.

export const urlAltura = (z, x, y) =>
  `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${x}/${y}.png`;
export const urlSatelite = (z, x, y) =>
  `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`;

// (lat, lon) <-> coordenadas de tile con decimales, para N = 2^zoom tiles por lado
export const lonATile = (lon, N) => (lon + 180) / 360 * N;
export const latATile = (lat, N) => {
  const r = lat * Math.PI / 180;
  return (1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * N;
};
export const tileALon = (x, N) => x / N * 360 - 180;
export const tileALat = (y, N) => Math.atan(Math.sinh(Math.PI * (1 - 2 * y / N))) * 180 / Math.PI;

function cargarImagen(url) {
  return new Promise((ok, error) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';   // para poder leer sus píxeles desde un canvas
    img.onload = () => ok(img);
    img.onerror = error;
    img.src = url;
  });
}

// Junta cuantos x cuantos tiles a partir del tile (x0, y0) en un solo canvas.
// Si "opcional" es true, un tile que falla queda vacío en vez de cancelar todo.
export async function descargarMosaico(x0, y0, cuantos, urlDe, opcional = false) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256 * cuantos;
  const ctx = canvas.getContext('2d');
  const tareas = [];
  for (let j = 0; j < cuantos; j++)
    for (let i = 0; i < cuantos; i++) {
      let tarea = cargarImagen(urlDe(x0 + i, y0 + j))
        .then(img => ctx.drawImage(img, i * 256, j * 256));
      if (opcional) tarea = tarea.catch(() => {});
      tareas.push(tarea);
    }
  await Promise.all(tareas);
  return canvas;
}

// Descarga las alturas y la foto satelital de una zona de nTiles x nTiles centrada en (lat, lon).
// La foto se pide con 1 o 2 niveles más de zoom que las alturas (4 o 16 veces más píxeles)
// mientras quepa en una textura: así se distinguen calles, ruinas y lagunas.
export async function descargarZona(lat, lon, zoom, nTiles, maxTextura) {
  const N = 2 ** zoom;
  const k = (nTiles - 1) / 2;
  const x0 = Math.floor(lonATile(lon, N)) - k;
  const y0 = Math.floor(latATile(lat, N)) - k;

  let extra = 0;
  while (extra < 2 && zoom + extra < 18 && nTiles * 2 ** (extra + 1) * 256 <= maxTextura) extra++;
  const f = 2 ** extra;

  const [alturas, satelite] = await Promise.all([
    descargarMosaico(x0, y0, nTiles, (x, y) => urlAltura(zoom, x, y)),
    descargarMosaico(x0 * f, y0 * f, nTiles * f, (x, y) => urlSatelite(zoom + extra, x, y), true),
  ]);
  return { alturas, satelite, N, x0, y0, zoomSatelite: zoom + extra };
}
