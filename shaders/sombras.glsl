// Función de sombras compartida por el terreno y el agua.
// Se pega al inicio de terreno.frag y agua.frag al cargar los shaders (ver js/main.js).

uniform sampler2D uMapaSombra;  // profundidad de la escena vista desde el sol
uniform bool uSombras;
uniform float uTexelSombra;     // tamaño de un píxel del mapa de sombras (1 / 2048)
varying vec4 vPosSombra;        // este punto, visto desde el sol

// Shadow mapping: 1 = le llega el sol, 0 = algo se lo tapa.
// Se promedian 3x3 muestras vecinas (PCF) para que el borde de la sombra sea suave.
float luzDelSol() {
  if (!uSombras) return 1.0;
  vec3 c = vPosSombra.xyz / vPosSombra.w * 0.5 + 0.5;   // de [-1, 1] a [0, 1]
  if (c.x < 0.0 || c.x > 1.0 || c.y < 0.0 || c.y > 1.0 || c.z > 1.0) return 1.0;
  float luz = 0.0;
  for (int x = -1; x <= 1; x++)
    for (int y = -1; y <= 1; y++) {
      // textureLod (nivel 0) en vez de texture2D: dentro de un bucle la GPU no puede
      // calcular bien qué mipmap usar, y el mapa de sombras no tiene mipmaps de todos modos
      float profSol = textureLod(uMapaSombra, c.xy + vec2(x, y) * uTexelSombra, 0.0).r;
      luz += (c.z - 0.0005 > profSol) ? 0.0 : 1.0;   // ¿hay algo más cerca del sol que yo?
    }
  return luz / 9.0;
}
