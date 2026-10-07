// Catálogo de lugares del Perú que aparecen en el menú.
//  - lat, lon: centro de la zona
//  - zoom: 9 = zona muy grande (~230 km), 11 = ~57 km, 12 = ~29 km, 14 = ~7 km
//  - agua (opcional): nivel inicial del agua en metros
//  - fuente (opcional): [lat, lon] de donde sale el agua (un lago, el mar);
//    si no se pone, el agua sale del punto más bajo de la zona.
//    En la costa el mar vale 0 m en los datos, por eso se usa un nivel de 1 m.

export const LUGARES = [
  { grupo: 'Ciudades', nombre: 'Lima y el Callao',                lat: -12.0800, lon: -77.0500, zoom: 11, agua: 1, fuente: [-12.20, -77.25] },
  { grupo: 'Ciudades', nombre: 'Cusco y Sacsayhuamán',            lat: -13.5200, lon: -71.9700, zoom: 12 },
  { grupo: 'Ciudades', nombre: 'Arequipa, Misti y Chachani',      lat: -16.2944, lon: -71.4089, zoom: 11 },
  { grupo: 'Ciudades', nombre: 'Trujillo y Chan Chan (La Libertad)', lat: -8.1100, lon: -79.0500, zoom: 12, agua: 1, fuente: [-8.15, -79.15] },
  { grupo: 'Ciudades', nombre: 'Cajamarca',                       lat:  -7.1700, lon: -78.5200, zoom: 12 },
  { grupo: 'Ciudades', nombre: 'Ayacucho y la Pampa de Quinua',   lat: -13.1000, lon: -74.1800, zoom: 11 },
  { grupo: 'Ciudades', nombre: 'Puno e Islas de los Uros',        lat: -15.8000, lon: -69.9500, zoom: 11, agua: 3820, fuente: [-15.80, -69.85] },
  { grupo: 'Ciudades', nombre: 'Iquitos (Loreto)',                lat:  -3.7500, lon: -73.2500, zoom: 11 },

  { grupo: 'Arqueología', nombre: 'Machu Picchu (Cusco)',          lat: -13.1631, lon: -72.5450, zoom: 14 },
  { grupo: 'Arqueología', nombre: 'Valle Sagrado (Cusco)',         lat: -13.3300, lon: -72.0500, zoom: 11 },
  { grupo: 'Arqueología', nombre: 'Chachapoyas, Kuélap y Gocta (Amazonas)', lat: -6.2200, lon: -77.9000, zoom: 11 },
  { grupo: 'Arqueología', nombre: 'Líneas de Nasca (Ica)',         lat: -14.7500, lon: -75.0500, zoom: 11 },

  { grupo: 'Nevados y cordilleras', nombre: 'Huascarán y Callejón de Huaylas (Áncash)', lat: -9.1217, lon: -77.6044, zoom: 11 },
  { grupo: 'Nevados y cordilleras', nombre: 'Alpamayo (Áncash)',             lat:  -8.8797, lon: -77.6539, zoom: 12 },
  { grupo: 'Nevados y cordilleras', nombre: 'Cordillera Huayhuash (Áncash)', lat: -10.2667, lon: -76.9000, zoom: 11 },
  { grupo: 'Nevados y cordilleras', nombre: 'Ausangate y Vinicunca (Cusco)', lat: -13.8300, lon: -71.2600, zoom: 11 },
  { grupo: 'Nevados y cordilleras', nombre: 'Salkantay y Humantay (Cusco)',  lat: -13.3450, lon: -72.5600, zoom: 12 },
  { grupo: 'Nevados y cordilleras', nombre: 'Coropuna (Arequipa)',           lat: -15.5300, lon: -72.6500, zoom: 11 },

  { grupo: 'Volcanes y cañones', nombre: 'Cañón del Colca (Arequipa)',       lat: -15.6300, lon: -71.7600, zoom: 11 },
  { grupo: 'Volcanes y cañones', nombre: 'Cañón del Cotahuasi (Arequipa)',   lat: -15.2200, lon: -72.8900, zoom: 11 },
  { grupo: 'Volcanes y cañones', nombre: 'Volcán Ubinas (Moquegua)',         lat: -16.3550, lon: -70.9030, zoom: 12 },

  { grupo: 'Lagos', nombre: 'Lago Titicaca (Puno)', lat: -15.8000, lon: -69.4000, zoom: 9,  agua: 3820, fuente: [-15.80, -69.40] },
  { grupo: 'Lagos', nombre: 'Lago Junín (Junín)',   lat: -11.0000, lon: -76.1200, zoom: 10, agua: 4090, fuente: [-11.00, -76.12] },

  { grupo: 'Costa y desierto', nombre: 'Paracas e Islas Ballestas (Ica)', lat: -13.8300, lon: -76.3000, zoom: 11, agua: 1, fuente: [-14.05, -76.29] },
  { grupo: 'Costa y desierto', nombre: 'Ica y Huacachina',                lat: -14.0800, lon: -75.7450, zoom: 12 },
];
