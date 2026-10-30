// Fragment shader de los edificios (antes de este código se pega shaders/sombras.glsl).
//  - Techos: la foto satelital real de ese techo (la misma foto del terreno).
//  - Paredes: textura procedural de ventanas, una fila por piso (cada 3 m), con la
//    planta baja distinta (puertas y vitrinas) y la losa de cada piso marcada.
// La misma luz que el terreno: sol con sombras + luz del cielo, y niebla por distancia.

uniform sampler2D uMapa;
uniform sampler2D uDetalle;
uniform vec4 uDetalleRect;
uniform float uDetalleMezcla;
uniform int uModo;           // 0 = satélite, 1 = colores por altura (los techos usan su color)
uniform vec3 uLuzDir;
uniform vec3 uColorSol;
uniform float uAmbiente;
uniform vec3 uNieblaColor;
uniform float uNieblaCerca, uNieblaLejos;

varying vec3 vNormal;
varying vec3 vTono;
varying vec2 vFachada;
varying vec2 vUvMapa;
varying float vTecho;
varying float vSemilla;
varying float vProfundidad;

const float ALTO_PISO = 3.0;

float azar(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

// 1 dentro del rectángulo [lo, hi] (en 0..1 de la celda), 0 afuera, con borde suavizado
float caja(vec2 f, vec2 lo, vec2 hi, vec2 aa) {
  vec2 a = smoothstep(lo - aa, lo + aa, f) * (1.0 - smoothstep(hi - aa, hi + aa, f));
  return a.x * a.y;
}

// Misma foto que el terreno, con la foto de detalle encima si cubre este punto
vec3 fotoSatelite(vec2 uv) {
  vec3 c = texture2D(uMapa, uv).rgb;
  vec2 d = (uv - uDetalleRect.xy) / (uDetalleRect.zw - uDetalleRect.xy);
  vec3 det = texture2D(uDetalle, clamp(d, 0.0, 1.0)).rgb;
  if (uDetalleMezcla > 0.0 && d.x >= 0.0 && d.x <= 1.0 && d.y >= 0.0 && d.y <= 1.0) c = mix(c, det, uDetalleMezcla);
  return c;
}

vec3 pared(vec3 base) {
  float ancho = 2.4 + vSemilla * 1.8;                   // separación entre ventanas (m)
  vec2 celda = vec2(vFachada.x / ancho, vFachada.y / ALTO_PISO);
  vec2 f = fract(celda);
  vec2 id = floor(celda);
  vec2 aa = fwidth(celda) * 0.75;
  // Lejos, las ventanas serían más chicas que un píxel: se reemplazan por un tono promedio
  float nitidez = 1.0 - smoothstep(0.25, 0.6, max(aa.x, aa.y));

  vec3 vidrio = mix(vec3(0.10, 0.13, 0.17), vec3(0.42, 0.52, 0.62), azar(id + vSemilla * 31.0) * 0.7);
  float ventana;
  if (id.y < 0.5) {
    // Planta baja: vitrinas y puertas más anchas y altas, más oscuras
    ventana = caja(f, vec2(0.08, 0.0), vec2(0.92, 0.78), aa);
    vidrio *= 0.6;
  } else {
    ventana = caja(f, vec2(0.2 + vSemilla * 0.08, 0.3), vec2(0.8 - vSemilla * 0.08, 0.85), aa);
  }
  float losa = 1.0 - smoothstep(0.0, 0.06 + aa.y, f.y);   // franja en el borde de cada piso

  vec3 c = base * (1.0 - 0.18 * losa);
  c = mix(c, vidrio, ventana);
  vec3 promedio = mix(base, vidrio, 0.3);
  c = mix(promedio, c, nitidez);
  // Un poco más oscuro al pie del edificio (oclusión ambiental aproximada)
  return c * mix(0.7, 1.0, smoothstep(0.0, 2.5, vFachada.y));
}

void main() {
  vec3 n = normalize(vNormal);
  vec3 tono = pow(vTono, vec3(2.2));   // sRGB -> lineal

  vec3 color;
  if (vTecho > 0.5) color = (uModo == 0) ? fotoSatelite(vUvMapa) : tono * 0.9;
  else color = pared(tono);

  float difusa = max(dot(n, normalize(uLuzDir)), 0.0) * luzDelSol();
  vec3 cielo = mix(vec3(0.25, 0.25, 0.19), vec3(0.75, 0.87, 1.0), n.y * 0.5 + 0.5);
  color *= cielo * 0.45 * uAmbiente + uColorSol * 0.85 * difusa;

  float niebla = smoothstep(uNieblaCerca, uNieblaLejos, vProfundidad);
  color = mix(color, uNieblaColor, niebla);

  gl_FragColor = vec4(color, 1.0);
  #include <colorspace_fragment>
}
