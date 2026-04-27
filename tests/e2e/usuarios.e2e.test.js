jest.mock("../../helpers/enviar-mails", () => ({ enviarEmail: jest.fn().mockResolvedValue(undefined) }));
jest.mock("../../helpers/logger", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));

const request = require("supertest");
const db = require("../setup/db");
const createApp = require("../setup/testApp");
const { createUser, createAdmin } = require("../setup/factories");
const Usuario = require("../../models/usuario");

let app;

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

  describe("POST /api/usuarios", () => {
    test("201 crea usuario con datos validos", async () => {
      const res = await request(app).post("/api/usuarios").send({
        nombre: "Juan Perez",
        correo: "juan@nuevo.com",
        password: "pass1234",
        confirmPassword: "pass1234",
        telefono: "3812345678",
      });

      expect(res.status).toBe(201);
      expect(res.body.usuario).toBeDefined();
      expect(res.body.usuario.correo).toBe("juan@nuevo.com");
    });

    test("400 si el correo ya esta registrado", async () => {
      await createUser({ correo: "duplicado@test.com" });

      const res = await request(app).post("/api/usuarios").send({
        nombre: "Repetido",
        correo: "duplicado@test.com",
        password: "pass1234",
        confirmPassword: "pass1234",
        telefono: "3812345678",
      });
      expect(res.status).toBe(400);
    });

    test("400 si la confirmación de contraseña no coincide", async () => {
      const res = await request(app).post("/api/usuarios").send({
        nombre: "Juan Perez",
        correo: "juan2@nuevo.com",
        password: "pass1234",
        confirmPassword: "distinta123",
        telefono: "3812345678",
      });

      expect(res.status).toBe(400);
      expect(res.body.errors?.confirmPassword).toBeDefined();
    });
  });

  describe("GET /api/usuarios/mi-perfil", () => {
    test("200 retorna datos del usuario y resumen de seguridad", async () => {
      await createUser({
        correo: "perfil@test.com",
        rawPassword: "password123",
        refreshTokens: [{ token: "rt", device: "Chrome", ip: "181.20.1.10" }],
      });
      const token = await loginAs("perfil@test.com");

      const res = await request(app)
        .get("/api/usuarios/mi-perfil")
        .set("x-token", token);

      expect(res.status).toBe(200);
      expect(res.body.usuario.correo).toBe("perfil@test.com");
      expect(res.body.seguridad).toBeDefined();
      expect(res.body.seguridad.sesionesActivas).toBeGreaterThanOrEqual(1);
    });

    test("401 sin token", async () => {
      const res = await request(app).get("/api/usuarios/mi-perfil");
      expect(res.status).toBe(401);
    });
  });

  describe("PUT /api/usuarios/mi-perfil", () => {
    test("200 actualiza nombre e imagen del usuario", async () => {
      await createUser({ correo: "update@test.com", rawPassword: "password123" });
      const token = await loginAs("update@test.com");

      const res = await request(app)
        .put("/api/usuarios/mi-perfil")
        .set("x-token", token)
        .send({
          nombre: "Nuevo Nombre",
          img: "https://res.cloudinary.com/demo/image/upload/avatar.jpg",
        });

      expect(res.status).toBe(200);
      expect(res.body.usuario.nombre).toBe("Nuevo Nombre");
      expect(res.body.usuario.img).toBe("https://res.cloudinary.com/demo/image/upload/avatar.jpg");
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

    test("400 si la imagen no pertenece a Cloudinary", async () => {
      await createUser({ correo: "img@test.com", rawPassword: "password123" });
      const token = await loginAs("img@test.com");

      const res = await request(app)
        .put("/api/usuarios/mi-perfil")
        .set("x-token", token)
        .send({ img: "https://otro-cdn.com/avatar.jpg" });

      expect(res.status).toBe(400);
    });
  });

  describe("PATCH /api/usuarios/mi-perfil/password", () => {
    test("200 cambia la contraseña y limpia sesiones persistidas", async () => {
      const user = await createUser({
        correo: "pass@test.com",
        rawPassword: "password123",
        refreshTokens: [{ token: "rt", device: "Chrome", ip: "::1" }],
      });
      const token = await loginAs("pass@test.com");

      const res = await request(app)
        .patch("/api/usuarios/mi-perfil/password")
        .set("x-token", token)
        .send({
          currentPassword: "password123",
          newPassword: "nuevapass123",
          confirmPassword: "nuevapass123",
        });

      expect(res.status).toBe(200);
      const updated = await Usuario.findById(user._id);
      expect(updated.refreshTokens).toHaveLength(0);
    });

    test("400 si la contraseña actual es incorrecta", async () => {
      await createUser({ correo: "pass2@test.com", rawPassword: "password123" });
      const token = await loginAs("pass2@test.com");

      const res = await request(app)
        .patch("/api/usuarios/mi-perfil/password")
        .set("x-token", token)
        .send({
          currentPassword: "incorrecta",
          newPassword: "nuevapass123",
          confirmPassword: "nuevapass123",
        });

      expect(res.status).toBe(400);
    });

    test("400 si la confirmación no coincide en cambio de contraseña", async () => {
      await createUser({ correo: "pass3@test.com", rawPassword: "password123" });
      const token = await loginAs("pass3@test.com");

      const res = await request(app)
        .patch("/api/usuarios/mi-perfil/password")
        .set("x-token", token)
        .send({
          currentPassword: "password123",
          newPassword: "nuevapass123",
          confirmPassword: "otra12345",
        });

      expect(res.status).toBe(400);
      expect(res.body.errors?.confirmPassword).toBeDefined();
    });
  });

  describe("GET /api/usuarios", () => {
    test("200 retorna lista paginada para ADMIN_ROLE", async () => {
      await createAdmin({ correo: "admin@list.com", rawPassword: "password123" });
      const token = await loginAs("admin@list.com");

      const res = await request(app).get("/api/usuarios").set("x-token", token);

      expect(res.status).toBe(200);
      expect(res.body.usuarios).toBeDefined();
    });
  });

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
  });

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
  });
});
