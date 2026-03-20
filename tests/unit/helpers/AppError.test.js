const AppError = require("../../../helpers/AppError");

describe("AppError", () => {
  test("es una instancia de Error", () => {
    const err = new AppError("Not found", 404);
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(AppError);
  });

  test("asigna message y statusCode correctamente", () => {
    const err = new AppError("Forbidden", 403);
    expect(err.message).toBe("Forbidden");
    expect(err.statusCode).toBe(403);
  });

  test("NO asigna la propiedad errors cuando se pasa null", () => {
    const err = new AppError("Error", 500, null);
    expect(err.errors).toBeUndefined();
  });

  test("asigna errors cuando se proporciona un objeto", () => {
    const errors = { correo: "Correo inválido", password: "Muy corta" };
    const err = new AppError("Validation", 400, errors);
    expect(err.errors).toEqual(errors);
  });

  test("tiene stack trace", () => {
    const err = new AppError("Error", 500);
    expect(err.stack).toBeDefined();
  });

  test("funciona con status 4xx, 5xx y cualquier código", () => {
    [400, 401, 403, 404, 409, 422, 500, 503].forEach((code) => {
      const err = new AppError("msg", code);
      expect(err.statusCode).toBe(code);
    });
  });
});
