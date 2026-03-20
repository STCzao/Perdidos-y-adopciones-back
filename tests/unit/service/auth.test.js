// Mocks ANTES de cualquier require del service
jest.mock("../../../models/usuario");
jest.mock("bcryptjs");
jest.mock("jsonwebtoken");
jest.mock("crypto", () => ({
  randomBytes: jest.fn(() => ({ toString: jest.fn().mockReturnValue("mock-reset-token-hex") })),
}));
jest.mock("../../../helpers/generar-jwt");
jest.mock("../../../helpers/enviar-mails");
jest.mock("../../../helpers/logger", () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

const authService = require("../../../service/auth");
const Usuario = require("../../../models/usuario");
const bcryptjs = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { generarAccessToken, generarRefreshToken } = require("../../../helpers/generar-jwt");
const { enviarEmail } = require("../../../helpers/enviar-mails");
const AppError = require("../../../helpers/AppError");

const makeMockUser = (overrides = {}) => ({
  _id: "mock-uid-123",
  id: "mock-uid-123",
  nombre: "Test User",
  correo: "user@test.com",
  password: "hashed-password",
  estado: true,
  rol: "USER_ROLE",
  refreshTokens: [],
  save: jest.fn().mockResolvedValue(undefined),
  ...overrides,
});

describe("service/auth", () => {
  beforeEach(() => jest.clearAllMocks());

  // ─── login ────────────────────────────────────────────────────────────────
  describe("login", () => {
    test("lanza AppError(400) cuando el usuario no existe", async () => {
      Usuario.findOne.mockResolvedValue(null);
      await expect(
        authService.login({ correo: "no@test.com", password: "pass", ip: "::1" })
      ).rejects.toBeInstanceOf(AppError);
    });

    test("lanza AppError(400) cuando el usuario está inactivo", async () => {
      Usuario.findOne.mockResolvedValue(makeMockUser({ estado: false }));
      const err = await authService
        .login({ correo: "x@x.com", password: "pass", ip: "::1" })
        .catch((e) => e);
      expect(err.statusCode).toBe(400);
    });

    test("mensaje de error idéntico para usuario-no-existe y contraseña-incorrecta (anti-enumeración)", async () => {
      Usuario.findOne.mockResolvedValueOnce(null);
      const errNotFound = await authService
        .login({ correo: "x@x.com", password: "pass", ip: "::1" })
        .catch((e) => e);

      Usuario.findOne.mockResolvedValueOnce(makeMockUser());
      bcryptjs.compareSync.mockReturnValueOnce(false);
      const errWrongPass = await authService
        .login({ correo: "x@x.com", password: "wrong", ip: "::1" })
        .catch((e) => e);

      expect(errNotFound.message).toBe(errWrongPass.message);
    });

    test("lanza AppError con errors en correo y password", async () => {
      Usuario.findOne.mockResolvedValue(null);
      const err = await authService
        .login({ correo: "x@x.com", password: "pass", ip: "::1" })
        .catch((e) => e);
      expect(err.errors).toMatchObject({
        correo: expect.any(String),
        password: expect.any(String),
      });
    });

    test("retorna usuario, accessToken y refreshToken en éxito", async () => {
      const mockUser = makeMockUser();
      Usuario.findOne.mockResolvedValue(mockUser);
      bcryptjs.compareSync.mockReturnValue(true);
      generarAccessToken.mockResolvedValue("access-token");
      generarRefreshToken.mockResolvedValue("refresh-token");

      const result = await authService.login({ correo: "x@x.com", password: "pass", ip: "::1" });
      expect(result.accessToken).toBe("access-token");
      expect(result.refreshToken).toBe("refresh-token");
      expect(result.usuario).toBe(mockUser);
      expect(mockUser.save).toHaveBeenCalled();
    });

    test("guarda el refreshToken en la DB con device y ip", async () => {
      const mockUser = makeMockUser();
      Usuario.findOne.mockResolvedValue(mockUser);
      bcryptjs.compareSync.mockReturnValue(true);
      generarAccessToken.mockResolvedValue("access");
      generarRefreshToken.mockResolvedValue("refresh");

      await authService.login({ correo: "x@x.com", password: "pass", ip: "1.2.3.4", userAgent: "Chrome/100" });

      expect(mockUser.refreshTokens).toHaveLength(1);
      expect(mockUser.refreshTokens[0].token).toBe("refresh");
      expect(mockUser.refreshTokens[0].ip).toBe("1.2.3.4");
      expect(mockUser.refreshTokens[0].device).toBe("Chrome/100");
    });

    test("aplica límite de 5 dispositivos eliminando el más antiguo", async () => {
      const existingTokens = Array.from({ length: 5 }, (_, i) => ({
        token: `t${i}`,
        device: "D",
        ip: "::1",
      }));
      const mockUser = makeMockUser({ refreshTokens: [...existingTokens] });
      Usuario.findOne.mockResolvedValue(mockUser);
      bcryptjs.compareSync.mockReturnValue(true);
      generarAccessToken.mockResolvedValue("new-access");
      generarRefreshToken.mockResolvedValue("new-refresh");

      await authService.login({ correo: "x@x.com", password: "pass", ip: "::1" });

      expect(mockUser.refreshTokens).toHaveLength(5);
      expect(mockUser.refreshTokens[4].token).toBe("new-refresh");
      // El primer token fue eliminado
      expect(mockUser.refreshTokens.find((t) => t.token === "t0")).toBeUndefined();
    });
  });

  // ─── forgotPassword ───────────────────────────────────────────────────────
  describe("forgotPassword", () => {
    test("retorna respuesta genérica cuando el usuario NO existe (anti-enumeración)", async () => {
      Usuario.findOne.mockResolvedValue(null);
      const result = await authService.forgotPassword({ correo: "no@test.com", ip: "::1" });
      expect(result.msg).toBeDefined();
      expect(typeof result.msg).toBe("string");
    });

    test("retorna el mismo mensaje si el usuario existe o no", async () => {
      // No existe
      Usuario.findOne.mockResolvedValueOnce(null);
      const resNoExiste = await authService.forgotPassword({ correo: "no@test.com", ip: "::1" });

      // Existe
      const mockUser = makeMockUser();
      Usuario.findOne.mockResolvedValueOnce(mockUser);
      enviarEmail.mockResolvedValueOnce(undefined);
      const resExiste = await authService.forgotPassword({ correo: "test@test.com", ip: "::1" });

      expect(resNoExiste.msg).toBe(resExiste.msg);
    });

    test("envía email y guarda resetToken cuando el usuario existe", async () => {
      const mockUser = makeMockUser();
      Usuario.findOne.mockResolvedValue(mockUser);
      enviarEmail.mockResolvedValue(undefined);

      await authService.forgotPassword({ correo: "test@test.com", ip: "::1" });

      expect(enviarEmail).toHaveBeenCalledTimes(1);
      expect(mockUser.save).toHaveBeenCalledTimes(1);
      expect(mockUser.resetToken).toBeDefined();
      expect(mockUser.resetTokenExp).toBeDefined();
    });

    test("NO guarda el token si el envío de email falla (email-before-persist)", async () => {
      const mockUser = makeMockUser();
      Usuario.findOne.mockResolvedValue(mockUser);
      enviarEmail.mockRejectedValue(new Error("Resend service down"));

      await expect(
        authService.forgotPassword({ correo: "test@test.com", ip: "::1" })
      ).rejects.toThrow("Resend service down");

      expect(mockUser.save).not.toHaveBeenCalled();
    });
  });

  // ─── resetPassword ────────────────────────────────────────────────────────
  describe("resetPassword", () => {
    test("lanza AppError(400) para token inválido o expirado", async () => {
      Usuario.findOne.mockResolvedValue(null);
      const err = await authService
        .resetPassword({ token: "bad-token", password: "NewPass123", ip: "::1" })
        .catch((e) => e);
      expect(err).toBeInstanceOf(AppError);
      expect(err.statusCode).toBe(400);
    });

    test("hashea la nueva contraseña e invalida todos los refreshTokens", async () => {
      const mockUser = makeMockUser({
        refreshTokens: [{ token: "t1" }, { token: "t2" }],
        resetToken: "valid-token",
        resetTokenExp: Date.now() + 3600000,
      });
      Usuario.findOne.mockResolvedValue(mockUser);
      bcryptjs.genSaltSync.mockReturnValue("salt");
      bcryptjs.hashSync.mockReturnValue("new-hashed-pass");

      await authService.resetPassword({ token: "valid-token", password: "NewPass123", ip: "::1" });

      expect(mockUser.password).toBe("new-hashed-pass");
      expect(mockUser.refreshTokens).toHaveLength(0);
      expect(mockUser.resetToken).toBeUndefined();
      expect(mockUser.resetTokenExp).toBeUndefined();
      expect(mockUser.save).toHaveBeenCalled();
    });

    test("retorna mensaje de éxito", async () => {
      const mockUser = makeMockUser({ resetToken: "v", resetTokenExp: Date.now() + 3600000 });
      Usuario.findOne.mockResolvedValue(mockUser);
      bcryptjs.genSaltSync.mockReturnValue("salt");
      bcryptjs.hashSync.mockReturnValue("hashed");

      const result = await authService.resetPassword({ token: "v", password: "NewPass", ip: "::1" });
      expect(result.msg).toBeDefined();
    });
  });

  // ─── renovarToken ─────────────────────────────────────────────────────────
  describe("renovarToken", () => {
    test("lanza AppError(401) cuando no se proporciona refreshToken", async () => {
      const err = await authService
        .renovarToken({ refreshToken: undefined, ip: "::1" })
        .catch((e) => e);
      expect(err).toBeInstanceOf(AppError);
      expect(err.statusCode).toBe(401);
    });

    test("lanza AppError(401) cuando el JWT no es válido", async () => {
      jwt.verify.mockImplementation(() => {
        throw new Error("invalid signature");
      });
      const err = await authService
        .renovarToken({ refreshToken: "bad", ip: "::1" })
        .catch((e) => e);
      expect(err).toBeInstanceOf(AppError);
      expect(err.statusCode).toBe(401);
    });

    test("lanza AppError(401) cuando el type del token no es 'refresh'", async () => {
      jwt.verify.mockReturnValue({ uid: "uid", type: "access" });
      const err = await authService
        .renovarToken({ refreshToken: "token", ip: "::1" })
        .catch((e) => e);
      expect(err.statusCode).toBe(401);
    });

    test("lanza AppError(401) cuando el usuario no existe en DB", async () => {
      jwt.verify.mockReturnValue({ uid: "uid", type: "refresh" });
      Usuario.findById.mockResolvedValue(null);
      const err = await authService
        .renovarToken({ refreshToken: "token", ip: "::1" })
        .catch((e) => e);
      expect(err.statusCode).toBe(401);
    });

    test("limpia todos los tokens y lanza 401 cuando el usuario está deshabilitado", async () => {
      const mockUser = makeMockUser({ estado: false, refreshTokens: [{ token: "rt" }] });
      jwt.verify.mockReturnValue({ uid: "uid", type: "refresh" });
      Usuario.findById.mockResolvedValue(mockUser);

      const err = await authService
        .renovarToken({ refreshToken: "rt", ip: "::1" })
        .catch((e) => e);

      expect(err.statusCode).toBe(401);
      expect(mockUser.refreshTokens).toHaveLength(0);
      expect(mockUser.save).toHaveBeenCalled();
    });

    test("detección de robo: limpia TODOS los tokens y lanza 401 si el token no está en DB", async () => {
      const mockUser = makeMockUser({
        estado: true,
        refreshTokens: [{ token: "otro-token", device: "D", ip: "::1" }],
      });
      jwt.verify.mockReturnValue({ uid: "uid", type: "refresh" });
      Usuario.findById.mockResolvedValue(mockUser);

      const err = await authService
        .renovarToken({ refreshToken: "token-robado", ip: "::1" })
        .catch((e) => e);

      expect(err.statusCode).toBe(401);
      expect(mockUser.refreshTokens).toHaveLength(0);
    });

    test("rota los tokens correctamente en el caso de éxito", async () => {
      const mockUser = makeMockUser({
        estado: true,
        refreshTokens: [{ token: "old-rt", device: "D", ip: "::1" }],
      });
      jwt.verify.mockReturnValue({ uid: "uid", type: "refresh" });
      Usuario.findById.mockResolvedValue(mockUser);
      generarAccessToken.mockResolvedValue("new-access");
      generarRefreshToken.mockResolvedValue("new-refresh");

      const result = await authService.renovarToken({ refreshToken: "old-rt", ip: "::1" });

      expect(result.accessToken).toBe("new-access");
      expect(result.refreshToken).toBe("new-refresh");
      expect(mockUser.refreshTokens.some((t) => t.token === "old-rt")).toBe(false);
      expect(mockUser.refreshTokens.some((t) => t.token === "new-refresh")).toBe(true);
    });
  });

  // ─── logout ───────────────────────────────────────────────────────────────
  describe("logout", () => {
    test("retorna éxito aunque el usuario no exista", async () => {
      Usuario.findById.mockResolvedValue(null);
      const result = await authService.logout({
        userId: "uid",
        refreshToken: "rt",
        correo: "x@x.com",
        ip: "::1",
      });
      expect(result.msg).toBeDefined();
    });

    test("elimina solo el refreshToken específico del array", async () => {
      const mockUser = makeMockUser({
        refreshTokens: [{ token: "to-remove" }, { token: "to-keep" }],
      });
      Usuario.findById.mockResolvedValue(mockUser);

      await authService.logout({ userId: "uid", refreshToken: "to-remove", correo: "x@x.com", ip: "::1" });

      expect(mockUser.refreshTokens).toHaveLength(1);
      expect(mockUser.refreshTokens[0].token).toBe("to-keep");
      expect(mockUser.save).toHaveBeenCalled();
    });
  });

  // ─── logoutAll ────────────────────────────────────────────────────────────
  describe("logoutAll", () => {
    test("limpia todos los refreshTokens", async () => {
      const mockUser = makeMockUser({
        refreshTokens: [{ token: "t1" }, { token: "t2" }, { token: "t3" }],
      });
      Usuario.findById.mockResolvedValue(mockUser);

      await authService.logoutAll({ userId: "uid", correo: "x@x.com", ip: "::1" });

      expect(mockUser.refreshTokens).toHaveLength(0);
      expect(mockUser.save).toHaveBeenCalled();
    });

    test("retorna mensaje de éxito", async () => {
      const mockUser = makeMockUser({ refreshTokens: [] });
      Usuario.findById.mockResolvedValue(mockUser);

      const result = await authService.logoutAll({ userId: "uid", correo: "x@x.com", ip: "::1" });
      expect(result.msg).toBeDefined();
    });

    test("retorna éxito aunque el usuario no exista", async () => {
      Usuario.findById.mockResolvedValue(null);
      const result = await authService.logoutAll({ userId: "uid", correo: "x@x.com", ip: "::1" });
      expect(result.msg).toBeDefined();
    });
  });
});
