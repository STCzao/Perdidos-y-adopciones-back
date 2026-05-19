// Tests de integración: service/auth con Mongoose real contra mongodb-memory-server
jest.mock("../../helpers/enviar-mails", () => ({ enviarEmail: jest.fn().mockResolvedValue(undefined) }));
jest.mock("../../helpers/logger", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));

const crypto = require("crypto");
const db = require("../setup/db");
const { createUser } = require("../setup/factories");
const bcryptjs = require("bcryptjs");
const Usuario = require("../../models/usuario");
const authService = require("../../service/auth");
const { enviarEmail } = require("../../helpers/enviar-mails");

describe("service/auth — integración", () => {
  beforeAll(async () => await db.connect());
  afterAll(async () => await db.disconnect());
  afterEach(async () => {
    await db.clearCollections();
    jest.clearAllMocks();
  });

  // ─── login ─────────────────────────────────────────────────────────────────
  describe("login", () => {
    test("autentica al usuario con credenciales correctas", async () => {
      const user = await createUser();
      const result = await authService.login({
        correo: user.correo,
        password: "password123",
        ip: "::1",
      });
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(result.usuario.correo).toBe(user.correo);
    });

    test("persiste el refreshToken en MongoDB", async () => {
      const user = await createUser();
      const result = await authService.login({
        correo: user.correo,
        password: "password123",
        ip: "::1",
        userAgent: "TestAgent",
      });

      const updated = await Usuario.findById(user._id);
      expect(updated.refreshTokens).toHaveLength(1);
      expect(updated.refreshTokens[0].device).toBe("TestAgent");
      expect(updated.refreshTokens[0].token).toBe(
        crypto.createHash("sha256").update(result.refreshToken).digest("hex"),
      );
    });

    test("falla con credenciales incorrectas", async () => {
      await createUser();
      await expect(
        authService.login({ correo: "no@test.com", password: "wrong", ip: "::1" })
      ).rejects.toMatchObject({ statusCode: 400 });
    });

    test("falla cuando el usuario está inactivo", async () => {
      const user = await createUser({ estado: false });
      await expect(
        authService.login({ correo: user.correo, password: "password123", ip: "::1" })
      ).rejects.toMatchObject({ statusCode: 400 });
    });
  });

  // ─── forgotPassword ─────────────────────────────────────────────────────────
  describe("forgotPassword", () => {
    test("guarda el hash del resetToken en DB cuando el usuario existe", async () => {
      const user = await createUser();
      await authService.forgotPassword({ correo: user.correo, ip: "::1" });

      const updated = await Usuario.findById(user._id);
      expect(updated.resetToken).toBeDefined();
      expect(updated.resetToken).not.toBe("mock-reset-token-hex");
      expect(updated.resetTokenExp.getTime()).toBeGreaterThan(Date.now());
      expect(enviarEmail).toHaveBeenCalledTimes(1);
    });

    test("NO guarda nada cuando el usuario no existe", async () => {
      const result = await authService.forgotPassword({ correo: "noexiste@test.com", ip: "::1" });
      expect(result.msg).toBeDefined();
      expect(enviarEmail).not.toHaveBeenCalled();
    });
  });

  // ─── resetPassword ──────────────────────────────────────────────────────────
  describe("resetPassword", () => {
    test("cambia la contraseña y limpia todos los refreshTokens", async () => {
      const user = await createUser();

      // Simular que tiene un resetToken válido
      const token = "valid-test-token-12345";
      const tokenHash = require("crypto").createHash("sha256").update(token).digest("hex");
      await Usuario.findByIdAndUpdate(user._id, {
        resetToken: tokenHash,
        resetTokenExp: Date.now() + 3600000,
        refreshTokens: [{ token: "old-rt", device: "D", ip: "::1" }],
      });

      await authService.resetPassword({ token, password: "NuevaPassword123", ip: "::1" });

      const updated = await Usuario.findById(user._id);
      expect(updated.refreshTokens).toHaveLength(0);
      expect(updated.resetToken).toBeUndefined();
      // La nueva contraseña debe ser válida
      expect(bcryptjs.compareSync("NuevaPassword123", updated.password)).toBe(true);
    });

    test("falla con token expirado", async () => {
      await createUser();
      await expect(
        authService.resetPassword({ token: "token-expirado", password: "pass", ip: "::1" })
      ).rejects.toMatchObject({ statusCode: 400 });
    });
  });

  // ─── logout ─────────────────────────────────────────────────────────────────
  describe("logout", () => {
    test("elimina solo el refreshToken enviado", async () => {
      const user = await createUser();
      const refreshTokenToRemove = "rt-to-remove";
      const refreshTokenToKeep = "rt-to-keep";
      await Usuario.findByIdAndUpdate(user._id, {
        refreshTokens: [
          {
            token: crypto.createHash("sha256").update(refreshTokenToRemove).digest("hex"),
            device: "D",
            ip: "::1",
          },
          {
            token: crypto.createHash("sha256").update(refreshTokenToKeep).digest("hex"),
            device: "D",
            ip: "::1",
          },
        ],
      });

      await authService.logout({
        userId: user._id,
        refreshToken: refreshTokenToRemove,
        correo: user.correo,
        ip: "::1",
      });

      const updated = await Usuario.findById(user._id);
      expect(updated.refreshTokens).toHaveLength(1);
      expect(updated.refreshTokens[0].token).toBe(
        crypto.createHash("sha256").update(refreshTokenToKeep).digest("hex"),
      );
    });
  });

  // ─── logoutAll ──────────────────────────────────────────────────────────────
  describe("logoutAll", () => {
    test("limpia todos los refreshTokens en DB", async () => {
      const user = await createUser();
      await Usuario.findByIdAndUpdate(user._id, {
        refreshTokens: [{ token: "t1", device: "D", ip: "::1" }, { token: "t2", device: "M", ip: "::1" }],
      });

      await authService.logoutAll({ userId: user._id, correo: user.correo, ip: "::1" });

      const updated = await Usuario.findById(user._id);
      expect(updated.refreshTokens).toHaveLength(0);
    });
  });
});
