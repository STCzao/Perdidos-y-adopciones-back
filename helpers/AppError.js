class AppError extends Error {
  // `codigo` es un identificador estable que el frontend puede usar para reaccionar
  // a un error puntual sin depender del texto de `message`. No se llama `code`
  // para no chocar con los códigos de error de Mongo (ej. 11000).
  constructor(message, statusCode, errors = null, codigo = null) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    if (errors) this.errors = errors;
    if (codigo) this.codigo = codigo;
  }
}

module.exports = AppError;
