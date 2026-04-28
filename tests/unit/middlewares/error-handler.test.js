const { errorHandler, notFound } = require("../../../middlewares/error-handler");
const AppError = require("../../../helpers/AppError");

jest.mock("../../../helpers/logger", () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

const mockReq = (overrides = {}) => ({
  method: "GET",
  originalUrl: "/api/test",
  ip: "::1",
  requestId: "req-test-123",
  usuario: null,
  ...overrides,
});

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe("errorHandler", () => {
  beforeEach(() => jest.clearAllMocks());

  test("maneja AppError con statusCode y message correctos", () => {
    const req = mockReq();
    const res = mockRes();
    errorHandler(new AppError("No encontrado", 404), req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, msg: "No encontrado" })
    );
  });

  test("incluye errors en la respuesta cuando AppError tiene errors", () => {
    const err = new AppError("Validation", 400, { campo: "requerido" });
    const res = mockRes();
    errorHandler(err, mockReq(), res, jest.fn());
    expect(res.json.mock.calls[0][0].errors).toEqual({ campo: "requerido" });
  });

  test("NO incluye errors en la respuesta cuando AppError no tiene errors", () => {
    const err = new AppError("Error simple", 400);
    const res = mockRes();
    errorHandler(err, mockReq(), res, jest.fn());
    expect(res.json.mock.calls[0][0].errors).toBeUndefined();
  });

  test("maneja Mongoose ValidationError → 400 con campos mapeados", () => {
    const err = {
      name: "ValidationError",
      message: "validation failed",
      errors: {
        nombre: { message: "El nombre es obligatorio" },
        correo: { message: "Correo inválido" },
      },
    };
    const res = mockRes();
    errorHandler(err, mockReq(), res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0]).toEqual({
      success: false,
      requestId: "req-test-123",
      msg: "Error de validación",
      errors: { nombre: "El nombre es obligatorio", correo: "Correo inválido" },
    });
  });

  test("maneja duplicate key (11000) → 400 identificando el campo", () => {
    const err = { code: 11000, keyPattern: { correo: 1 } };
    const res = mockRes();
    errorHandler(err, mockReq(), res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].msg).toContain("correo");
  });

  test("maneja CastError → 400", () => {
    const res = mockRes();
    errorHandler({ name: "CastError" }, mockReq(), res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].msg).toBe("ID inválido");
  });

  test("maneja JsonWebTokenError → 401", () => {
    const res = mockRes();
    errorHandler({ name: "JsonWebTokenError" }, mockReq(), res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(401);
  });

  test("maneja TokenExpiredError → 401", () => {
    const res = mockRes();
    errorHandler({ name: "TokenExpiredError" }, mockReq(), res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(401);
  });

  test("errores genéricos sin statusCode → 500", () => {
    const res = mockRes();
    errorHandler(new Error("Crash"), mockReq(), res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(500);
  });

  test("NO incluye stack en producción", () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    const res = mockRes();
    errorHandler(new Error("Error"), mockReq(), res, jest.fn());
    expect(res.json.mock.calls[0][0].stack).toBeUndefined();
    process.env.NODE_ENV = prev;
  });

  test("SÍ incluye stack en development", () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = "development";
    const res = mockRes();
    errorHandler(new Error("Error"), mockReq(), res, jest.fn());
    expect(res.json.mock.calls[0][0].stack).toBeDefined();
    process.env.NODE_ENV = prev;
  });

  test("responde con msg genérico cuando err.message no está definido", () => {
    const res = mockRes();
    errorHandler({ statusCode: 500 }, mockReq(), res, jest.fn());
    const body = res.json.mock.calls[0][0];
    expect(body.msg).toBe("Error interno del servidor");
  });
});

describe("notFound", () => {
  test("responde con 404 e incluye método y URL", () => {
    const req = mockReq({ method: "DELETE", originalUrl: "/api/xyz" });
    const res = mockRes();
    notFound(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
    const body = res.json.mock.calls[0][0];
    expect(body.success).toBe(false);
    expect(body.msg).toContain("DELETE");
    expect(body.msg).toContain("/api/xyz");
  });
});
