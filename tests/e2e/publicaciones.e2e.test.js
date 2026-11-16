jest.mock("../../helpers/enviar-mails", () => ({ enviarEmail: jest.fn().mockResolvedValue(undefined) }));
jest.mock("../../helpers/logger", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));
jest.mock("../../helpers/geocoding", () => ({
  geocodificarDireccion: jest
    .fn()
    .mockResolvedValue({ lat: -26.8241, lng: -65.2226, clase: "amenity", tipo: "park" }),
  esResultadoImpreciso: jest.fn().mockReturnValue(false),
}));

const request = require("supertest");
const db = require("../setup/db");
const createApp = require("../setup/testApp");
const { createUser, createAdmin, createPublicacion } = require("../setup/factories");
const Publicacion = require("../../models/publicacion");

let app;

const loginAs = async (correo, password = "password123") => {
  const res = await request(app).post("/api/auth/login").send({ correo, password });
  return res.body.accessToken;
};

// Publicación válida tipo PERDIDO para usar en POST
const PUBLICACION_VALIDA = {
  tipo: "PERDIDO",
  especie: "PERRO",
  raza: "LABRADOR RETRIEVER",
  nombreanimal: "FIRULAIS",
  sexo: "MACHO",
  tamaño: "GRANDE",
  color: "NEGRO",
  edad: "ADULTO",
  localidad: "SAN MIGUEL DE TUCUMAN",
  lugar: "PARQUE 9 DE JULIO",
  fecha: "2026-03-19",
  whatsapp: "3812345678901",
  imgs: ["https://res.cloudinary.com/demo/image/upload/test.jpg"],
};

