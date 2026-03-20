jest.mock("../../helpers/enviar-mails", () => ({ enviarEmail: jest.fn().mockResolvedValue(undefined) }));
jest.mock("../../helpers/logger", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));

const request = require("supertest");
const db = require("../setup/db");
const createApp = require("../setup/testApp");
const { createAdmin, createUser, createComunidad } = require("../setup/factories");

let app;

const loginAs = async (correo, password = "password123") => {
  const res = await request(app).post("/api/auth/login").send({ correo, password });
  return res.body.accessToken;
};

const POST_VALIDO = {
  titulo: "Historia de rescate",
  contenido: "Contenido de prueba con suficientes caracteres para el post de comunidad.",
  categoria: "HISTORIA",
  img: "https://res.cloudinary.com/demo/image/upload/test.jpg",
};

describe("E2E: /api/comunidad", () => {
  beforeAll(async () => {
    await db.connect();
    app = createApp();
  });
  afterAll(async () => await db.disconnect());
  afterEach(async () => await db.clearCollections());

  // ─── GET / — Lista pública ────────────────────────────────────────────────────
  describe("GET /api/comunidad", () => {
    test("200 devuelve la lista de posts sin autenticación", async () => {
      const res = await request(app).get("/api/comunidad");
      expect(res.status).toBe(200);
      expect(res.body.comunidades).toBeDefined();
      expect(Array.isArray(res.body.comunidades)).toBe(true);
    });

    test("retorna los posts ordenados — el más reciente primero", async () => {
      const admin = await createAdmin();
      await createComunidad(admin._id, { titulo: "PRIMER POST" });
      await createComunidad(admin._id, { titulo: "SEGUNDO POST" });

      const res = await request(app).get("/api/comunidad");
      expect(res.status).toBe(200);
      expect(res.body.comunidades[0].titulo).toBe("SEGUNDO POST");
    });
  });

  // ─── GET /:id — Post individual ───────────────────────────────────────────────
  describe("GET /api/comunidad/:id", () => {
    test("200 retorna el post correcto por id", async () => {
      const admin = await createAdmin();
      const post = await createComunidad(admin._id);

      const res = await request(app).get(`/api/comunidad/${post._id}`);
      expect(res.status).toBe(200);
      expect(res.body.post).toBeDefined();
      expect(res.body.post._id.toString()).toBe(post._id.toString());
    });

    test("400 con un id que no es MongoId", async () => {
      const res = await request(app).get("/api/comunidad/noesunmongoid");
      expect(res.status).toBe(400);
    });

    test("404 con un MongoId válido pero inexistente", async () => {
      const res = await request(app).get("/api/comunidad/64f1234567890abcde123456");
      expect(res.status).toBe(404);
    });
  });

  // ─── POST / — Crear post ─────────────────────────────────────────────────────
  describe("POST /api/comunidad", () => {
    test("201 el admin puede crear un post", async () => {
      await createAdmin({ correo: "admin@comunidad.com", rawPassword: "password123" });
      const token = await loginAs("admin@comunidad.com");

      const res = await request(app)
        .post("/api/comunidad")
        .set("x-token", token)
        .send(POST_VALIDO);

      expect(res.status).toBe(201);
      expect(res.body.comunidad).toBeDefined();
      expect(res.body.comunidad.titulo).toBe("HISTORIA DE RESCATE");
    });

    test("403 para USER_ROLE", async () => {
      await createUser({ correo: "user@comunidad.com", rawPassword: "password123" });
      const token = await loginAs("user@comunidad.com");

      const res = await request(app)
        .post("/api/comunidad")
        .set("x-token", token)
        .send(POST_VALIDO);

      expect(res.status).toBe(403);
    });

    test("401 sin token de autenticación", async () => {
      const res = await request(app).post("/api/comunidad").send(POST_VALIDO);
      expect(res.status).toBe(401);
    });

    test("400 si falta el título", async () => {
      await createAdmin({ correo: "admin2@comunidad.com", rawPassword: "password123" });
      const token = await loginAs("admin2@comunidad.com");

      const { titulo, ...sinTitulo } = POST_VALIDO;
      const res = await request(app)
        .post("/api/comunidad")
        .set("x-token", token)
        .send(sinTitulo);

      expect(res.status).toBe(400);
    });

    test("400 si la categoría no es válida", async () => {
      await createAdmin({ correo: "admin3@comunidad.com", rawPassword: "password123" });
      const token = await loginAs("admin3@comunidad.com");

      const res = await request(app)
        .post("/api/comunidad")
        .set("x-token", token)
        .send({ ...POST_VALIDO, categoria: "INVALIDA" });

      expect(res.status).toBe(400);
    });

    test("400 si la URL de imagen no es de Cloudinary", async () => {
      await createAdmin({ correo: "admin4@comunidad.com", rawPassword: "password123" });
      const token = await loginAs("admin4@comunidad.com");

      const res = await request(app)
        .post("/api/comunidad")
        .set("x-token", token)
        .send({ ...POST_VALIDO, img: "https://otra-cdn.com/imagen.jpg" });

      expect(res.status).toBe(400);
    });
  });

  // ─── PUT /:id — Actualizar post ───────────────────────────────────────────────
  describe("PUT /api/comunidad/:id", () => {
    test("200 el admin puede actualizar un post", async () => {
      await createAdmin({ correo: "admin@update.com", rawPassword: "password123" });
      const admin = await createAdmin({ correo: "admin2@update.com" });
      const post = await createComunidad(admin._id);
      const token = await loginAs("admin@update.com");

      const res = await request(app)
        .put(`/api/comunidad/${post._id}`)
        .set("x-token", token)
        .send({ titulo: "titulo actualizado" });

      expect(res.status).toBe(200);
      expect(res.body.editado.titulo).toBe("TITULO ACTUALIZADO");
    });

    test("403 para USER_ROLE", async () => {
      const admin = await createAdmin();
      const post = await createComunidad(admin._id);
      await createUser({ correo: "user@update.com", rawPassword: "password123" });
      const token = await loginAs("user@update.com");

      const res = await request(app)
        .put(`/api/comunidad/${post._id}`)
        .set("x-token", token)
        .send({ titulo: "intento de edición" });

      expect(res.status).toBe(403);
    });

    test("401 sin token", async () => {
      const admin = await createAdmin();
      const post = await createComunidad(admin._id);

      const res = await request(app)
        .put(`/api/comunidad/${post._id}`)
        .send({ titulo: "sin auth" });

      expect(res.status).toBe(401);
    });
  });

  // ─── DELETE /:id — Eliminar post ──────────────────────────────────────────────
  describe("DELETE /api/comunidad/:id", () => {
    test("200 el admin puede eliminar un post", async () => {
      await createAdmin({ correo: "admin@del.com", rawPassword: "password123" });
      const adminSeed = await createAdmin({ correo: "admin2@del.com" });
      const post = await createComunidad(adminSeed._id);
      const token = await loginAs("admin@del.com");

      const res = await request(app)
        .delete(`/api/comunidad/${post._id}`)
        .set("x-token", token);

      expect(res.status).toBe(200);
    });

    test("403 para USER_ROLE", async () => {
      const admin = await createAdmin();
      const post = await createComunidad(admin._id);
      await createUser({ correo: "user@del.com", rawPassword: "password123" });
      const token = await loginAs("user@del.com");

      const res = await request(app)
        .delete(`/api/comunidad/${post._id}`)
        .set("x-token", token);

      expect(res.status).toBe(403);
    });

    test("404 para id inexistente", async () => {
      await createAdmin({ correo: "admin@del2.com", rawPassword: "password123" });
      const token = await loginAs("admin@del2.com");

      const res = await request(app)
        .delete("/api/comunidad/64f1234567890abcde123456")
        .set("x-token", token);

      expect(res.status).toBe(404);
    });

    test("401 sin token", async () => {
      const admin = await createAdmin();
      const post = await createComunidad(admin._id);

      const res = await request(app).delete(`/api/comunidad/${post._id}`);
      expect(res.status).toBe(401);
    });
  });
});
