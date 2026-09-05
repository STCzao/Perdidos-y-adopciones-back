const EARTH_RADIUS_M = 6371000;
const MIN_OFFSET_M = 100;
const MAX_OFFSET_M = 200;

const toRad = (deg) => (deg * Math.PI) / 180;
const toDeg = (rad) => (rad * 180) / Math.PI;

const coordenadasAPunto = ({ lat, lng }) => ({ type: "Point", coordinates: [lng, lat] });
const puntoACoordenadas = (punto) => ({ lat: punto.coordinates[1], lng: punto.coordinates[0] });

const distanciaMetros = (a, b) => {
  const latRad1 = toRad(a.lat);
  const latRad2 = toRad(b.lat);
  const deltaLat = toRad(b.lat - a.lat);
  const deltaLng = toRad(b.lng - a.lng);

  const h =
    Math.sin(deltaLat / 2) ** 2 + Math.cos(latRad1) * Math.cos(latRad2) * Math.sin(deltaLng / 2) ** 2;

  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
};

// Desplaza una coordenada una distancia aleatoria entre 100 y 200 m en una
// dirección aleatoria, usando la fórmula de destino sobre una esfera (great-circle).
const desplazarCoordenadas = ({ lat, lng }) => {
  const distancia = MIN_OFFSET_M + Math.random() * (MAX_OFFSET_M - MIN_OFFSET_M);
  const angulo = Math.random() * 2 * Math.PI;
  const angularDistance = distancia / EARTH_RADIUS_M;

  const latRad = toRad(lat);
  const lngRad = toRad(lng);

  const nuevaLatRad = Math.asin(
    Math.sin(latRad) * Math.cos(angularDistance) +
      Math.cos(latRad) * Math.sin(angularDistance) * Math.cos(angulo),
  );
  const nuevaLngRad =
    lngRad +
    Math.atan2(
      Math.sin(angulo) * Math.sin(angularDistance) * Math.cos(latRad),
      Math.cos(angularDistance) - Math.sin(latRad) * Math.sin(nuevaLatRad),
    );

  return { lat: toDeg(nuevaLatRad), lng: toDeg(nuevaLngRad) };
};

const generarUbicacionPublica = (puntoExacto) => {
  const desplazado = desplazarCoordenadas(puntoACoordenadas(puntoExacto));
  return coordenadasAPunto(desplazado);
};

module.exports = {
  MIN_OFFSET_M,
  MAX_OFFSET_M,
  coordenadasAPunto,
  puntoACoordenadas,
  distanciaMetros,
  desplazarCoordenadas,
  generarUbicacionPublica,
};
