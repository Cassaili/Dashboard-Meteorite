/* =========================================================
   script.js  –  Dashboard: Meteoritos en la Tierra · NASA
   =========================================================
   Flujo:
   1. Leer Meteorite_Landings.csv con PapaParse.
   2. Limpiar y filtrar los datos.
   3. Calcular indicadores para las tarjetas.
   4. Crear 5 gráficas con Chart.js.
   ========================================================= */

// ── Paleta de colores del dashboard ─────────────────────────
const CIAN        = '#38b4ff';
const CIAN_DIM    = 'rgba(56,180,255,0.18)';
const CIAN_GRID   = 'rgba(56,180,255,0.08)';
const ORO         = '#f5c842';
const ORO_DIM     = 'rgba(245,200,66,0.18)';
const ROJO        = '#fc3d21';
const ROJO_DIM    = 'rgba(252,61,33,0.20)';
const VERDE       = '#3dfcb0';
const GRIS        = '#8899bb';
const BLANCO      = '#e8edf5';

// ── Opciones compartidas de tooltip ─────────────────────────
const sharedTooltip = {
  backgroundColor: '#0f1a2e',
  titleColor: CIAN,
  bodyColor: '#a0b0cc',
  borderColor: 'rgba(56,180,255,0.3)',
  borderWidth: 1,
  cornerRadius: 8,
  padding: 12,
};

// ── Opciones compartidas para ejes ──────────────────────────
const tickStyle = { color: GRIS, font: { family: "'DM Sans', sans-serif", size: 11 } };

// ==========================================================
// INICIO: PapaParse lee el CSV
// ==========================================================
Papa.parse('Meteorite_Landings.csv', {
  download: true,       // descarga el archivo desde la misma carpeta
  header: true,         // primera fila = nombre de columnas
  skipEmptyLines: true,
  complete: function(result) {
    procesarDatos(result.data);
  },
  error: function(err) {
    console.error('Error al leer el CSV:', err);
  }
});

// ==========================================================
// PROCESAMIENTO PRINCIPAL
// ==========================================================
function procesarDatos(filas) {

  // ── Arrays y objetos donde vamos a guardar los datos limpios ──
  const porAnio   = {};   // { año: cantidad }
  const porDecada = {};   // { década: cantidad }
  const porClase  = {};   // { clasificación: cantidad }
  let totalFell   = 0;
  let totalFound  = 0;
  let sumasMasa   = 0;
  let countMasa   = 0;
  const masivos   = [];   // para el top 10

  // ── Recorrer cada fila del CSV ───────────────────────────
  for (const fila of filas) {

    // --- Año ---
    const anioStr = fila['year'] ? fila['year'].trim() : '';
    const anio    = parseInt(anioStr);
    // Solo aceptamos años entre 860 y 2013
    const anioValido = !isNaN(anio) && anio >= 860 && anio <= 2013;

    if (anioValido) {
      // Contar por año
      porAnio[anio] = (porAnio[anio] || 0) + 1;
      // Contar por década (ej: 1990, 2000...)
      const decada = Math.floor(anio / 10) * 10;
      porDecada[decada] = (porDecada[decada] || 0) + 1;
    }

    // --- Masa ---
    const masaStr = fila['mass (g)'] ? fila['mass (g)'].trim() : '';
    const masa    = parseFloat(masaStr);
    const masaValida = !isNaN(masa) && masa > 0;

    if (masaValida) {
      sumasMasa += masa;
      countMasa++;
      // Guardar para el top 10
      masivos.push({ nombre: fila['name'] || 'Desconocido', masa: masa });
    }

    // --- Clasificación ---
    const clase = fila['recclass'] ? fila['recclass'].trim() : 'Desconocida';
    if (clase) {
      porClase[clase] = (porClase[clase] || 0) + 1;
    }

    // --- Fell / Found ---
    const fall = fila['fall'] ? fila['fall'].trim() : '';
    if (fall === 'Fell')  totalFell++;
    if (fall === 'Found') totalFound++;
  }

  // ── Calcular indicadores para las tarjetas ───────────────
  const totalRegistros = filas.length;
  const masaPromedio   = countMasa > 0 ? (sumasMasa / countMasa) : 0;

  // Meteorito con mayor masa
  masivos.sort((a, b) => b.masa - a.masa);
  const maxMeteoritoNombre = masivos.length > 0 ? masivos[0].nombre : '—';
  const maxMeteoritoMasa   = masivos.length > 0 ? masivos[0].masa   : 0;

  // Año con más registros
  let anioMaxCant  = 0;
  let anioMaxLabel = '—';
  for (const [anio, cant] of Object.entries(porAnio)) {
    if (cant > anioMaxCant) {
      anioMaxCant  = cant;
      anioMaxLabel = anio;
    }
  }

  // ── Actualizar tarjetas en el HTML ───────────────────────
  document.getElementById('val-total').textContent =
    totalRegistros.toLocaleString('es-MX');

  document.getElementById('val-mass').textContent =
    masaPromedio >= 1000
      ? (masaPromedio / 1000).toFixed(1) + ' kg'
      : masaPromedio.toFixed(1) + ' g';

  document.getElementById('val-max').textContent  = maxMeteoritoNombre;
  document.getElementById('val-year').textContent = anioMaxLabel;

  // ── Ocultar el badge de carga ────────────────────────────
  document.getElementById('loading-badge').classList.add('hidden');

  // ── Crear todas las gráficas ─────────────────────────────
  crearGraficaAnio(porAnio);
  crearGraficaFall(totalFell, totalFound);
  crearGraficaClasificacion(porClase);
  crearGraficaTop10(masivos.slice(0, 10));
  crearGraficaDecada(porDecada);
}

