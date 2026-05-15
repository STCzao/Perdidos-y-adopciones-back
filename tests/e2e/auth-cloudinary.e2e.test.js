jest.mock("../../helpers/enviar-mails", () => ({ enviarEmail: jest.fn().mockResolvedValue(undefined) }));
jest.mock("../../helpers/logger", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));

const request = require("supertest");
const db = require("../setup/db");
const createApp = require("../setup/testApp");
const { createUser } = require("../setup/factories");

let app;

describe("E2E: /api/auth/cloudinary-signature", () => {
  beforeAll(async () => {
    await db.connect();
    app = createApp();
  });

  afterAll(async () => await db.disconnect());
  afterEach(async () => await db.clearCollections());

  test("401 sin autenticacion", async () => {
    const res = await request(app).get("/api/auth/cloudinary-signature");
    expect(res.status).toBe(401);
  });

  test("200 retorna signature, timestamp, apiKey y cloudName", async () => {
    await createUser({ correo: "firma@test.com", rawPassword: "password123" });
    const login = await request(app)
      .post("/api/auth/login")
      .send({ correo: "firma@test.com", password: "password123" });

    const res = await request(app)
      .get("/api/auth/cloudinary-signature")
      .set("x-token", login.body.accessToken);

    expect(res.status).toBe(200);
    expect(res.body.signature).toBeDefined();
    expect(res.body.timestamp).toBeDefined();
    expect(res.body.apiKey).toBe(process.env.CLOUDINARY_API_KEY);
    expect(res.body.cloudName).toBe(process.env.CLOUDINARY_CLOUD_NAME);
  });
});
