const { validarCampos } = require("../../../middlewares/validar-campos");
const { validationResult } = require("express-validator");

jest.mock("express-validator", () => ({
  validationResult: jest.fn(),
}));

describe("validarCampos", () => {
  const buildRes = () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
  };

  beforeEach(() => jest.clearAllMocks());

  test("llama next() sin argumentos cuando no hay errores", () => {
    validationResult.mockReturnValue({ isEmpty: () => true });
    const next = jest.fn();
    validarCampos({}, buildRes(), next);
    expect(next).toHaveBeenCalledWith();
    expect(next).toHaveBeenCalledTimes(1);
  });

  test("responde 400 con formato correcto cuando hay errores", () => {
    validationResult.mockReturnValue({
      isEmpty: () => false,
      array: () => [
        { path: "correo", msg: "Debe ser un correo válido" },
        { path: "password", msg: "La contraseña es obligatoria" },
      ],
    });
    const res = buildRes();
    const next = jest.fn();
    validarCampos({}, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      msg: "Error en los datos enviados",
      errors: {
        correo: "Debe ser un correo válido",
        password: "La contraseña es obligatoria",
      },
    });
  });

  test("toma solo el primer error por campo", () => {
    validationResult.mockReturnValue({
      isEmpty: () => false,
      array: () => [
        { path: "nombre", msg: "Primer error" },
        { path: "nombre", msg: "Segundo error — debe ignorarse" },
      ],
    });
    const res = buildRes();
    validarCampos({}, res, jest.fn());
    expect(res.json.mock.calls[0][0].errors.nombre).toBe("Primer error");
  });

  test("success es siempre false en respuesta de error", () => {
    validationResult.mockReturnValue({
      isEmpty: () => false,
      array: () => [{ path: "campo", msg: "Error" }],
    });
    const res = buildRes();
    validarCampos({}, res, jest.fn());
    expect(res.json.mock.calls[0][0].success).toBe(false);
  });
});
