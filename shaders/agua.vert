// Vertex shader del agua (un plano horizontal)

uniform mat4 uSombraMatriz;
uniform float uDesplazNormal;
varying vec3 vPosMundo;
varying vec2 vUv;
varying float vProfundidad;
varying vec4 vPosSombra;

void main() {
  vUv = uv;
  vec4 posMundo = modelMatrix * vec4(position, 1.0);
  vPosMundo = posMundo.xyz;
  vPosSombra = uSombraMatriz * vec4(posMundo.xyz + normal * uDesplazNormal, 1.0);
  vec4 posVista = viewMatrix * posMundo;
  vProfundidad = -posVista.z;
  gl_Position = projectionMatrix * posVista;
}
