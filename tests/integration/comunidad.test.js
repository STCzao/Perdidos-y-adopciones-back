jest.mock("../../helpers/logger", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));

const db = require("../setup/db");
const { createAdmin, createComunidad } = require("../setup/factories");
const Comunidad = require("../../models/comunidad");
const comunidadService = require("../../service/comunidad");

describe("service/comunidad — integración", () => {
  beforeAll(async () => await db.connect());
  afterAll(async () => await db.disconnect());
  afterEach(async () => await db.clearCollections());

  // ─── crearComunidad ──────────────────────────────────────────────────────────
  describe("crearComunidad", () => {
    test("normaliza título y categoría a mayúsculas", async () => {
      const admin = await createAdmin();
      const result = await comunidadService.crearComunidad({
        body: {
          titulo: "mi historia",
          contenido: "Contenido del post de prueba",
          categoria: "historia",
          img: "https://res.cloudinary.com/demo/image/upload/test.jpg",
        },
        usuarioActual: admin,
        ip: "::1",
      });
      expect(result.comunidad.titulo).toBe("MI HISTORIA");
      expect(result.comunidad.categoria).toBe("HISTORIA");
    });

    test("asigna el usuario correcto al post", async () => {
      const admin = await createAdmin();
      const result = await comunidadService.crearComunidad({
        body: {
          titulo: "POST DE PRUEBA",
          contenido: "Contenido del post de prueba",
          categoria: "HISTORIA",
          img: "https://res.cloudinary.com/demo/image/upload/test.jpg",
        },
        usuarioActual: admin,
        ip: "::1",
      });
      expect(result.comunidad.usuario._id.toString()).toBe(admin._id.toString());
    });

    test("persiste el post en MongoDB", async () => {
      const admin = await createAdmin();
      await comunidadService.crearComunidad({
        body: {
          titulo: "POST DE PRUEBA",
          contenido: "Contenido del post",
          categoria: "HISTORIA",
          img: "https://res.cloudinary.com/demo/image/upload/test.jpg",
        },
        usuarioActual: admin,
        ip: "::1",
      });
      const count = await Comunidad.countDocuments();
      expect(count).toBe(1);
    });
  });

  // ─── getComunidades ──────────────────────────────────────────────────────────
  describe("getComunidades", () => {
    test("retorna todos los posts ordenados por fecha descendente", async () => {
      const admin = await createAdmin();
      await createComunidad(admin._id, { titulo: "PRIMER POST", fechaCreacion: new Date(Date.now() - 2000) });
      await createComunidad(admin._id, { titulo: "SEGUNDO POST", fechaCreacion: new Date() });

      const result = await comunidadService.getComunidades();
      expect(result.comunidades).toHaveLength(2);
      // el más reciente primero
      expect(result.comunidades[0].titulo).toBe("SEGUNDO POST");
    });

    test("retorna array vacío cuando no hay posts", async () => {
      const result = await comunidadService.getComunidades();
      expect(result.comunidades).toHaveLength(0);
    });
  });

  // ─── getComunidadById ────────────────────────────────────────────────────────
  describe("getComunidadById", () => {
    test("retorna el post correcto por id", async () => {
      const admin = await createAdmin();
      const post = await createComunidad(admin._id);

      const result = await comunidadService.getComunidadById({ id: post._id.toString() });
      expect(result.post._id.toString()).toBe(post._id.toString());
    });

    test("lanza 404 para id inexistente", async () => {
      const { Types } = require("mongoose");
      await expect(
        comunidadService.getComunidadById({ id: new Types.ObjectId().toString() })
      ).rejects.toMatchObject({ statusCode: 404 });
    });
  });

  // ─── actualizarComunidad ─────────────────────────────────────────────────────
  describe("actualizarComunidad", () => {
    test("actualiza y normaliza el título", async () => {
      const admin = await createAdmin();
      const post = await createComunidad(admin._id);

      const result = await comunidadService.actualizarComunidad({
        id: post._id.toString(),
        body: { titulo: "nuevo titulo actualizado" },
        usuarioActual: admin,
        ip: "::1",
      });
      expect(result.editado.titulo).toBe("NUEVO TITULO ACTUALIZADO");
    });

    test("lanza 404 para id inexistente", async () => {
      const { Types } = require("mongoose");
      const admin = await createAdmin();
      await expect(
        comunidadService.actualizarComunidad({
          id: new Types.ObjectId().toString(),
          body: { titulo: "NUEVO TITULO" },
          usuarioActual: admin,
          ip: "::1",
        })
      ).rejects.toMatchObject({ statusCode: 404 });
    });
  });

  // ─── eliminarComunidad ───────────────────────────────────────────────────────
  describe("eliminarComunidad", () => {
    test("elimina el documento de la DB", async () => {
      const admin = await createAdmin();
      const post = await createComunidad(admin._id);

      await comunidadService.eliminarComunidad({
        id: post._id.toString(),
        usuarioActual: admin,
        ip: "::1",
      });

      const inDB = await Comunidad.findById(post._id);
      expect(inDB).toBeNull();
    });

    test("lanza 404 al intentar eliminar id inexistente", async () => {
      const { Types } = require("mongoose");
      const admin = await createAdmin();
      await expect(
        comunidadService.eliminarComunidad({
          id: new Types.ObjectId().toString(),
          usuarioActual: admin,
          ip: "::1",
        })
      ).rejects.toMatchObject({ statusCode: 404 });
    });
  });
});
