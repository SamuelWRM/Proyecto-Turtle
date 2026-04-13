// ── Configuración ──
// Cambia esta URL por la de ngrok o Cloudflare cuando lo despliegues
const BASE_URL = "https://costumes-register-pac-mold.trycloudflare.com";

// Número total de cámaras del sistema
const TOTAL_CAMARAS = 6;

// Cámara que se muestra en el principal al abrir la página
const CAMARA_INICIAL = 6;

// Aquí guardamos los objetos Hls de cada cámara para poder
// reutilizarlos cuando el usuario cambie de cámara principal.
// La clave es el número de cámara y el valor es el objeto Hls.
const hlsInstancias = {};

// Número de la cámara que actualmente está en el reproductor principal
let camaraPrincipalActual = CAMARA_INICIAL;

// ── Reloj ──
function actualizarReloj() {
  document.getElementById("reloj").textContent = new Date().toLocaleTimeString(
    "es-MX",
  );
}
setInterval(actualizarReloj, 1000);
actualizarReloj();

// ── Función para iniciar un stream HLS ──
// Le pide al backend que arranque FFmpeg para esa cámara
// y devuelve la URL del playlist .m3u8
async function iniciarStream(numeroCamara) {
  try {
    const respuesta = await fetch(
      `${BASE_URL}/stream/iniciar/${numeroCamara}`,
      {
        method: "POST",
      },
    );
    const datos = await respuesta.json();
    // La URL del stream viene como ruta relativa, la combinamos con BASE_URL
    return `${BASE_URL}${datos.url_stream}`;
  } catch (error) {
    console.error(`Error iniciando stream cámara ${numeroCamara}:`, error);
    return null;
  }
}

// ── Función para conectar HLS.js a un elemento <video> ──
// Recibe el elemento de video, la URL del .m3u8 y el número de cámara.
// Guarda la instancia de Hls para reutilizarla si el usuario
// cambia esa cámara al principal sin tener que reiniciar FFmpeg.
function conectarHls(videoElement, urlStream, numeroCamara) {
  // Si HLS.js está disponible (Chrome, Firefox, Edge)
  if (Hls.isSupported()) {
    // Si ya existe una instancia de Hls para esta cámara, la destruimos
    // antes de crear una nueva para evitar conflictos de memoria
    if (hlsInstancias[numeroCamara]) {
      hlsInstancias[numeroCamara].destroy();
    }

    const hls = new Hls({
      // Cuántos fragmentos de buffer mantener. Con 3 tenemos
      // unos 6 segundos de buffer (3 fragmentos × 2 segundos cada uno)
      liveSyncDurationCount: 3,
      // Si el buffer se retrasa demasiado, HLS.js salta al fragmento más reciente
      liveMaxLatencyDurationCount: 5,
    });

    hls.loadSource(urlStream);
    hls.attachMedia(videoElement);

    // Cuando el playlist esté listo, reproducir automáticamente
    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      videoElement.play().catch(() => {
        // Si el navegador bloquea el autoplay, no pasa nada,
        // el usuario puede darle play manualmente
      });
    });

    // Guardar la instancia para reutilizarla después
    hlsInstancias[numeroCamara] = hls;
  } else if (videoElement.canPlayType("application/vnd.apple.mpegurl")) {
    // Safari en Mac e iOS soporta HLS nativamente sin necesitar HLS.js
    videoElement.src = urlStream;
    videoElement.play().catch(() => {});
  }
}

// ── Función para cambiar la cámara principal ──
// Cuando el usuario hace click en una cámara secundaria,
// conectamos esa cámara al video principal y actualizamos
// el estado visual del panel lateral.
function cambiarCamaraPrincipal(numeroCamara, urlStream) {
  const videoPrincipal = document.getElementById("primaryVideo");
  const labelPrincipal = document.getElementById("primaryLabel");

  // Actualizar el label que indica qué cámara se está viendo
  labelPrincipal.textContent = `CAM ${numeroCamara} — PRINCIPAL`;

  // Conectar el stream de la cámara seleccionada al video principal
  conectarHls(videoPrincipal, urlStream, `principal_${numeroCamara}`);

  // Actualizar el estado visual del panel lateral:
  // quitamos la clase "active" de la cámara anterior
  // y se la ponemos a la nueva cámara seleccionada
  document.querySelectorAll(".cam-box").forEach((box) => {
    box.classList.remove("active");
  });
  const boxActivo = document.querySelector(
    `.cam-box[data-cam="${numeroCamara}"]`,
  );
  if (boxActivo) boxActivo.classList.add("active");

  camaraPrincipalActual = numeroCamara;
}

// ── Función principal: iniciar todos los streams y construir el UI ──
async function inicializarSistema() {
  const sideCol = document.getElementById("sideCol");

  // Iniciamos todos los streams en paralelo con Promise.all
  // En lugar de esperar que termine el stream 1 para iniciar el 2,
  // los lanzamos todos al mismo tiempo y esperamos que todos terminen.
  // Esto reduce el tiempo de carga de 6 peticiones secuenciales a 1 sola espera.
  const urls = await Promise.all(
    Array.from({ length: TOTAL_CAMARAS }, (_, i) => iniciarStream(i + 1)),
  );

  // Con las URLs listas, construimos el panel lateral y conectamos los streams
  urls.forEach((urlStream, index) => {
    const numeroCamara = index + 1;

    if (!urlStream) return; // Si el stream no pudo iniciar, saltamos esa cámara

    // ── Crear la caja de la cámara secundaria en el panel lateral ──
    const box = document.createElement("div");
    box.className = "cam-box";
    box.dataset.cam = numeroCamara; // Guardamos el número para identificarla después

    // Marcar como activa la cámara que está en el principal por defecto
    if (numeroCamara === CAMARA_INICIAL) box.classList.add("active");

    const label = document.createElement("span");
    label.className = "cam-label";
    label.textContent = `CAM ${numeroCamara}`;

    // El video secundario va silenciado (muted) porque si no,
    // tendríamos el audio de 6 cámaras al mismo tiempo
    const videoSecundario = document.createElement("video");
    videoSecundario.className = "secondary-video";
    videoSecundario.muted = true;
    videoSecundario.autoplay = true;
    videoSecundario.playsInline = true;

    box.appendChild(label);
    box.appendChild(videoSecundario);
    sideCol.appendChild(box);

    // Conectar el stream HLS a este video secundario
    conectarHls(videoSecundario, urlStream, numeroCamara);

    // Al hacer click en la caja, mover esa cámara al reproductor principal
    box.addEventListener("click", () => {
      // No hacer nada si ya es la cámara principal
      if (numeroCamara === camaraPrincipalActual) return;
      cambiarCamaraPrincipal(numeroCamara, urlStream);
    });
  });

  // ── Conectar la cámara inicial al reproductor principal ──
  const urlCamaraInicial = urls[CAMARA_INICIAL];
  if (urlCamaraInicial) {
    const videoInicial = document.getElementById("primaryVideo");
    conectarHls(videoInicial, urlCamaraInicial, `principal_${CAMARA_INICIAL}`);
  }
}

// Arrancar el sistema cuando la página termine de cargar
inicializarSistema();
