class AppError extends Error {
  constructor(message, statusCode, errors = null) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    if (errors) this.errors = errors;
  }
}

module.exports = AppError;
