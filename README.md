# Visor de Terreno del Perú

Proyecto del curso **Computación Gráfica Visual**.

Visualizador 3D interactivo del relieve del Perú hecho con **WebGL** (Three.js) y **shaders GLSL propios**.
Descarga datos reales de altura y fotos satelitales y los muestra en 3D: nevados, volcanes, cañones,
lagos, ciudades y sitios arqueológicos, con agua, sol y sombras en tiempo real.

**▶ Ver en línea: <https://ryojiwatanabe625-cell.github.io/visor-terreno-peru/>**

![Tipo de proyecto](https://img.shields.io/badge/WebGL-Three.js%200.170-blue) ![Lenguaje](https://img.shields.io/badge/GLSL-shaders%20propios-green)

---

## Cómo ejecutarlo

El proyecto usa módulos de JavaScript y carga los shaders desde archivos, así que **necesita un
servidor local**: si se abre `index.html` con doble clic, el navegador bloquea esos archivos.
Hay tres formas fáciles:

1. **VS Code + Live Server** (recomendado)
   Instalar la extensión *Live Server*, abrir la carpeta del proyecto, clic derecho en `index.html`
   y elegir **Open with Live Server**.

2. **Python** (si está instalado). En la carpeta del proyecto:
   ```bash
   python -m http.server 8000
   ```
   y abrir <http://localhost:8000> en el navegador.

3. **En línea**: subir la carpeta a GitHub y activar **GitHub Pages**
   (Settings → Pages → Branch: main). Queda publicado con un link que funciona en cualquier computadora.

Se necesita conexión a internet: los mapas y la librería Three.js se descargan al abrir la página.

---

## Controles

| Control | Acción |
|---|---|
| Arrastrar con el mouse | Girar la cámara |
| Rueda del mouse | Acercar / alejar |
| Clic derecho + arrastrar | Desplazar la cámara |
| **Clic** en el terreno | Ver altura, coordenadas y región natural del punto |
| **Doble clic** en el terreno | Cargar esa zona con más zoom (relieve y foto más detallados) |
| **Retroceso** o botón **⟵ Volver** | Regresar a la zona anterior |
| **Esc** | Quitar el marcador |
| **T** | Cambiar entre foto satelital y colores por altura |
| **C** | Mostrar / ocultar curvas de nivel |
| **+ / −** | Cambiar la distancia entre curvas de nivel |
| **W** | Malla de alambre (wireframe) |
| **S** | Activar / desactivar sombras |
| **D** | Animar el día (el sol se mueve solo) |
| **L** | Mostrar / ocultar los nombres de lugares |

En el panel:

- **Menú de lugares**: 25 lugares del Perú agrupados (ciudades, arqueología, nevados, volcanes y cañones, lagos, costa).
- **Tamaño de zona**: normal (3×3 tiles), grande (5×5) o muy grande (7×7).
- **Coordenadas**: pegar latitud y longitud copiadas de Google Maps (por ejemplo `-13.16, -72.54`),
  elegir el zoom y presionar **Ir**.
- **Foto**: muestra el zoom de la foto satelital y cuántos metros mide cada píxel. Al acercar la cámara
  aparece también el zoom de la foto de detalle (ver *Nivel de detalle* más abajo).
- **Agua**: sube o baja el nivel del agua (simula inundaciones).
- **Hora**: mueve el sol entre las 6:30 y las 17:30.

---

## Estructura del proyecto

```
visor-terreno-peru/
├── index.html            Interfaz (panel de control) y carga de Three.js
├── css/
│   └── estilos.css       Estilos del panel y de las etiquetas
├── shaders/
│   ├── terreno.vert      Vertex shader del terreno
│   ├── terreno.frag      Fragment shader del terreno (color, luz, curvas, niebla)
│   ├── agua.vert         Vertex shader del agua
│   ├── agua.frag         Fragment shader del agua (olas, Fresnel, brillo)
│   └── sombras.glsl      Función de sombras compartida por los dos fragment shaders
└── js/
    ├── main.js           Programa principal: escena, cámara, carga de lugares, bucle de dibujo
    ├── config.js         Parámetros generales
    ├── lugares.js        Catálogo de lugares del menú
    ├── puntos.js         Puntos de interés (etiquetas)
    ├── mapas.js          Descarga de tiles y proyección Web Mercator
    ├── terreno.js        Malla del terreno, limpieza de datos y conversiones
    ├── agua.js           Plano del agua e inundación (flood fill)
    ├── sol.js            Posición del sol y mapa de sombras
    ├── detalle.js        Nivel de detalle (LOD) de la foto satelital al acercarse
    ├── etiquetas.js      Etiquetas de lugares (proyección y oclusión)
    ├── seleccion.js      Clic en el terreno (ray casting)
    └── interfaz.js       Conexión del panel HTML con el visor
```

---

## Técnicas de computación gráfica

| Técnica | Dónde está | Descripción |
|---|---|---|
| **Mapa de alturas (heightmap)** | `terreno.js` | Un plano subdividido (hasta 512×512 vértices) cuyos vértices suben según la altura real. |
| **Proyección Web Mercator** | `mapas.js`, `terreno.js` | Conversión entre latitud/longitud, tiles del mapa y coordenadas de la escena. |
| **Texturizado (UV mapping)** | `terreno.frag` | La foto satelital se pega sobre el relieve. Se descarga con más zoom que las alturas para que se vea nítida. |
| **Nivel de detalle (LOD) de texturas** | `detalle.js`, `terreno.frag` | Al acercarse, se descarga una foto más nítida (hasta ~1 m por píxel) solo del área que se mira, y el shader la mezcla sobre la foto base con un borde difuminado y un fundido de entrada. Es la misma idea que usa Google Earth. |
| **Nivel de detalle del relieve** | `main.js` | Con doble clic se vuelve a cargar la zona con 2 niveles más de zoom: la malla tiene la misma cantidad de vértices pero cubre un área 16 veces menor. |
| **Normales e iluminación de Lambert** | `terreno.js`, `terreno.frag` | La luz depende del ángulo entre la superficie y el sol. Se suma una luz hemisférica (cielo y suelo). |
| **Colores hipsométricos** | `terreno.frag` | Color por altura en metros, como en los mapas físicos. |
| **Curvas de nivel** | `terreno.frag` | Con `fract(altura / intervalo)`. `fwidth` mantiene el grosor constante en pantalla (antialiasing); cada 5 curvas hay una curva maestra. |
| **Niebla por distancia** | `terreno.frag`, `agua.frag` | Mezcla con el color del cielo según la distancia a la cámara. |
| **Agua animada** | `agua.frag` | Suma de 4 ondas senoidales que inclinan la normal. |
| **Efecto Fresnel (Schlick)** | `agua.frag` | El agua refleja más cielo al mirarla de forma rasante. |
| **Brillo especular (Phong)** | `agua.frag` | Reflejo del sol sobre el agua. |
| **Transparencia (alpha blending)** | `agua.js`, `agua.frag` | El agua deja ver el fondo, que se oscurece con la profundidad. |
| **Flood fill** | `agua.js` | El agua solo llega a zonas conectadas y más bajas que el nivel. |
| **Z-fighting** (problema y solución) | `terreno.vert` | El fondo bajo el agua se hunde un poco para que no "pelee" con el plano del agua. |
| **Shadow mapping** | `sol.js`, `sombras.glsl` | Dos pasadas: profundidad vista desde el sol (cámara ortográfica) y comparación al dibujar. |
| **PCF (sombras suaves)** | `sombras.glsl` | Promedio de 3×3 muestras del mapa de sombras. |
| **Shadow acne** (problema y solución) | `terreno.vert`, `sol.js` | Desplazamiento a lo largo de la normal (*normal offset*). |
| **Movimiento del sol** | `sol.js` | Trayectoria según la hora y la latitud: en el hemisferio sur, a mediodía el sol queda al norte. |
| **Ray casting (picking)** | `seleccion.js` | Rayo desde la cámara por el píxel del clic, intersectado con los triángulos del terreno. |
| **Proyección 3D → pantalla** | `etiquetas.js`, `seleccion.js` | Las etiquetas HTML siguen a puntos 3D. |
| **Oclusión por ray marching** | `etiquetas.js` | Una etiqueta se oculta si el terreno tapa la línea entre la cámara y el punto. |
| **Interpolación bilineal** | `terreno.js` | Altura del terreno en cualquier punto, a partir de los 4 vértices vecinos. |
| **Cámaras perspectiva y ortográfica** | `main.js`, `sol.js` | Perspectiva para el usuario, ortográfica para el sol. |

### Limpieza de datos reales

- **Picos falsos**: algunos puntos de los datos tienen errores (por ejemplo, 6923 m junto al Lago Junín,
  o −588 m y 788 m en la llanura de Iquitos). Se reemplazan por la **mediana** de sus 8 vecinos si se
  alejan demasiado de ella (`terreno.js`).
- **Mar a 0 m**: en algunas costas los datos no traen profundidad del mar. Por eso en la costa se usa
  un nivel de agua de 1 m (`lugares.js`).

---

## Datos y créditos

- **Alturas**: [AWS Terrain Tiles](https://registry.opendata.aws/terrain-tiles/) (Mapzen / Tilezen), formato *terrarium*.
  Fuentes: SRTM, ETOPO1 y otras.
- **Imágenes satelitales**: [Esri World Imagery](https://www.arcgis.com/home/item.html?id=10df2279f9684e4a9f6a7f08febac2a9).
- **Librería 3D**: [Three.js](https://threejs.org) 0.170 (solo para la escena, la cámara y los controles; los shaders
  del terreno y del agua son propios).
- **Regiones naturales**: clasificación de Javier Pulgar Vidal.

## Limitaciones conocidas

- La resolución de los datos depende del zoom: a zoom 11 cada punto representa unos 76 m, así que las cimas
  salen algo más bajas que las alturas oficiales (Huascarán: 6730 m en vez de 6768 m).
- El sol sigue la trayectoria de un equinoccio (no cambia con la estación del año).
- La foto de detalle llega hasta zoom 17 (~1 m por píxel) y los datos de altura hasta zoom 15
  (ver `config.js`). En zonas remotas Esri puede no tener fotos de tanto detalle.
- Las coordenadas de los puntos de interés son aproximadas.
- En zonas muy planas (por ejemplo Iquitos) los datos traen algunos valores erróneos agrupados que el filtro
  no elimina del todo; se notan en la altura mínima y máxima que muestra el panel, pero casi no en la vista 3D.
