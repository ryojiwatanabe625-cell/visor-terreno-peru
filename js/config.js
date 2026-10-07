// Parámetros generales del visor

export const EXAGERAR = 1.5;                                        // exageración vertical del relieve
export const INTERVALOS = [10, 25, 50, 100, 200, 250, 500, 1000];   // metros entre curvas de nivel
export const TAM_SOMBRA = 2048;                                     // resolución del mapa de sombras
export const MAX_TEXTURA = 4096;                                    // tamaño máximo de la foto satelital (px)
export const MAX_ZOOM_ALTURAS = 15;                                 // zoom máximo de los datos de altura
export const MAX_ZOOM_DETALLE = 17;                                 // zoom máximo de la foto de detalle (~1 m por píxel)
export const TILES_DETALLE = 8;                                     // la foto de detalle es de 8x8 tiles (2048 px)
export const COLOR_CIELO_DIA = 0x9cc3e6;
export const COLOR_CIELO_ATARDECER = 0xe8a87c;
