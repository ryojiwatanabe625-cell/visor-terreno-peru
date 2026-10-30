// Panel de control: conecta los menús, barras y teclado del HTML con el visor.
// No sabe nada de gráficos: solo llama a las "acciones" que le pasa main.js.

export function crearInterfaz(acciones) {
  const $ = id => document.getElementById(id);
  const menu = $('lugar'), tamano = $('tamano');
  const campoCoords = $('coords'), zoomPropio = $('zoomPropio');
  const nivel = $('nivel'), nivelTxt = $('nivelTxt');
  const hora = $('hora'), horaTxt = $('horaTxt');
  const datos = $('datos'), leyenda = $('leyenda');

  // Menú de lugares, agrupado
  const grupos = {};
  acciones.lugares.forEach((lugar, i) => {
    if (!grupos[lugar.grupo]) {
      grupos[lugar.grupo] = document.createElement('optgroup');
      grupos[lugar.grupo].label = lugar.grupo;
      menu.append(grupos[lugar.grupo]);
    }
    grupos[lugar.grupo].append(new Option(lugar.nombre, i));
  });
  menu.addEventListener('change', () => {
    acciones.elegirLugar(acciones.lugares[menu.value]);
    menu.blur();   // para que las teclas sigan funcionando
  });
  tamano.addEventListener('change', () => {
    acciones.cambiarTamano();
    tamano.blur();
  });

  // Coordenadas pegadas desde Google Maps, por ejemplo "-13.163141, -72.545872"
  function irACoordenadas() {
    const nums = campoCoords.value.match(/-?\d+(\.\d+)?/g)?.map(Number);
    if (!nums || nums.length < 2 || Math.abs(nums[0]) > 85 || Math.abs(nums[1]) > 180) {
      datos.textContent = 'Escribe latitud y longitud, por ejemplo: -13.16, -72.54';
      return;
    }
    menu.selectedIndex = -1;
    acciones.elegirLugar({ nombre: 'Coordenadas propias', lat: nums[0], lon: nums[1], zoom: +zoomPropio.value });
    campoCoords.blur();
  }
  $('ir').addEventListener('click', irACoordenadas);
  campoCoords.addEventListener('keydown', e => { if (e.key === 'Enter') irACoordenadas(); });

  // Barras del agua y de la hora
  nivel.addEventListener('input', () => acciones.cambiarNivel(+nivel.value));
  nivel.addEventListener('change', () => nivel.blur());
  hora.addEventListener('input', () => acciones.cambiarHora(+hora.value));
  hora.addEventListener('change', () => hora.blur());

  // Botón para volver a la zona anterior (después de un doble clic)
  const volver = $('volver');
  volver.addEventListener('click', () => {
    acciones.volver();
    volver.blur();
  });

  // Atajos de teclado (excepto mientras se escriben coordenadas)
  addEventListener('keydown', e => {
    if (e.target === campoCoords) return;
    acciones.tecla(e.key.toLowerCase());
  });

  // Botones con las mismas acciones que el teclado (para pantallas táctiles)
  const botones = [...document.querySelectorAll('#botones [data-tecla]')];
  botones.forEach(b => b.addEventListener('click', () => {
    acciones.tecla(b.dataset.tecla);
    b.blur();
  }));

  // Panel plegable: en celulares empieza plegado para que se vea el terreno
  const info = $('info');
  if (matchMedia('(max-width: 600px)').matches) info.classList.add('plegado');
  $('plegar').addEventListener('click', () => info.classList.toggle('plegado'));

  // Copiar el enlace de la vista actual (la URL ya guarda lugar, agua y hora)
  const compartir = $('compartir');
  compartir.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(location.href);
      compartir.textContent = '¡Copiado!';
    } catch {
      prompt('Copia este enlace:', location.href);
    }
    setTimeout(() => { compartir.textContent = 'Copiar enlace'; }, 1500);
    compartir.blur();
  });

  return {
    get tamano() { return +tamano.value; },
    set tamano(n) { if ([...tamano.options].some(o => +o.value === n)) tamano.value = n; },
    marcarLugar(i) { menu.value = i ?? ''; if (i == null) menu.selectedIndex = -1; },
    // activos: { t: true, c: false, ... } -> resalta los botones encendidos
    marcarBotones(activos) {
      botones.forEach(b => b.classList.toggle('activo', !!activos[b.dataset.tecla]));
    },
    mostrarDatos(texto) { datos.textContent = texto; },
    mostrarFoto(texto) { $('foto').textContent = texto; },
    mostrarEdificios(texto) {
      $('edificiosTxt').textContent = texto ? `Edificios 3D: ${texto}` : '';
      $('edificiosTxt').style.display = texto ? 'block' : 'none';
    },
    permitirVolver(si) { volver.disabled = !si; },
    configurarNivel(min, max, valor) {
      nivel.min = Math.floor(min);
      nivel.max = Math.ceil(max);
      nivel.value = valor ?? nivel.min;
      return +nivel.value;
    },
    mostrarNivel(texto) { nivelTxt.textContent = texto; },
    mostrarHora(h) {
      hora.value = h;
      const minutos = Math.round(h * 12) * 5;   // redondeado a 5 minutos
      horaTxt.textContent = `${Math.floor(minutos / 60)}:${String(minutos % 60).padStart(2, '0')}`;
    },
    mostrarLeyenda(visible) { leyenda.style.display = visible ? 'block' : 'none'; },
  };
}
