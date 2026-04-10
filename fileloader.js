// ── Leer el número de cámara desde la URL ──
// Cuando el usuario hizo click en "Cámara 3" en la página anterior,
// llegó aquí con una URL como: grabaciones-lista.html?cam=3
// URLSearchParams nos permite leer ese parámetro fácilmente
const params = new URLSearchParams(window.location.search);
const numeroCamara = params.get("cam");

// Si no hay parámetro de cámara en la URL, regresar a la selección
if (!numeroCamara) {
  window.location.href = "select_grab.html";
}

// Actualizar el título con el número de cámara
document.getElementById("pageTitle").textContent =
  `Grabaciones — Cámara ${numeroCamara}`;

// ── Referencias a los elementos del DOM ──
const grid = document.getElementById("recordingsGrid");
const stateLoading = document.getElementById("stateLoading");
const stateEmpty = document.getElementById("stateEmpty");
const stateError = document.getElementById("stateError");
const subtitle = document.getElementById("pageSubtitle");

// ── Función para mostrar solo un estado a la vez ──
function mostrarEstado(estado) {
  stateLoading.style.display = "none";
  stateEmpty.style.display = "none";
  stateError.style.display = "none";
  if (estado) estado.style.display = "flex";
}

// ── Función que genera una tarjeta por cada grabación ──
function crearTarjeta(nombreArchivo) {
  // Quitamos la extensión .mp4 y reemplazamos _ por espacios
  // para que "2026-04-06_14-30-00" se lea como "2026-04-06 14:30:00"
  const fecha = nombreArchivo
    .replace(".mp4", "")
    .replace("_", " ")
    .replace(/-/g, "/"); // Los guiones de la fecha a diagonal

  const card = document.createElement("div");
  card.className = "recording-card";
  card.innerHTML = `
        <div class="card-icon"></div>
        <span class="card-date">${fecha}</span>
        <span class="card-badge">MP4</span>
      `;

  // Al hacer click en la tarjeta, más adelante aquí irá
  // la lógica para mandar el video a analizar con Gemini
  card.addEventListener("click", () => {
    console.log("Seleccionado:", nombreArchivo);
    card.addEventListener("click", () => {
      // Mandamos el número de cámara y el nombre del archivo como parámetros en la URL
      window.location.href = `video.html?cam=${numeroCamara}&archivo=${nombreArchivo}`;
    });
  });

  return card;
}

// ── Pedir las grabaciones al backend ──
async function cargarGrabaciones() {
  const baseUrl = "http://localhost:8000"; // Cambia esto por tu URL de ngrok/cloudflare

  try {
    const respuesta = await fetch(`${baseUrl}/grabaciones/${numeroCamara}`);
    const datos = await respuesta.json();

    if (datos.grabaciones.length === 0) {
      // No hay grabaciones en esa carpeta
      mostrarEstado(stateEmpty);
      subtitle.textContent = "Sin grabaciones disponibles";
      return;
    }

    // Ocultar el estado de carga y mostrar el grid
    mostrarEstado(null);
    subtitle.textContent = `${datos.grabaciones.length} grabación(es) encontrada(s)`;

    // Generar una tarjeta por cada archivo encontrado
    datos.grabaciones.forEach((archivo) => {
      grid.appendChild(crearTarjeta(archivo));
    });
  } catch (error) {
    // Si el backend no responde, mostrar el error
    mostrarEstado(stateError);
    document.getElementById("errorMsg").textContent =
      "No se pudo conectar con el Servidor. ¿Está conectado a Internet?";
  }
}

// Ejecutar al cargar la página
cargarGrabaciones();
