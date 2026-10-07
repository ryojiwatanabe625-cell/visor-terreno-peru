// Fragment shader del agua (antes de este código se pega shaders/sombras.glsl)

uniform float uTiempo;       // segundos (anima las olas)
uniform float uEscala;       // cuántas olas caben por km
uniform vec3 uLuzDir;
uniform vec3 uColorSol;
uniform float uAmbiente;
uniform vec3 uColorAgua;
uniform vec3 uColorCielo;
uniform vec3 uNieblaColor;
uniform float uNieblaCerca, uNieblaLejos;
uniform sampler2D uMascara;  // blanco donde llega el agua (calculado con flood fill)

varying vec3 vPosMundo;
varying vec2 vUv;
varying float vProfundidad;

// Una ola senoidal h = amp * sin(dir·p * frec + vel * t).
// Devuelve su pendiente (dh/dx, dh/dz), que es lo que inclina la normal.
vec2 ola(vec2 p, vec2 dir, float frec, float amp, float vel, float t) {
  dir = normalize(dir);
  return dir * frec * amp * cos(dot(p, dir) * frec + vel * t);
}

void main() {
  // 0. Solo hay agua donde el flood fill dijo que llega
  if (texture2D(uMascara, vUv).r < 0.5) discard;

  // 1. Normal de la superficie: suma de 4 olas en distintas direcciones
  //    (el plano es liso; solo "engañamos" a la luz moviendo la normal)
  vec2 p = vPosMundo.xz * uEscala;
  vec2 g = ola(p, vec2( 1.0,  0.3), 1.0, 0.08, 1.2, uTiempo)
         + ola(p, vec2(-0.4,  1.0), 1.7, 0.05, 1.7, uTiempo)
         + ola(p, vec2( 0.7, -0.8), 2.9, 0.03, 2.3, uTiempo)
         + ola(p, vec2(-1.0, -0.2), 4.3, 0.02, 3.1, uTiempo);
  vec3 n = normalize(vec3(-g.x, 1.0, -g.y));

  vec3 v = normalize(cameraPosition - vPosMundo);   // hacia la cámara
  vec3 l = normalize(uLuzDir);                      // hacia el sol

  // 2. Fresnel (aproximación de Schlick): mirando de frente se ve el agua,
  //    mirando rasante se refleja el cielo
  float fresnel = 0.02 + 0.98 * pow(1.0 - max(dot(n, v), 0.0), 5.0);

  // 3. Luz difusa + brillo especular del sol (Phong); ambos desaparecen en la sombra
  float sol = luzDelSol();
  float difusa = max(dot(n, l), 0.0) * sol;
  float brillo = pow(max(dot(reflect(-l, n), v), 0.0), 150.0) * sol;

  vec3 color = mix(uColorAgua * (0.4 * uAmbiente + 0.6 * difusa * uColorSol), uColorCielo, fresnel)
             + uColorSol * brillo * 1.5;
  float alfa = mix(0.75, 1.0, fresnel);              // más transparente de frente

  // 4. Niebla
  color = mix(color, uNieblaColor, smoothstep(uNieblaCerca, uNieblaLejos, vProfundidad));

  gl_FragColor = vec4(color, alfa);
  #include <colorspace_fragment>
}