describe("E2E: /api/publicaciones", () => {
  beforeAll(async () => {
    await db.connect();
    app = createApp();
  });
  afterAll(async () => await db.disconnect());
  afterEach(async () => await db.clearCollections());

  // ─── GET / — Lista pública ────────────────────────────────────────────────────
  describe("GET /api/publicaciones", () => {
    test("200 devuelve lista pública sin autenticación", async () => {
      const res = await request(app).get("/api/publicaciones");
      expect(res.status).toBe(200);
      expect(res.body.publicaciones).toBeDefined();
    });

    test("excluye publicaciones INACTIVO de la lista pública", async () => {
      const user = await createUser();
      await createPublicacion(user._id, { estado: "INACTIVO" });
      await createPublicacion(user._id, { estado: "SE BUSCA" });

      const res = await request(app).get("/api/publicaciones");
      expect(res.status).toBe(200);
      expect(res.body.total).toBe(1);
    });

    test("filtra por tipo correctamente", async () => {
      const user = await createUser();
      await createPublicacion(user._id, { tipo: "PERDIDO", estado: "SE BUSCA" });
      await createPublicacion(user._id, {
        tipo: "ENCONTRADO",
        estado: "BUSCANDO A SU FAMILIA",
        localidad: "SAN MIGUEL DE TUCUMAN",
        lugar: "PARQUE 9 DE JULIO",
        fecha: "2026-03-19",
      });

      const res = await request(app).get("/api/publicaciones?tipo=PERDIDO");
      expect(res.status).toBe(200);
      expect(res.body.total).toBe(1);
    });

    test("retorna paginación en el response", async () => {
      const res = await request(app).get("/api/publicaciones?page=1&limit=5");
      expect(res.status).toBe(200);
      expect(res.body.page).toBe(1);
      expect(res.body.totalPages).toBeDefined();
    });
  });

  // ─── GET /razas ───────────────────────────────────────────────────────────────
  describe("GET /api/publicaciones/razas", () => {
    test("200 retorna el catálogo de razas sin autenticación", async () => {
      const res = await request(app).get("/api/publicaciones/razas");
      expect(res.status).toBe(200);
      expect(res.body.razas).toBeDefined();
      expect(Array.isArray(res.body.razas)).toBe(true);
    });
  });

  // ─── GET /estadisticas ────────────────────────────────────────────────────────
  describe("GET /api/publicaciones/estadisticas", () => {
    const ADOPCION_EXTRA = {
      tipo: "ADOPCION",
      afinidad: "ALTA",
      afinidadanimales: "MEDIA",
      energia: "BAJA",
      castrado: true,
    };

    test("200 separa activos y resueltos por tipo, sin autenticación", async () => {
      const user = await createUser();
      await createPublicacion(user._id, { tipo: "PERDIDO", estado: "SE BUSCA" });
      await createPublicacion(user._id, { tipo: "PERDIDO", estado: "SE BUSCA" });
      await createPublicacion(user._id, { tipo: "PERDIDO", estado: "YA APARECIO" });
      await createPublicacion(user._id, { tipo: "ENCONTRADO", estado: "BUSCANDO A SU FAMILIA" });
      await createPublicacion(user._id, { tipo: "ENCONTRADO", estado: "APARECIO SU FAMILIA" });
      await createPublicacion(user._id, { tipo: "ENCONTRADO", estado: "TIENE NUEVA FAMILIA" });
      await createPublicacion(user._id, { ...ADOPCION_EXTRA, estado: "ADOPTADO" });

      const res = await request(app).get("/api/publicaciones/estadisticas");

      expect(res.status).toBe(200);
      expect(res.body.estadisticas).toEqual({
        PERDIDO: { total: 3, activos: 2, resueltos: 1 },
        ENCONTRADO: { total: 3, activos: 1, resueltos: 2 },
        ADOPCION: { total: 1, activos: 0, resueltos: 1 },
      });
    });

    test("no cuenta publicaciones INACTIVO ni estados que no corresponden al tipo", async () => {
      const user = await createUser();
      await createPublicacion(user._id, { tipo: "PERDIDO", estado: "INACTIVO" });
      await createPublicacion(user._id, { tipo: "PERDIDO", estado: "ADOPTADO" });
      await createPublicacion(user._id, { tipo: "PERDIDO", estado: "SE BUSCA" });

      const res = await request(app).get("/api/publicaciones/estadisticas");

      expect(res.status).toBe(200);
      expect(res.body.estadisticas.PERDIDO).toEqual({ total: 1, activos: 1, resueltos: 0 });
      expect(res.body.estadisticas.ADOPCION).toEqual({ total: 0, activos: 0, resueltos: 0 });
    });
  });

  // ─── PUT /:id/estado ──────────────────────────────────────────────────────────
  describe("PUT /api/publicaciones/:id/estado", () => {
    test("200 acepta un estado propio del tipo", async () => {
      const owner = await createUser({ correo: "estado-ok@test.com", rawPassword: "password123" });
      const pub = await createPublicacion(owner._id, { tipo: "PERDIDO", estado: "SE BUSCA" });
      const token = await loginAs("estado-ok@test.com");

      const res = await request(app)
        .put(`/api/publicaciones/${pub._id}/estado`)
        .set("x-token", token)
        .send({ estado: "YA APARECIO" });

      expect(res.status).toBe(200);
      expect(res.body.publicacion.estado).toBe("YA APARECIO");
    });

    test("400 rechaza un estado de otro tipo y no modifica la publicación", async () => {
      const owner = await createUser({ correo: "estado-mal@test.com", rawPassword: "password123" });
      const pub = await createPublicacion(owner._id, { tipo: "PERDIDO", estado: "SE BUSCA" });
      const token = await loginAs("estado-mal@test.com");

      const res = await request(app)
        .put(`/api/publicaciones/${pub._id}/estado`)
        .set("x-token", token)
        .send({ estado: "ADOPTADO" });

      expect(res.status).toBe(400);
      expect(res.body.msg).toMatch(/no corresponde/i);
      const enDb = await Publicacion.findById(pub._id);
      expect(enDb.estado).toBe("SE BUSCA");
    });

    test("400 también para un admin", async () => {
      await createAdmin({ correo: "admin-estado@test.com", rawPassword: "password123" });
      const user = await createUser();
      const pub = await createPublicacion(user._id, {
        tipo: "ENCONTRADO",
        estado: "BUSCANDO A SU FAMILIA",
      });
      const token = await loginAs("admin-estado@test.com");

      const res = await request(app)
        .put(`/api/publicaciones/${pub._id}/estado`)
        .set("x-token", token)
        .send({ estado: "YA APARECIO" });

      expect(res.status).toBe(400);
    });

    test("200 permite pasar a INACTIVO desde cualquier tipo", async () => {
      const owner = await createUser({ correo: "estado-baja@test.com", rawPassword: "password123" });
      const pub = await createPublicacion(owner._id, {
        tipo: "ENCONTRADO",
        estado: "BUSCANDO A SU FAMILIA",
      });
      const token = await loginAs("estado-baja@test.com");

      const res = await request(app)
        .put(`/api/publicaciones/${pub._id}/estado`)
        .set("x-token", token)
        .send({ estado: "INACTIVO" });

      expect(res.status).toBe(200);
    });
  });

  // ─── POST / — Crear publicación ───────────────────────────────────────────────
  describe("POST /api/publicaciones", () => {
    test("201 con cuerpo válido y autenticación", async () => {
      await createUser({ correo: "pub@test.com", rawPassword: "password123" });
      const token = await loginAs("pub@test.com");

      const res = await request(app)
        .post("/api/publicaciones")
        .set("x-token", token)
        .send(PUBLICACION_VALIDA);

      expect(res.status).toBe(201);
      expect(res.body.publicacion).toBeDefined();
      expect(res.body.publicacion.estado).toBe("SE BUSCA");
    });

    test("401 sin token de autenticación", async () => {
      const res = await request(app)
        .post("/api/publicaciones")
        .send(PUBLICACION_VALIDA);
      expect(res.status).toBe(401);
    });

    test("400 si falta el tipo", async () => {
      await createUser({ correo: "tipo@test.com", rawPassword: "password123" });
      const token = await loginAs("tipo@test.com");

      const { tipo, ...sinTipo } = PUBLICACION_VALIDA;
      const res = await request(app)
        .post("/api/publicaciones")
        .set("x-token", token)
        .send(sinTipo);

      expect(res.status).toBe(400);
    });

    test("400 si la raza no corresponde a la especie", async () => {
      await createUser({ correo: "raza@test.com", rawPassword: "password123" });
      const token = await loginAs("raza@test.com");

      const res = await request(app)
        .post("/api/publicaciones")
        .set("x-token", token)
        .send({ ...PUBLICACION_VALIDA, especie: "GATO" }); // raza es de perro

      expect(res.status).toBe(400);
    });
  });

  // ─── GET /:id — Publicación individual ───────────────────────────────────────
  describe("GET /api/publicaciones/:id", () => {
    test("200 retorna publicación activa sin whatsapp ni ubicación exacta", async () => {
      const user = await createUser();
      const pub = await createPublicacion(user._id, { estado: "SE BUSCA" });

      const res = await request(app).get(`/api/publicaciones/${pub._id}`);
      expect(res.status).toBe(200);
      expect(res.body.publicacion).toBeDefined();
      expect(res.body.publicacion.whatsapp).toBeUndefined();
      expect(res.body.publicacion.ubicacion).toBeUndefined();
      expect(res.body.publicacion.ubicacionPublica).toBeDefined();
    });

    test("400 con un id que no es MongoId", async () => {
      const res = await request(app).get("/api/publicaciones/noesunmongoid");
      expect(res.status).toBe(400);
    });
  });

  // ─── GET /contacto/:id ────────────────────────────────────────────────────────
  describe("GET /api/publicaciones/contacto/:id", () => {
    test("200 retorna el whatsapp con autenticación", async () => {
      await createUser({ correo: "contacto@test.com", rawPassword: "password123" });
      const user = await createUser();
      const pub = await createPublicacion(user._id, { estado: "SE BUSCA" });
      const token = await loginAs("contacto@test.com");

      const res = await request(app)
        .get(`/api/publicaciones/contacto/${pub._id}`)
        .set("x-token", token);

      expect(res.status).toBe(200);
      expect(res.body.whatsapp).toBeDefined();
    });

    test("401 sin token de autenticación", async () => {
      const user = await createUser();
      const pub = await createPublicacion(user._id, { estado: "SE BUSCA" });

      const res = await request(app).get(`/api/publicaciones/contacto/${pub._id}`);
      expect(res.status).toBe(401);
    });
  });

  // ─── GET /:id/ubicacion-exacta ─────────────────────────────────────────────────
  describe("GET /api/publicaciones/:id/ubicacion-exacta", () => {
    test("200 retorna la ubicación exacta para un moderador", async () => {
      await createUser({ correo: "mod@test.com", rawPassword: "password123", rol: "MODERADOR_ROLE" });
      const user = await createUser();
      const pub = await createPublicacion(user._id, { estado: "SE BUSCA" });
      const token = await loginAs("mod@test.com");

      const res = await request(app)
        .get(`/api/publicaciones/${pub._id}/ubicacion-exacta`)
        .set("x-token", token);

      expect(res.status).toBe(200);
      expect(res.body.ubicacion).toBeDefined();
      expect(res.body.ubicacion.type).toBe("Point");
    });

    test("200 retorna la ubicación exacta para un admin", async () => {
      const admin = await createAdmin({ correo: "admin-ubi@test.com", rawPassword: "password123" });
      const pub = await createPublicacion(admin._id, { estado: "SE BUSCA" });
      const token = await loginAs("admin-ubi@test.com");

      const res = await request(app)
        .get(`/api/publicaciones/${pub._id}/ubicacion-exacta`)
        .set("x-token", token);

      expect(res.status).toBe(200);
      expect(res.body.ubicacion).toBeDefined();
    });

    test("403 para un usuario sin rol moderador/admin", async () => {
      await createUser({ correo: "user-ubi@test.com", rawPassword: "password123" });
      const user = await createUser();
      const pub = await createPublicacion(user._id, { estado: "SE BUSCA" });
      const token = await loginAs("user-ubi@test.com");

      const res = await request(app)
        .get(`/api/publicaciones/${pub._id}/ubicacion-exacta`)
        .set("x-token", token);

      expect(res.status).toBe(403);
    });

    test("401 sin token de autenticación", async () => {
      const user = await createUser();
      const pub = await createPublicacion(user._id, { estado: "SE BUSCA" });

      const res = await request(app).get(`/api/publicaciones/${pub._id}/ubicacion-exacta`);
      expect(res.status).toBe(401);
    });
  });

  // ─── PUT /:id — Actualizar publicación ───────────────────────────────────────
  describe("PUT /api/publicaciones/:id", () => {
    test("200 el dueño puede actualizar su publicación", async () => {
      await createUser({ correo: "dueño@test.com", rawPassword: "password123" });
      const dueño = await createUser({ correo: "owner@test.com" });
      const pub = await createPublicacion(dueño._id, { estado: "SE BUSCA" });

      // Login con las credenciales del dueño
      await createUser({ correo: "owner2@test.com", rawPassword: "password123" });
      // Re-creamos con el correo correcto
      const dueñoUser = await createUser({ correo: "duen@test.com", rawPassword: "password123" });
      const pub2 = await createPublicacion(dueñoUser._id, { estado: "SE BUSCA" });
      const token = await loginAs("duen@test.com");

      const res = await request(app)
        .put(`/api/publicaciones/${pub2._id}`)
        .set("x-token", token)
        .send({ color: "BLANCO" });

      expect(res.status).toBe(200);
    });

    test("401 sin token", async () => {
      const user = await createUser();
      const pub = await createPublicacion(user._id, { estado: "SE BUSCA" });

      const res = await request(app)
        .put(`/api/publicaciones/${pub._id}`)
        .send({ color: "BLANCO" });

      expect(res.status).toBe(401);
    });

    test("400 si intenta cambiar el tipo desde la edicion normal", async () => {
      const owner = await createUser({ correo: "edit-tipo@test.com", rawPassword: "password123" });
      const pub = await createPublicacion(owner._id, { estado: "SE BUSCA", tipo: "PERDIDO" });
      const token = await loginAs("edit-tipo@test.com");

      const res = await request(app)
        .put(`/api/publicaciones/${pub._id}`)
        .set("x-token", token)
        .send({ tipo: "ADOPCION" });

      expect(res.status).toBe(400);
      expect(res.body.msg).toMatch(/correccion de tipo/i);
    });
  });

  describe("POST /api/publicaciones/:id/corregir-tipo", () => {
    test("201 crea una nueva publicacion y desactiva la original", async () => {
      const owner = await createUser({ correo: "corrige@test.com", rawPassword: "password123" });
      const pub = await createPublicacion(owner._id, {
        tipo: "PERDIDO",
        estado: "SE BUSCA",
        localidad: "SAN MIGUEL DE TUCUMAN",
        lugar: "PARQUE 9 DE JULIO",
        fecha: "2026-03-19",
      });
      const token = await loginAs("corrige@test.com");

      const res = await request(app)
        .post(`/api/publicaciones/${pub._id}/corregir-tipo`)
        .set("x-token", token)
        .send({
          tipo: "ADOPCION",
          afinidad: "ALTA",
          afinidadanimales: "MEDIA",
          energia: "ALTA",
          castrado: true,
        });

      expect(res.status).toBe(201);
      expect(res.body.publicacion.tipo).toBe("ADOPCION");
      expect(res.body.publicacion.estado).toBe("EN BUSCA DE UN HOGAR");
      expect(res.body.publicacionOriginal.estado).toBe("INACTIVO");
    });
  });

  // ─── GET /admin/todas ─────────────────────────────────────────────────────────
  describe("GET /api/publicaciones/admin/todas", () => {
    test("200 para ADMIN_ROLE incluye publicaciones INACTIVO", async () => {
      const user = await createUser();
      await createPublicacion(user._id, { estado: "INACTIVO" });
      await createAdmin({ correo: "admin@pub.com", rawPassword: "password123" });
      const token = await loginAs("admin@pub.com");

      const res = await request(app)
        .get("/api/publicaciones/admin/todas")
        .set("x-token", token);

      expect(res.status).toBe(200);
      expect(res.body.publicaciones).toBeDefined();
    });

    test("403 para USER_ROLE", async () => {
      await createUser({ correo: "user@admin.com", rawPassword: "password123" });
      const token = await loginAs("user@admin.com");

      const res = await request(app)
        .get("/api/publicaciones/admin/todas")
        .set("x-token", token);

      expect(res.status).toBe(403);
    });

    test("401 sin token", async () => {
      const res = await request(app).get("/api/publicaciones/admin/todas");
      expect(res.status).toBe(401);
    });
  });

  // ─── DELETE /:id ──────────────────────────────────────────────────────────────
  describe("DELETE /api/publicaciones/:id", () => {
    test("200 el dueño puede eliminar su publicación", async () => {
      await createUser({ correo: "del@test.com", rawPassword: "password123" });
      const owner = await createUser({ correo: "delowner@test.com", rawPassword: "password123" });
      const pub = await createPublicacion(owner._id, { estado: "SE BUSCA" });
      const token = await loginAs("delowner@test.com");

      const res = await request(app)
        .delete(`/api/publicaciones/${pub._id}`)
        .set("x-token", token);

      expect(res.status).toBe(200);
    });

    test("403 si un usuario intenta eliminar publicación ajena", async () => {
      const owner = await createUser({ correo: "real@owner.com" });
      const pub = await createPublicacion(owner._id, { estado: "SE BUSCA" });
      await createUser({ correo: "otro@user.com", rawPassword: "password123" });
      const token = await loginAs("otro@user.com");

      const res = await request(app)
        .delete(`/api/publicaciones/${pub._id}`)
        .set("x-token", token);

      expect(res.status).toBe(403);
    });
  });
});
