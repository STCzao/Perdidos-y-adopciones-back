jest.mock("../../../models/usuario");
jest.mock("bcryptjs");
jest.mock("jsonwebtoken");
jest.mock("crypto", () => ({
  randomBytes: jest.fn(() => ({ toString: jest.fn().mockReturnValue("mock-reset-token-hex") })),
  createHash: jest.fn(() => ({
    update: jest.fn().mockReturnThis(),
    digest: jest.fn().mockReturnValue("hashed-reset-token"),
  })),
}));
jest.mock("../../../helpers/generar-jwt");
jest.mock("../../../helpers/enviar-mails");
const mockVerifyIdToken = jest.fn();
jest.mock("google-auth-library", () => ({
  OAuth2Client: jest.fn().mockImplementation(() => ({ verifyIdToken: mockVerifyIdToken })),
}));
jest.mock("../../../helpers/cloudinary", () => ({
  cloudinary: {
    utils: {
      api_sign_request: jest.fn().mockReturnValue("mock-cloudinary-signature"),
    },
  },
}));
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
const { cloudinary } = require("../../../helpers/cloudinary");
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

  test("login retorna tokens en exito", async () => {
    const mockUser = makeMockUser();
    Usuario.findOne.mockResolvedValue(mockUser);
    bcryptjs.compareSync.mockReturnValue(true);
    generarAccessToken.mockResolvedValue("access-token");
    generarRefreshToken.mockResolvedValue("refresh-token");

    const result = await authService.login({ correo: "x@x.com", password: "pass", ip: "::1" });

    expect(result.accessToken).toBe("access-token");
    expect(result.refreshToken).toBe("refresh-token");
    expect(mockUser.save).toHaveBeenCalled();
  });

  test("login lanza 400 si la cuenta no tiene password (se registro con Google)", async () => {
    const mockUser = makeMockUser({ password: undefined, googleId: "google-sub-123" });
    Usuario.findOne.mockResolvedValue(mockUser);

    const err = await authService
      .login({ correo: "x@x.com", password: "pass", ip: "::1" })
      .catch((e) => e);

    expect(err).toBeInstanceOf(AppError);
    expect(err.statusCode).toBe(400);
    expect(bcryptjs.compareSync).not.toHaveBeenCalled();
  });

  describe("loginConGoogle", () => {
    beforeEach(() => {
      generarAccessToken.mockResolvedValue("access-token");
      generarRefreshToken.mockResolvedValue("refresh-token");
    });

    const mockPayload = (overrides = {}) => ({
      sub: "google-sub-123",
      email: "google@test.com",
      email_verified: true,
      name: "Google User",
      ...overrides,
    });

    test("lanza 401 si el idToken es invalido", async () => {
      mockVerifyIdToken.mockRejectedValue(new Error("invalid token"));

      const err = await authService
        .loginConGoogle({ idToken: "bad-token", ip: "::1" })
        .catch((e) => e);

      expect(err).toBeInstanceOf(AppError);
      expect(err.statusCode).toBe(401);
    });

    test("lanza 401 si el correo de Google no esta verificado", async () => {
      mockVerifyIdToken.mockResolvedValue({
        getPayload: () => mockPayload({ email_verified: false }),
      });

      const err = await authService
        .loginConGoogle({ idToken: "good-token", ip: "::1" })
        .catch((e) => e);

      expect(err).toBeInstanceOf(AppError);
      expect(err.statusCode).toBe(401);
    });

    test("loguea directo si ya existe un usuario con ese googleId", async () => {
      mockVerifyIdToken.mockResolvedValue({ getPayload: () => mockPayload() });
      const mockUser = makeMockUser({ googleId: "google-sub-123" });
      Usuario.findOne.mockResolvedValueOnce(mockUser); // findByGoogleId

      const result = await authService.loginConGoogle({ idToken: "good-token", ip: "::1" });

      expect(result.accessToken).toBe("access-token");
      expect(mockUser.save).toHaveBeenCalled();
    });

    test("vincula una cuenta existente encontrada por correo (sin googleId)", async () => {
      mockVerifyIdToken.mockResolvedValue({ getPayload: () => mockPayload() });
      const mockUser = makeMockUser({ correo: "google@test.com", googleId: undefined });
      Usuario.findOne
        .mockResolvedValueOnce(null) // findByGoogleId
        .mockResolvedValueOnce(mockUser); // findByCorreo

      const result = await authService.loginConGoogle({ idToken: "good-token", ip: "::1" });

      expect(mockUser.googleId).toBe("google-sub-123");
      expect(mockUser.save).toHaveBeenCalled();
      expect(result.accessToken).toBe("access-token");
    });

    test("lanza 400 si es un usuario nuevo y no manda telefono", async () => {
      mockVerifyIdToken.mockResolvedValue({ getPayload: () => mockPayload() });
      Usuario.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(null);

      const err = await authService
        .loginConGoogle({ idToken: "good-token", ip: "::1" })
        .catch((e) => e);

      expect(err).toBeInstanceOf(AppError);
      expect(err.statusCode).toBe(400);
    });

    test("crea un usuario nuevo si manda telefono", async () => {
      mockVerifyIdToken.mockResolvedValue({ getPayload: () => mockPayload() });
      Usuario.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
      let datosCreados;
      let creado;
      Usuario.mockImplementation((data) => {
        datosCreados = data;
        creado = makeMockUser({ ...data, refreshTokens: [] });
        return creado;
      });

      const result = await authService.loginConGoogle({
        idToken: "good-token",
        telefono: "3812345678",
        ip: "::1",
      });

      expect(datosCreados.correo).toBe("google@test.com");
      expect(datosCreados.googleId).toBe("google-sub-123");
      expect(datosCreados.telefono).toBe("3812345678");
      expect(datosCreados.password).toBeUndefined();
      expect(result.accessToken).toBe("access-token");
    });
  });

  test("forgotPassword envia email y guarda resetToken", async () => {
    const mockUser = makeMockUser();
    Usuario.findOne.mockResolvedValue(mockUser);
    enviarEmail.mockResolvedValue(undefined);

    await authService.forgotPassword({ correo: "test@test.com", ip: "::1" });

    expect(enviarEmail).toHaveBeenCalledTimes(1);
    expect(mockUser.save).toHaveBeenCalledTimes(1);
    expect(mockUser.resetToken).toBe("hashed-reset-token");
  });

  test("resetPassword invalida tokens y actualiza password", async () => {
    const mockUser = makeMockUser({
      refreshTokens: [{ token: "t1" }, { token: "t2" }],
      resetToken: "hashed-reset-token",
      resetTokenExp: Date.now() + 3600000,
    });
    Usuario.findOne.mockResolvedValue(mockUser);
    bcryptjs.genSaltSync.mockReturnValue("salt");
    bcryptjs.hashSync.mockReturnValue("new-hashed-pass");

    await authService.resetPassword({ token: "valid-token", password: "NewPass123", ip: "::1" });

    expect(mockUser.password).toBe("new-hashed-pass");
    expect(mockUser.refreshTokens).toHaveLength(0);
    expect(mockUser.save).toHaveBeenCalled();
  });

  test("renovarToken lanza 401 si el JWT no es valido", async () => {
    jwt.verify.mockImplementation(() => {
      throw new Error("invalid signature");
    });

    const err = await authService.renovarToken({ refreshToken: "bad", ip: "::1" }).catch((e) => e);

    expect(err).toBeInstanceOf(AppError);
    expect(err.statusCode).toBe(401);
  });

  test("logoutAll limpia todos los refreshTokens", async () => {
    const mockUser = makeMockUser({
      refreshTokens: [{ token: "t1" }, { token: "t2" }],
    });
    Usuario.findById.mockResolvedValue(mockUser);

    await authService.logoutAll({ userId: "uid", correo: "x@x.com", ip: "::1" });

    expect(mockUser.refreshTokens).toHaveLength(0);
    expect(mockUser.save).toHaveBeenCalled();
  });

  test("generarCloudinarySignature retorna signature y metadata", async () => {
    const result = await authService.generarCloudinarySignature();

    expect(cloudinary.utils.api_sign_request).toHaveBeenCalled();
    expect(result).toMatchObject({
      signature: "mock-cloudinary-signature",
      apiKey: process.env.CLOUDINARY_API_KEY,
      cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    });
    expect(result.timestamp).toEqual(expect.any(Number));
  });
});
