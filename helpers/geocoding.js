const AppError = require("./AppError");

const NOMINATIM_SEARCH_URL = "https://nominatim.openstreetmap.org/search";

// La app está acotada a Tucumán (ver helpers/localidades.js). Sin esto, un nombre
// ambiguo como "Florida" o "Capital" puede matchear una calle/ciudad real pero en
// otra provincia — un resultado que parece preciso pero está en el lugar
// equivocado, mucho peor que uno directamente sin resultados.
const TUCUMAN_VIEWBOX = "-66.4,-25.8,-64.3,-27.7"; // izquierda,arriba,derecha,abajo

// Clasificaciones de Nominatim que corresponden a un match a nivel administrativo
// (provincia, departamento, país) en vez de una dirección puntual — no son lo
// bastante precisas como para mostrarlas como si fueran una dirección concreta.
const CLASES_IMPRECISAS = new Set(["boundary"]);
const TIPOS_IMPRECISOS = new Set(["administrative", "state", "county", "country", "region"]);

const esResultadoImpreciso = ({ clase, tipo }) =>
  CLASES_IMPRECISAS.has(clase) || TIPOS_IMPRECISOS.has(tipo);

// Nominatim exige un User-Agent identificable con datos de contacto de la app.
const construirUserAgent = () =>
  `PerdidosYAdopcionesBackend/1.0 (${process.env.FRONTEND_URL || "sin-contacto-configurado"})`;

const geocodificarDireccion = async ({ direccion, contexto }) => {
  const query = [direccion, contexto].filter(Boolean).join(", ");
  const params = new URLSearchParams({
    q: query,
    format: "jsonv2",
    limit: "1",
    countrycodes: "ar",
    viewbox: TUCUMAN_VIEWBOX,
    bounded: "1",
  });

  let response;
  try {
    response = await fetch(`${NOMINATIM_SEARCH_URL}?${params.toString()}`, {
      headers: { "User-Agent": construirUserAgent() },
    });
  } catch (error) {
    throw new AppError("No se pudo conectar con el servicio de geocoding", 502);
  }

  if (!response.ok) {
    throw new AppError("El servicio de geocoding respondió con un error", 502);
  }

  const resultados = await response.json();

  if (!Array.isArray(resultados) || resultados.length === 0) {
    throw new AppError("No se pudo encontrar la ubicación para la dirección indicada", 422);
  }

  const [mejorResultado] = resultados;

  return {
    lat: parseFloat(mejorResultado.lat),
    lng: parseFloat(mejorResultado.lon),
    clase: mejorResultado.class,
    tipo: mejorResultado.type,
  };
};

module.exports = { geocodificarDireccion, esResultadoImpreciso };
