// Fragment shader del terreno (antes de este código se pega shaders/sombras.glsl)

uniform sampler2D uMapa;     // imagen satelital de toda la zona
uniform sampler2D uDetalle;  // imagen más nítida de la parte que se está mirando (ver js/detalle.js)
uniform vec4 uDetalleRect;   // dónde cae esa imagen, en coordenadas UV del terreno (u0, v0, u1, v1)
uniform float uDetalleMezcla; // 0 = sin detalle, 1 = detalle completo (aparece poco a poco)
uniform int uModo;          // 0 = satélite, 1 = colores por altura
uniform bool uCurvas;        // mostrar curvas de nivel
uniform float uIntervalo;    // metros entre curvas
uniform vec3 uLuzDir;        // dirección hacia el sol
uniform vec3 uColorSol;      // blanco al mediodía, naranja al amanecer/atardecer
uniform float uAmbiente;     // luz del cielo (menor al amanecer/atardecer)
uniform vec3 uNieblaColor;
uniform float uNieblaCerca, uNieblaLejos;
uniform bool uAgua;          // hay agua en la escena
uniform float uNivelAgua;    // altura del agua en metros
uniform vec3 uColorFondoAgua;

varying float vAltura;
varying float vMojado;
varying vec3 vNormal;
varying vec2 vUv;
varying float vProfundidad;

// Colores hipsométricos (como en los mapas físicos), por altura en metros
vec3 colorHipsometrico(float h) {
  vec3 c0 = vec3(0.12, 0.37, 0.23);   //    0 m  verde oscuro (selva, costa)
  vec3 c1 = vec3(0.50, 0.69, 0.41);   // 1000 m  verde claro
  vec3 c2 = vec3(0.91, 0.85, 0.55);   // 2500 m  amarillo (valles interandinos)
  vec3 c3 = vec3(0.66, 0.47, 0.29);   // 3500 m  café (puna)
  vec3 c4 = vec3(0.54, 0.54, 0.54);   // 4500 m  roca
  vec3 c5 = vec3(1.00, 1.00, 1.00);   // 5500 m  nieve
  h = max(h, 0.0);                    // el fondo del mar usa el color del nivel 0
  vec3 c;
  if      (h < 1000.0) c = mix(c0, c1, h / 1000.0);
  else if (h < 2500.0) c = mix(c1, c2, (h - 1000.0) / 1500.0);
  else if (h < 3500.0) c = mix(c2, c3, (h - 2500.0) / 1000.0);
  else if (h < 4500.0) c = mix(c3, c4, (h - 3500.0) / 1000.0);
  else                 c = mix(c4, c5, clamp((h - 4500.0) / 1000.0, 0.0, 1.0));
  return pow(c, vec3(2.2));           // sRGB -> lineal (para iluminar correctamente)
}

// Línea antialiasada: vale 1 justo sobre un múltiplo de "intervalo", 0 lejos de él
float curva(float h, float intervalo, float grosorPx) {
  float f = h / intervalo;
  float ancho = fwidth(f);                        // cuánto cambia f entre píxeles vecinos
  float dist = abs(fract(f - 0.5) - 0.5) / ancho; // distancia a la curva, en píxeles
  float linea = 1.0 - clamp(dist / grosorPx, 0.0, 1.0);
  return linea * (1.0 - smoothstep(0.15, 0.35, ancho)); // se apagan si quedan muy juntas
}

void main() {
  vec3 n = normalize(vNormal);

  // 1. Color base
  vec3 color = (uModo == 0) ? texture2D(uMapa, vUv).rgb : colorHipsometrico(vAltura);

  // 1b. Nivel de detalle (LOD) de la foto: dentro del rectángulo de la imagen de detalle
  //     se usa esa imagen, con un borde difuminado para que no se note el corte.
  //     Se lee la textura siempre (fuera del "if") para que el mipmapping funcione bien.
  vec2 d = (vUv - uDetalleRect.xy) / (uDetalleRect.zw - uDetalleRect.xy);
  vec3 detalle = texture2D(uDetalle, clamp(d, 0.0, 1.0)).rgb;
  if (uModo == 0 && uDetalleMezcla > 0.0 && d.x >= 0.0 && d.x <= 1.0 && d.y >= 0.0 && d.y <= 1.0) {
    float borde = min(min(d.x, 1.0 - d.x), min(d.y, 1.0 - d.y));   // distancia al borde (0..0.5)
    color = mix(color, detalle, smoothstep(0.0, 0.08, borde) * uDetalleMezcla);
  }

  // 2. Iluminación: Lambert (sol, con sombras) + luz hemisférica (cielo arriba, suelo abajo)
  float difusa = max(dot(n, normalize(uLuzDir)), 0.0) * luzDelSol();
  vec3 cielo = mix(vec3(0.25, 0.25, 0.19), vec3(0.75, 0.87, 1.0), n.y * 0.5 + 0.5);
  color *= cielo * 0.3 * uAmbiente + uColorSol * 0.85 * difusa;

  // 3. Bajo el agua: el fondo se oscurece y se vuelve azul con la profundidad
  bool sumergido = uAgua && vMojado > 0.5 && vAltura < uNivelAgua;
  if (sumergido) {
    float prof = uNivelAgua - vAltura;
    color = mix(color, uColorFondoAgua, 1.0 - exp(-prof / 40.0));
  }

  // 4. Curvas de nivel: finas cada intervalo, gruesas (maestras) cada 5 intervalos
  if (uCurvas && !sumergido) {
    float fina = curva(vAltura, uIntervalo, 1.0);
    float maestra = curva(vAltura, uIntervalo * 5.0, 2.0);
    vec3 colorLinea = (uModo == 0) ? vec3(1.0, 0.95, 0.7) : vec3(0.12, 0.08, 0.04);
    float fuerza = (uModo == 0) ? 0.6 : 1.0;    // más suaves sobre la foto satelital
    color = mix(color, colorLinea, max(fina * 0.6, maestra * 0.9) * fuerza);
  }

  // 5. Niebla por distancia
  float niebla = smoothstep(uNieblaCerca, uNieblaLejos, vProfundidad);
  color = mix(color, uNieblaColor, niebla);

  gl_FragColor = vec4(color, 1.0);
  #include <colorspace_fragment>
}