// ==========================================================
// HELPER: formatea masa en kg o g para tooltips
// ==========================================================
function formatMasa(g) {
  if (g >= 1000000) return (g / 1000000).toFixed(2) + ' t';
  if (g >= 1000)    return (g / 1000).toFixed(1) + ' kg';
  return g.toFixed(0) + ' g';
}

// ==========================================================
// GRÁFICA 1 – Registros por año (línea)
// ==========================================================
function crearGraficaAnio(porAnio) {

  // Ordenar los años de menor a mayor
  const aniosOrdenados = Object.keys(porAnio).map(Number).sort((a, b) => a - b);

  // Filtrar solo años modernos para que la gráfica sea legible
  // (mostrar 1970–2013 que es donde hay más datos)
  const aniosFiltrados = aniosOrdenados.filter(a => a >= 1970);
  const etiquetas      = aniosFiltrados.map(String);
  const valores        = aniosFiltrados.map(a => porAnio[a]);

  const ctx = document.getElementById('chart-year').getContext('2d');

  // Degradado de color para el área bajo la línea
  const degradado = ctx.createLinearGradient(0, 0, 0, 320);
  degradado.addColorStop(0,   'rgba(56,180,255,0.30)');
  degradado.addColorStop(0.7, 'rgba(56,180,255,0.05)');
  degradado.addColorStop(1,   'transparent');

  new Chart(ctx, {
    type: 'line',
    data: {
      labels: etiquetas,
      datasets: [{
        label: 'Meteoritos registrados',
        data: valores,
        borderColor: CIAN,
        borderWidth: 2,
        pointRadius: 2,
        pointHoverRadius: 5,
        pointBackgroundColor: CIAN,
        fill: true,
        backgroundColor: degradado,
        tension: 0.35,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          ...sharedTooltip,
          callbacks: {
            label: ctx => ` ${ctx.parsed.y.toLocaleString()} meteoritos`
          }
        }
      },
      scales: {
        x: {
          ticks: { ...tickStyle, maxRotation: 45 },
          grid: { color: CIAN_GRID },
        },
        y: {
          beginAtZero: true,
          ticks: { ...tickStyle, callback: v => v.toLocaleString() },
          grid: { color: CIAN_GRID },
        }
      }
    }
  });
}

// ==========================================================
// GRÁFICA 2 – Fell vs Found (dona)
// ==========================================================
function crearGraficaFall(fell, found) {
  const ctx = document.getElementById('chart-fall').getContext('2d');

  // Actualizar la etiqueta central de la dona
  const total = fell + found;
  const pctFell = total > 0 ? ((fell / total) * 100).toFixed(1) : 0;
  document.getElementById('donut-label').innerHTML =
    `<span class="big">${pctFell}%</span><span class="small">Fell</span>`;

  new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Fell (observado)', 'Found (encontrado)'],
      datasets: [{
        data: [fell, found],
        backgroundColor: [CIAN_DIM, ORO_DIM],
        borderColor:     [CIAN,     ORO],
        borderWidth: 2,
        hoverOffset: 8,
      }]
    },
    options: {
      responsive: true,
      cutout: '68%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color: GRIS,
            font: { family: "'DM Sans', sans-serif", size: 11 },
            padding: 12,
          }
        },
        tooltip: {
          ...sharedTooltip,
          callbacks: {
            label: ctx => {
              const pct = ((ctx.parsed / (fell + found)) * 100).toFixed(1);
              return ` ${ctx.label}: ${ctx.parsed.toLocaleString()} (${pct}%)`;
            }
          }
        }
      }
    }
  });
}

