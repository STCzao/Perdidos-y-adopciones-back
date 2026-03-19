/**
 * Normaliza un string: elimina espacios extremos y convierte a mayúsculas.
 * Devuelve el valor sin modificar si no es un string (útil para campos opcionales).
 * @param {*} texto
 * @returns {*}
 */
const normalizarTexto = (texto) => {
  if (typeof texto !== "string") return texto;
  return texto.trim().toUpperCase();
};

module.exports = { normalizarTexto };
