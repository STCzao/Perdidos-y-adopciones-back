jest.mock("../../helpers/enviar-mails", () => ({ enviarEmail: jest.fn().mockResolvedValue(undefined) }));
jest.mock("../../helpers/logger", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));

const request = require("supertest");
const crypto = require("crypto");
const db = require("../setup/db");
const createApp = require("../setup/testApp");
const { createUser } = require("../setup/factories");
const Usuario = require("../../models/usuario");

let app;

describe("E2E: /api/auth", () => {
  beforeAll(async () => {
    await db.connect();
    app = createApp();
  });
  afterAll(async () => await db.disconnect());
  afterEach(async () => await db.clearCollections());

  // ─── POST /login ─────────────────────────────────────────────────────────────
  describe("POST /api/auth/login", () => {
    test("200 con token y refreshToken para credenciales válidas", async () => {
      await createUser({ correo: "usuario@login.com", rawPassword: "password123" });

      const res = await request(app)
        .post("/api/auth/login")
        .send({ correo: "usuario@login.com", password: "password123" });

      expect(res.status).toBe(200);
      expect(res.body.accessToken).toBeDefined();
      expect(res.body.refreshToken).toBeUndefined();
      expect(res.headers["set-cookie"]).toBeDefined();
    });

    test("400 con contraseña incorrecta", async () => {
      await createUser({ correo: "usuario@login.com", rawPassword: "password123" });

      const res = await request(app)
        .post("/api/auth/login")
        .send({ correo: "usuario@login.com", password: "wrongpassword" });

      expect(res.status).toBe(400);
    });

    test("400 con correo que no existe (anti-enumeración)", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ correo: "noexiste@test.com", password: "password123" });

      expect(res.status).toBe(400);
      // La respuesta debe ser idéntica a la de contraseña incorrecta
      expect(res.body.msg).toBe("Correo o contraseña incorrectos");
    });

    test("400 con validación — correo vacío", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ correo: "nocorreo", password: "password123" });

      expect(res.status).toBe(400);
      expect(res.body.errors).toBeDefined();
    });

    test("400 para usuario inactivo", async () => {
      await createUser({ correo: "inactivo@test.com", rawPassword: "password123", estado: false });

      const res = await request(app)
        .post("/api/auth/login")
        .send({ correo: "inactivo@test.com", password: "password123" });

      expect(res.status).toBe(400);
    });
  });

  // ─── POST /forgot-password ───────────────────────────────────────────────────
  describe("POST /api/auth/forgot-password", () => {
    test("200 aunque el correo no exista (anti-enumeración)", async () => {
      const res = await request(app)
        .post("/api/auth/forgot-password")
        .send({ correo: "noexiste@test.com" });

      expect(res.status).toBe(200);
      expect(res.body.msg).toMatch(/correo|enlace|minutos/i);
    });

    test("200 y llama al servicio de email cuando el usuario sí existe", async () => {
      const { enviarEmail } = require("../../helpers/enviar-mails");
      enviarEmail.mockClear();

      await createUser({ correo: "usuario@forgot.com" });

      const res = await request(app)
        .post("/api/auth/forgot-password")
        .send({ correo: "usuario@forgot.com" });

      expect(res.status).toBe(200);
      expect(enviarEmail).toHaveBeenCalledTimes(1);
    });

    test("400 con correo inválido", async () => {
      const res = await request(app)
        .post("/api/auth/forgot-password")
        .send({ correo: "noesuncorreo" });

      expect(res.status).toBe(400);
    });
  });

  // ─── POST /reset-password/:token ─────────────────────────────────────────────
  describe("POST /api/auth/reset-password/:token", () => {
    test("400 con token inválido", async () => {
      const res = await request(app)
        .post("/api/auth/reset-password/tokeninvalido")
        .send({ password: "nuevaPass123", confirmPassword: "nuevaPass123" });

      expect(res.status).toBe(400);
    });

    test("200 al cambiar contraseña con token válido", async () => {
      const user = await createUser({ correo: "usuario@reset.com", rawPassword: "oldpass123" });

      const rawToken = crypto.randomBytes(32).toString("hex");

      await Usuario.findByIdAndUpdate(user._id, {
        resetToken: crypto.createHash("sha256").update(rawToken).digest("hex"),
        resetTokenExp: Date.now() + 30 * 60 * 1000,
      });

      const res = await request(app)
        .post(`/api/auth/reset-password/${rawToken}`)
        .send({ password: "nuevaPass123", confirmPassword: "nuevaPass123" });

      expect(res.status).toBe(200);
    });

    test("400 si la confirmación no coincide en reset password", async () => {
      const res = await request(app)
        .post("/api/auth/reset-password/tokeninvalido")
        .send({ password: "nuevaPass123", confirmPassword: "otraPass123" });

      expect(res.status).toBe(400);
      expect(res.body.errors?.confirmPassword).toBeDefined();
    });
  });

  // ─── POST /refresh ────────────────────────────────────────────────────────────
  describe("POST /api/auth/refresh", () => {
    test("200 con nuevo token usando refreshToken válido", async () => {
      await createUser({ correo: "usuario@refresh.com", rawPassword: "password123" });

      // Login para obtener tokens reales registrados en DB
      const loginRes = await request(app)
        .post("/api/auth/login")
        .send({ correo: "usuario@refresh.com", password: "password123" });

      const res = await request(app)
        .post("/api/auth/refresh")
        .set("Cookie", loginRes.headers["set-cookie"])
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.accessToken).toBeDefined();
    });

    test("200 con nuevo token usando refreshToken desde cookie", async () => {
      await createUser({ correo: "usuario@refreshcookie.com", rawPassword: "password123" });

      const loginRes = await request(app)
        .post("/api/auth/login")
        .send({ correo: "usuario@refreshcookie.com", password: "password123" });

      const cookie = loginRes.headers["set-cookie"];

      const res = await request(app)
        .post("/api/auth/refresh")
        .set("Cookie", cookie)
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.accessToken).toBeDefined();
      expect(res.headers["set-cookie"]).toBeDefined();
    });

    test("401 con refreshToken inválido", async () => {
      const res = await request(app)
        .post("/api/auth/refresh")
        .send({ refreshToken: "tokenbasura.novalido.xyz" });

      expect(res.status).toBe(401);
    });

    test("400 sin refreshToken en el body", async () => {
      const res = await request(app)
        .post("/api/auth/refresh")
        .send({});

      expect(res.status).toBe(400);
    });
  });

  // ─── POST /logout ────────────────────────────────────────────────────────────
  describe("POST /api/auth/logout", () => {
    test("200 al hacer logout con sesión activa", async () => {
      await createUser({ correo: "usuario@logout.com", rawPassword: "password123" });

      const loginRes = await request(app)
        .post("/api/auth/login")
        .send({ correo: "usuario@logout.com", password: "password123" });

      const res = await request(app)
        .post("/api/auth/logout")
        .set("x-token", loginRes.body.accessToken)
        .set("Cookie", loginRes.headers["set-cookie"])
        .send({});

      expect(res.status).toBe(200);
      expect(res.headers["set-cookie"]).toBeDefined();
    });

    test("401 sin token de autenticación", async () => {
      const res = await request(app).post("/api/auth/logout").send({ refreshToken: "any" });
      expect(res.status).toBe(401);
    });
  });

  // ─── POST /logout-all ─────────────────────────────────────────────────────────
  describe("POST /api/auth/logout-all", () => {
    test("200 cierra todas las sesiones del usuario", async () => {
      await createUser({ correo: "usuario@logoutall.com", rawPassword: "password123" });

      const loginRes = await request(app)
        .post("/api/auth/login")
        .send({ correo: "usuario@logoutall.com", password: "password123" });

      const res = await request(app)
        .post("/api/auth/logout-all")
        .set("x-token", loginRes.body.accessToken);

      expect(res.status).toBe(200);
    });

    test("401 sin token de autenticación", async () => {
      const res = await request(app).post("/api/auth/logout-all");
      expect(res.status).toBe(401);
    });
  });
});