// ==========================================================
// GRÁFICA 3 – Top 10 clasificaciones (barras horizontales)
// ==========================================================
function crearGraficaClasificacion(porClase) {

  // Ordenar por cantidad, tomar los 10 primeros
  const top10 = Object.entries(porClase)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  const etiquetas = top10.map(([clase]) => clase);
  const valores   = top10.map(([, cant]) => cant);

  // Degradado de colores por posición
  const colores = etiquetas.map((_, i) => {
    const alpha = 0.7 - (i * 0.05);
    return `rgba(56,180,255,${alpha})`;
  });

  const ctx = document.getElementById('chart-class').getContext('2d');

  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: etiquetas,
      datasets: [{
        label: 'Cantidad',
        data: valores,
        backgroundColor: colores,
        borderColor: CIAN,
        borderWidth: 1,
        borderRadius: 4,
        borderSkipped: false,
      }]
    },
    options: {
      indexAxis: 'y',    // barras horizontales
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          ...sharedTooltip,
          callbacks: { label: ctx => ` ${ctx.parsed.x.toLocaleString()} meteoritos` }
        }
      },
      scales: {
        x: {
          beginAtZero: true,
          ticks: { ...tickStyle, callback: v => v.toLocaleString() },
          grid: { color: CIAN_GRID },
        },
        y: {
          ticks: { ...tickStyle, font: { family: "'DM Sans', sans-serif", size: 10 } },
          grid: { display: false },
        }
      }
    }
  });
}

// ==========================================================
// GRÁFICA 4 – Top 10 meteoritos por masa (barras verticales)
// ==========================================================
function crearGraficaTop10(masivos) {
  const ctx = document.getElementById('chart-top10').getContext('2d');

  const etiquetas = masivos.map(m => m.nombre);
  // Convertir a toneladas para mejor legibilidad
  const valores   = masivos.map(m => parseFloat((m.masa / 1000000).toFixed(3))); // toneladas

  // Color dorado para el primero, azul para el resto
  const colores = masivos.map((_, i) =>
    i === 0 ? ORO_DIM : CIAN_DIM
  );
  const bordes = masivos.map((_, i) =>
    i === 0 ? ORO : CIAN
  );

  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: etiquetas,
      datasets: [{
        label: 'Masa (toneladas)',
        data: valores,
        backgroundColor: colores,
        borderColor: bordes,
        borderWidth: 1.5,
        borderRadius: 6,
        borderSkipped: false,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          ...sharedTooltip,
          callbacks: {
            label: ctx => {
              // También mostramos la masa original en la tarjeta del top
              const original = masivos[ctx.dataIndex].masa;
              return ` ${formatMasa(original)} (${ctx.parsed.y.toFixed(2)} t)`;
            }
          }
        }
      },
      scales: {
        x: {
          ticks: {
            ...tickStyle,
            maxRotation: 30,
            font: { family: "'DM Sans', sans-serif", size: 10 }
          },
          grid: { display: false },
        },
        y: {
          beginAtZero: true,
          ticks: { ...tickStyle, callback: v => v + ' t' },
          grid: { color: CIAN_GRID },
        }
      }
    }
  });
}

// ==========================================================
// GRÁFICA 5 – Registros por década (barras de columna)
// ==========================================================
function crearGraficaDecada(porDecada) {

  // Ordenar décadas de menor a mayor
  const decadasOrdenadas = Object.keys(porDecada).map(Number).sort((a, b) => a - b);
  const etiquetas = decadasOrdenadas.map(d => d + 's');
  const valores   = decadasOrdenadas.map(d => porDecada[d]);

  // Paleta alternada suave
  const colores = decadasOrdenadas.map((d, i) => {
    if (d >= 2000) return ORO_DIM;
    if (d >= 1980) return CIAN_DIM;
    return 'rgba(61,252,176,0.18)'; // verde suave para décadas más antiguas
  });
  const bordes = decadasOrdenadas.map((d) => {
    if (d >= 2000) return ORO;
    if (d >= 1980) return CIAN;
    return VERDE;
  });

  const ctx = document.getElementById('chart-decade').getContext('2d');

  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: etiquetas,
      datasets: [{
        label: 'Meteoritos registrados',
        data: valores,
        backgroundColor: colores,
        borderColor: bordes,
        borderWidth: 1.5,
        borderRadius: 6,
        borderSkipped: false,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          ...sharedTooltip,
          callbacks: {
            label: ctx => ` ${ctx.parsed.y.toLocaleString()} meteoritos`
          }
        }
      },
      scales: {
        x: {
          ticks: { ...tickStyle },
          grid: { display: false },
        },
        y: {
          beginAtZero: true,
          ticks: { ...tickStyle, callback: v => v.toLocaleString() },
          grid: { color: CIAN_GRID },
        }
      }
    }
  });
}
