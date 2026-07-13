jest.mock("../../helpers/enviar-mails", () => ({ enviarEmail: jest.fn().mockResolvedValue(undefined) }));
jest.mock("../../helpers/logger", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));

const request = require("supertest");
const mongoose = require("mongoose");
const db = require("../setup/db");
const createApp = require("../setup/testApp");
const { createUser, createAdmin, createPublicacion } = require("../setup/factories");

let app;

const loginAs = async (correo, password = "password123") => {
  const res = await request(app).post("/api/auth/login").send({ correo, password });
  return res.body.accessToken;
};

describe("E2E: /api/reclamos", () => {
  beforeAll(async () => {
    await db.connect();
    app = createApp();
  });
  afterAll(async () => await db.disconnect());
  afterEach(async () => await db.clearCollections());

  describe("Guardas de rol admin", () => {
    test("401 sin token en GET /huerfanos", async () => {
      const res = await request(app).get("/api/reclamos/huerfanos");
      expect(res.status).toBe(401);
    });

    test("403 con usuario no admin en GET /huerfanos", async () => {
      await createUser({ correo: "user@test.com", rawPassword: "password123" });
      const token = await loginAs("user@test.com");

      const res = await request(app).get("/api/reclamos/huerfanos").set("x-token", token);
      expect(res.status).toBe(403);
    });

    test("403 con usuario no admin en POST /asignar", async () => {
      await createUser({ correo: "user2@test.com", rawPassword: "password123" });
      const token = await loginAs("user2@test.com");

      const res = await request(app)
        .post("/api/reclamos/asignar")
        .set("x-token", token)
        .send({ usuarioNuevo: new mongoose.Types.ObjectId().toString(), usuarioViejoId: new mongoose.Types.ObjectId().toString() });
      expect(res.status).toBe(403);
    });
  });

  describe("Flujo completo de reclamo", () => {
    test("busca huerfanos, ve el detalle de un cluster y reasigna a un usuario real", async () => {
      const admin = await createAdmin({ correo: "admin@test.com", rawPassword: "password123" });
      const adminToken = await loginAs("admin@test.com");

      const usuarioNuevo = await createUser({ correo: "recupera@test.com", rawPassword: "password123" });
      const usuarioViejo = new mongoose.Types.ObjectId();
      const pub = await createPublicacion(usuarioViejo, { whatsapp: "3819990001" });

      const buscar = await request(app)
        .get("/api/reclamos/huerfanos")
        .query({ telefono: "3819990001" })
        .set("x-token", adminToken);
      expect(buscar.status).toBe(200);
      expect(buscar.body.clusters).toHaveLength(1);
      expect(buscar.body.clusters[0].usuarioViejoId).toBe(String(usuarioViejo));

      const detalle = await request(app)
        .get(`/api/reclamos/huerfanos/${usuarioViejo}`)
        .set("x-token", adminToken);
      expect(detalle.status).toBe(200);
      expect(detalle.body.publicaciones).toHaveLength(1);

      const asignar = await request(app)
        .post("/api/reclamos/asignar")
        .set("x-token", adminToken)
        .send({ usuarioViejoId: String(usuarioViejo), usuarioNuevo: String(usuarioNuevo._id) });
      expect(asignar.status).toBe(200);
      expect(asignar.body.publicacionesReasignadas).toBe(1);

      const publicacion = await request(app).get(`/api/publicaciones/${pub._id}`);
      expect(String(publicacion.body.publicacion.usuario._id || publicacion.body.publicacion.usuario)).toBe(
        String(usuarioNuevo._id),
      );
    });

    test("400 si no viene usuarioViejoId ni publicaciones en /asignar", async () => {
      const admin = await createAdmin({ correo: "admin2@test.com", rawPassword: "password123" });
      const adminToken = await loginAs("admin2@test.com");
      const usuarioNuevo = await createUser();

      const res = await request(app)
        .post("/api/reclamos/asignar")
        .set("x-token", adminToken)
        .send({ usuarioNuevo: String(usuarioNuevo._id) });

      expect(res.status).toBe(400);
    });
  });
});
