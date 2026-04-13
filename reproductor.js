// ── Configuración ──
const BASE_URL = "https://costumes-register-pac-mold.trycloudflare.com"; // Cambia por tu URL de ngrok/cloudflare

// ── Reloj ──
function actualizarReloj() {
  document.getElementById("reloj").textContent = new Date().toLocaleTimeString(
    "es-MX",
  );
}
setInterval(actualizarReloj, 1000);
actualizarReloj();

// ── Leer parámetros de la URL ──
// La URL llega como: reproductor.html?cam=3&archivo=2026-04-06_14-30-00.mp4
const params = new URLSearchParams(window.location.search);
const numeroCamara = params.get("cam");
const nombreArchivo = params.get("archivo");

// Si faltan parámetros, regresar a la selección de cámara
if (!numeroCamara || !nombreArchivo) {
  window.location.href = "Grabaciones.html";
}

// ── Actualizar info del video en la UI ──
document.getElementById("playerFilename").textContent = nombreArchivo;
document.getElementById("playerCaminfo").textContent = `Cámara ${numeroCamara}`;

// El botón de volver regresa a la lista de grabaciones de esa cámara
document.getElementById("btnBack").href =
  `Grabaciones.html?cam=${numeroCamara}`;

// ── Cargar el video en el reproductor ──
// Apuntamos el src del <video> al endpoint de FastAPI que sirve el archivo

const videoPlayer = document.getElementById("videoPlayer");
//Por aqui se pasan los parametros que llegan al backend, al ser una asignacion a un src
//no se necesita el get (para recibir el video) ni el post (para asignar los parametros)
//para esto se ocupa que en el backend este el mismo patron de llaves ({}) para que pueda entender que esta
//recibiendo parametros
videoPlayer.src = `${BASE_URL}/video/${numeroCamara}/${nombreArchivo}`;

// ── Referencias a elementos del DOM ──
const btnAnalyze = document.getElementById("btnAnalyze");
const stateIdle = document.getElementById("stateIdle");
const stateLoading = document.getElementById("stateLoading");
const resultContainer = document.getElementById("resultContainer");
const resultText = document.getElementById("resultText");
const timestampsSection = document.getElementById("timestampsSection");
const timestampsList = document.getElementById("timestampsList");

// ── Función para mostrar solo un estado a la vez ──
function mostrarEstado(estado) {
  stateIdle.style.display = "none";
  stateLoading.style.display = "none";
  resultContainer.style.display = "none";
  if (estado) estado.style.display = "flex";
}

// ── Función que convierte "MM:SS" o "HH:MM:SS" a segundos ──
// Esto es necesario para poder saltar el video al momento exacto
// porque videoPlayer.currentTime funciona en segundos, no en formato de texto
function timestampASegundos(timestamp) {
  const partes = timestamp.split(":").map(Number);
  if (partes.length === 2) {
    // Formato MM:SS
    return partes[0] * 60 + partes[1];
  } else if (partes.length === 3) {
    // Formato HH:MM:SS
    return partes[0] * 3600 + partes[1] * 60 + partes[2];
  }
  return 0;
}

// ── Función que busca timestamps en el texto de Gemini ──
// Gemini devuelve el análisis como texto libre, y los timestamps
// generalmente aparecen en formato MM:SS o HH:MM:SS dentro del texto.
// Esta función los detecta con una expresión regular y los extrae.
function extraerTimestamps(texto) {
  const timestamps = [];

  // Esta expresión regular busca patrones como:
  // "02:35", "1:23:45", seguidos de texto descriptivo
  // El patrón captura el tiempo y la descripción que le sigue en la misma línea
  const regex = /(\d{1,2}:\d{2}(?::\d{2})?)[^\n\r]*/g;
  let match;

  while ((match = regex.exec(texto)) !== null) {
    const lineaCompleta = match[0].trim();
    const tiempo = match[1];

    // Extraemos la descripción quitando el timestamp del inicio de la línea
    const descripcion = lineaCompleta
      .replace(tiempo, "")
      .replace(/^[\s\-:–]+/, "")
      .trim();

    if (descripcion) {
      timestamps.push({ tiempo, descripcion });
    }
  }

  return timestamps;
}

// ── Función que crea un botón clickeable por cada timestamp ──
function crearTimestampBtn(tiempo, descripcion) {
  const btn = document.createElement("button");
  btn.className = "timestamp-btn";
  btn.innerHTML = `
    <span class="timestamp-time">${tiempo}</span>
    <span class="timestamp-desc">${descripcion}</span>
  `;

  // Al hacer click, convertimos el tiempo a segundos
  // y se lo asignamos al video para que salte a ese momento
  btn.addEventListener("click", () => {
    const segundos = timestampASegundos(tiempo);
    videoPlayer.currentTime = segundos;
    // También le damos play automáticamente para que empiece a reproducir
    videoPlayer.play();
    // Hacemos scroll hacia arriba para que el usuario vea el video
    videoPlayer.scrollIntoView({ behavior: "smooth" });
  });

  return btn;
}

// ── Lógica principal: analizar el video con Gemini ──
btnAnalyze.addEventListener("click", async () => {
  btnAnalyze.disabled = true;
  mostrarEstado(stateLoading);
  stateLoading.style.display = "flex";

  try {
    // Mandamos al backend el número de cámara y el nombre del archivo
    // El backend se encargará de subirlo a Gemini y devolver el análisis
    const respuesta = await fetch(`${BASE_URL}/analizar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        numero_camara: parseInt(numeroCamara),
        nombre_archivo: nombreArchivo,
      }),
    });

    const datos = await respuesta.json();

    // Mostrar el texto del análisis
    resultText.textContent = datos.resultado;

    // Buscar timestamps en el texto que devolvió Gemini
    const timestamps = extraerTimestamps(datos.resultado);

    if (timestamps.length > 0) {
      // Si encontró timestamps, mostrar la sección y generar los botones
      timestampsSection.style.display = "flex";
      timestampsList.innerHTML = ""; // Limpiar por si se analiza más de una vez

      timestamps.forEach(({ tiempo, descripcion }) => {
        timestampsList.appendChild(crearTimestampBtn(tiempo, descripcion));
      });
    } else {
      // Si no encontró timestamps, ocultar esa sección
      timestampsSection.style.display = "none";
    }

    // Mostrar el resultado
    resultContainer.style.display = "flex";
    mostrarEstado(null);
    resultContainer.style.display = "flex";
  } catch (error) {
    // Si algo falla, mostrar el error en el área de resultado
    resultText.textContent =
      "Error al conectar con el backend, intente de nuevo mas tarde: " +
      error.message;
    resultContainer.style.display = "flex";
    mostrarEstado(null);
    resultContainer.style.display = "flex";
  } finally {
    btnAnalyze.disabled = false;
  }
});
