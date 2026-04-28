jest.mock("../../helpers/logger", () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

jest.mock("../../middlewares/validar-jwt", () => ({
  validarJWT: jest.fn((req, _res, next) => {
    const token = req.header("x-token");

    if (!token) {
      const AppError = require("../../helpers/AppError");
      return next(new AppError("No hay token en la peticion", 401));
    }

    req.usuario = {
      _id: "507f1f77bcf86cd799439011",
      correo: "tester@test.com",
      estado: true,
      rol: "USER_ROLE",
    };
    next();
  }),
}));

const request = require("supertest");
const crypto = require("crypto");
const createApp = require("../../app");

describe("GET /api/cloudinary/signature", () => {
  const originalEnv = process.env;
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...originalEnv,
      NODE_ENV: "test",
      CLOUDINARY_CLOUD_NAME: "demo-cloud",
      CLOUDINARY_API_KEY: "demo-key",
      CLOUDINARY_API_SECRET: "demo-secret",
    };
    app = createApp({ testMode: true });
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  test("401 sin token", async () => {
    const res = await request(app).get("/api/cloudinary/signature?carpeta=publicaciones");

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test("400 con carpeta invalida", async () => {
    const res = await request(app)
      .get("/api/cloudinary/signature?carpeta=otra")
      .set("x-token", "token-valido");

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.errors?.carpeta).toBeDefined();
  });

  test("200 con respuesta firmada correcta", async () => {
    const res = await request(app)
      .get("/api/cloudinary/signature?carpeta=publicaciones")
      .set("x-token", "token-valido");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.api_key).toBe("demo-key");
    expect(res.body.cloud_name).toBe("demo-cloud");
    expect(res.body.timestamp).toEqual(expect.any(Number));
    expect(res.body.signature).toMatch(/^[a-f0-9]{40}$/);

    const expectedSignature = crypto
      .createHash("sha1")
      .update(`folder=publicaciones&timestamp=${res.body.timestamp}${process.env.CLOUDINARY_API_SECRET}`)
      .digest("hex");

    expect(res.body.signature).toBe(expectedSignature);
  });
});
