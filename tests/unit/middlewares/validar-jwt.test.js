jest.mock("../../../models/usuario");
jest.mock("../../../helpers/logger", () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

const jwt = require("jsonwebtoken");
const { validarJWT } = require("../../../middlewares/validar-jwt");
const Usuario = require("../../../models/usuario");
const AppError = require("../../../helpers/AppError");

const buildRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const buildReq = (token) => ({
  header: jest.fn().mockReturnValue(token),
  ip: "::1",
  path: "/api/test",
});

describe("validarJWT", () => {
  beforeEach(() => jest.clearAllMocks());

  test("llama next(AppError 401) cuando no hay token", async () => {
    const req = buildReq(null);
    const next = jest.fn();
    await validarJWT(req, buildRes(), next);
    expect(next).toHaveBeenCalledWith(expect.any(AppError));
    expect(next.mock.calls[0][0].statusCode).toBe(401);
  });

  test("llama next(AppError 401) cuando el JWT es inválido", async () => {
    const req = buildReq("token-invalido");
    const next = jest.fn();
    await validarJWT(req, buildRes(), next);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });

  test("llama next(AppError 401) cuando el usuario no existe en DB", async () => {
    const token = jwt.sign({ uid: "uid123" }, process.env.SECRETORPRIVATEKEY);
    const req = buildReq(token);
    Usuario.findById.mockResolvedValue(null);
    const next = jest.fn();
    await validarJWT(req, buildRes(), next);
    expect(next).toHaveBeenCalledWith(expect.any(AppError));
    expect(next.mock.calls[0][0].statusCode).toBe(401);
  });

  test("llama next(AppError 401) cuando el usuario está inhabilitado", async () => {
    const token = jwt.sign({ uid: "uid123" }, process.env.SECRETORPRIVATEKEY);
    const req = buildReq(token);
    Usuario.findById.mockResolvedValue({ _id: "uid123", estado: false });
    const next = jest.fn();
    await validarJWT(req, buildRes(), next);
    expect(next).toHaveBeenCalledWith(expect.any(AppError));
    expect(next.mock.calls[0][0].statusCode).toBe(401);
  });

  test("adjunta req.usuario y llama next() en token válido", async () => {
    const mockUser = { _id: "uid123", estado: true, rol: "USER_ROLE" };
    const token = jwt.sign({ uid: "uid123" }, process.env.SECRETORPRIVATEKEY);
    const req = buildReq(token);
    Usuario.findById.mockResolvedValue(mockUser);
    const next = jest.fn();
    await validarJWT(req, buildRes(), next);
    expect(next).toHaveBeenCalledWith();
    expect(req.usuario).toBe(mockUser);
  });
});
