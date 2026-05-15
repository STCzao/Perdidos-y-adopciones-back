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
