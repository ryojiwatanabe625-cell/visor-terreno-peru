// Vertex shader de los edificios (ver js/edificios.js)

attribute vec3 tono;         // color de la fachada (sRGB)
attribute vec2 fachada;      // (metros a lo largo del contorno, metros sobre la base)
attribute vec2 uvMapa;       // posición en la foto satelital del terreno
attribute float techo;       // 1 = techo, 0 = pared
attribute float semilla;     // número al azar fijo por edificio (0..1)
uniform mat4 uSombraMatriz;  // mundo -> vista del sol
uniform float uDesplazNormal;
varying vec3 vNormal;
varying vec3 vTono;
varying vec2 vFachada;
varying vec2 vUvMapa;
varying float vTecho;
varying float vSemilla;
varying float vProfundidad;
varying vec4 vPosSombra;

void main() {
  vNormal = normal;
  vTono = tono;
  vFachada = fachada;
  vUvMapa = uvMapa;
  vTecho = techo;
  vSemilla = semilla;
  vec4 posMundo = modelMatrix * vec4(position, 1.0);
  vPosSombra = uSombraMatriz * vec4(posMundo.xyz + normal * uDesplazNormal, 1.0);
  vec4 posVista = viewMatrix * posMundo;
  vProfundidad = -posVista.z;
  gl_Position = projectionMatrix * posVista;
}
