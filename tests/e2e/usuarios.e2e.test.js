jest.mock("../../helpers/enviar-mails", () => ({ enviarEmail: jest.fn().mockResolvedValue(undefined) }));
jest.mock("../../helpers/logger", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));

const request = require("supertest");
const db = require("../setup/db");
const createApp = require("../setup/testApp");
const { createUser, createAdmin } = require("../setup/factories");
const Usuario = require("../../models/usuario");

let app;

// Helper: login y obtener token
const loginAs = async (correo, password = "password123") => {
  const res = await request(app).post("/api/auth/login").send({ correo, password });
  return res.body.accessToken;
};

describe("E2E: /api/usuarios", () => {
  beforeAll(async () => {
    await db.connect();
    app = createApp();
  });
  afterAll(async () => await db.disconnect());
  afterEach(async () => await db.clearCollections());

  // ─── POST / — Registro ────────────────────────────────────────────────────────
  describe("POST /api/usuarios", () => {
    test("201 crea usuario con datos válidos", async () => {
      const res = await request(app).post("/api/usuarios").send({
        nombre: "Juan Perez",
        correo: "juan@nuevo.com",
        password: "pass1234",
        telefono: "3812345678",
      });

      expect(res.status).toBe(201);
      expect(res.body.usuario).toBeDefined();
      expect(res.body.usuario.correo).toBe("juan@nuevo.com");
    });

    test("400 si falta el nombre", async () => {
      const res = await request(app).post("/api/usuarios").send({
        correo: "sin@nombre.com",
        password: "pass1234",
        telefono: "3812345678",
      });
      expect(res.status).toBe(400);
      expect(res.body.errors).toBeDefined();
    });

    test("400 si el correo no es válido", async () => {
      const res = await request(app).post("/api/usuarios").send({
        nombre: "Juan",
        correo: "noesuncorreo",
        password: "pass1234",
        telefono: "3812345678",
      });
      expect(res.status).toBe(400);
    });

    test("400 si el teléfono tiene letras", async () => {
      const res = await request(app).post("/api/usuarios").send({
        nombre: "Juan",
        correo: "juan@test.com",
        password: "pass1234",
        telefono: "abc12345",
      });
      expect(res.status).toBe(400);
    });

    test("400 si el correo ya está registrado", async () => {
      await createUser({ correo: "duplicado@test.com" });

      const res = await request(app).post("/api/usuarios").send({
        nombre: "Repetido",
        correo: "duplicado@test.com",
        password: "pass1234",
        telefono: "3812345678",
      });
      expect(res.status).toBe(400);
    });
  });

  // ─── GET /mi-perfil ──────────────────────────────────────────────────────────
  describe("GET /api/usuarios/mi-perfil", () => {
    test("200 retorna los datos del usuario autenticado", async () => {
      await createUser({ correo: "perfil@test.com", rawPassword: "password123" });
      const token = await loginAs("perfil@test.com");

      const res = await request(app)
        .get("/api/usuarios/mi-perfil")
        .set("x-token", token);

      expect(res.status).toBe(200);
      expect(res.body.usuario).toBeDefined();
      expect(res.body.usuario.correo).toBe("perfil@test.com");
    });

    test("401 sin token", async () => {
      const res = await request(app).get("/api/usuarios/mi-perfil");
      expect(res.status).toBe(401);
    });
  });

  // ─── PUT /mi-perfil ──────────────────────────────────────────────────────────
  describe("PUT /api/usuarios/mi-perfil", () => {
    test("200 actualiza el nombre del usuario", async () => {
      await createUser({ correo: "update@test.com", rawPassword: "password123" });
      const token = await loginAs("update@test.com");

      const res = await request(app)
        .put("/api/usuarios/mi-perfil")
        .set("x-token", token)
        .send({ nombre: "Nuevo Nombre" });

      expect(res.status).toBe(200);
      expect(res.body.usuario.nombre).toBe("Nuevo Nombre");
    });

    test("400 si se intenta actualizar el correo", async () => {
      await createUser({ correo: "email@test.com", rawPassword: "password123" });
      const token = await loginAs("email@test.com");

      const res = await request(app)
        .put("/api/usuarios/mi-perfil")
        .set("x-token", token)
        .send({ correo: "nuevo@correo.com" });

      expect(res.status).toBe(400);
    });

    test("400 si se intenta actualizar la contraseña", async () => {
      await createUser({ correo: "pass@test.com", rawPassword: "password123" });
      const token = await loginAs("pass@test.com");

      const res = await request(app)
        .put("/api/usuarios/mi-perfil")
        .set("x-token", token)
        .send({ password: "nuevapass" });

      expect(res.status).toBe(400);
    });

    test("401 sin token", async () => {
      const res = await request(app).put("/api/usuarios/mi-perfil").send({ nombre: "X" });
      expect(res.status).toBe(401);
    });
  });

  // ─── GET / — Admin: listar usuarios ─────────────────────────────────────────
  describe("GET /api/usuarios", () => {
    test("200 retorna lista paginada para ADMIN_ROLE", async () => {
      await createAdmin({ correo: "admin@list.com", rawPassword: "password123" });
      const token = await loginAs("admin@list.com");

      const res = await request(app)
        .get("/api/usuarios")
        .set("x-token", token);

      expect(res.status).toBe(200);
      expect(res.body.usuarios).toBeDefined();
    });

    test("403 para USER_ROLE", async () => {
      await createUser({ correo: "user@list.com", rawPassword: "password123" });
      const token = await loginAs("user@list.com");

      const res = await request(app)
        .get("/api/usuarios")
        .set("x-token", token);

      expect(res.status).toBe(403);
    });

    test("401 sin token", async () => {
      const res = await request(app).get("/api/usuarios");
      expect(res.status).toBe(401);
    });
  });

  // ─── PUT /:id/estado ──────────────────────────────────────────────────────────
  describe("PUT /api/usuarios/:id/estado", () => {
    test("200 el admin puede cambiar el estado de un usuario", async () => {
      const user = await createUser({ correo: "target@test.com" });
      await createAdmin({ correo: "admin@estado.com", rawPassword: "password123" });
      const adminToken = await loginAs("admin@estado.com");

      const res = await request(app)
        .put(`/api/usuarios/${user._id}/estado`)
        .set("x-token", adminToken)
        .send({ estado: false });

      expect(res.status).toBe(200);
    });

    test("403 si un usuario normal intenta cambiar el estado", async () => {
      const target = await createUser({ correo: "target2@test.com" });
      await createUser({ correo: "normal@estado.com", rawPassword: "password123" });
      const userToken = await loginAs("normal@estado.com");

      const res = await request(app)
        .put(`/api/usuarios/${target._id}/estado`)
        .set("x-token", userToken)
        .send({ estado: false });

      expect(res.status).toBe(403);
    });
  });

  // ─── DELETE /:id ──────────────────────────────────────────────────────────────
  describe("DELETE /api/usuarios/:id", () => {
    test("200 el admin puede eliminar a otro usuario", async () => {
      const user = await createUser({ correo: "aeliminar@test.com" });
      await createAdmin({ correo: "admin@del.com", rawPassword: "password123" });
      const adminToken = await loginAs("admin@del.com");

      const res = await request(app)
        .delete(`/api/usuarios/${user._id}`)
        .set("x-token", adminToken);

      expect(res.status).toBe(200);
      const inDB = await Usuario.findById(user._id);
      expect(inDB.estado).toBe(false);
    });

    test("401 sin token", async () => {
      const user = await createUser();
      const res = await request(app).delete(`/api/usuarios/${user._id}`);
      expect(res.status).toBe(401);
    });
  });
});
