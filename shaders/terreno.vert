// Vertex shader del terreno

attribute float altura;      // altura real en metros (por vértice)
attribute float mojado;      // 1 si el agua llega a este vértice, 0 si no
uniform float uNivelY;       // altura del agua en unidades de la escena
uniform float uHundir;       // cuánto bajar el fondo para que no choque con el agua
uniform mat4 uSombraMatriz;  // mundo -> vista del sol
uniform float uDesplazNormal;
varying float vAltura;
varying float vMojado;
varying vec3 vNormal;
varying vec2 vUv;
varying float vProfundidad;
varying vec4 vPosSombra;

void main() {
  vAltura = altura;
  vMojado = mojado;
  vNormal = normal;          // el terreno no se rota, así que la normal ya está en el mundo
  vUv = uv;

  // El fondo justo debajo del agua se hunde un poco: si quedara a la misma
  // altura que el agua, la GPU no sabría cuál dibujar encima (z-fighting)
  vec3 p = position;
  if (mojado > 0.5) p.y = min(p.y, uNivelY - uHundir);
  vec4 posMundo = modelMatrix * vec4(p, 1.0);

  // Se separa un poco el punto de la superficie (a lo largo de la normal) para que
  // el terreno no se haga sombra a sí mismo por falta de resolución ("shadow acne")
  vPosSombra = uSombraMatriz * vec4(posMundo.xyz + normal * uDesplazNormal, 1.0);

  vec4 posVista = viewMatrix * posMundo;
  vProfundidad = -posVista.z; // distancia a la cámara (para la niebla)
  gl_Position = projectionMatrix * posVista;
}
