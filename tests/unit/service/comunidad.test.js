jest.mock("../../../models/comunidad");
jest.mock("../../../helpers/logger", () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

const comunidadService = require("../../../service/comunidad");
const Comunidad = require("../../../models/comunidad");
const AppError = require("../../../helpers/AppError");

const makeMockPost = (overrides = {}) => ({
  _id: "post-id-123",
  titulo: "POST DE PRUEBA",
  contenido: "Contenido de prueba.",
  categoria: "HISTORIA",
  img: "https://res.cloudinary.com/demo/image/upload/test.jpg",
  usuario: "uid-admin",
  ...overrides,
});

const makeAdmin = (overrides = {}) => ({
  _id: "uid-admin",
  correo: "admin@test.com",
  rol: "ADMIN_ROLE",
  ...overrides,
});

describe("service/comunidad", () => {
  beforeEach(() => jest.clearAllMocks());

  // ─── getComunidades ────────────────────────────────────────────────────────
  describe("getComunidades", () => {
    test("retorna comunidades ordenadas por fechaCreacion", async () => {
      const posts = [makeMockPost(), makeMockPost()];
      Comunidad.find.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockResolvedValue(posts),
      });
      const result = await comunidadService.getComunidades();
      expect(result.comunidades).toHaveLength(2);
    });
  });

  // ─── getComunidadById ──────────────────────────────────────────────────────
  describe("getComunidadById", () => {
    test("lanza AppError(404) cuando no existe el post", async () => {
      Comunidad.findById.mockReturnValue({
        populate: jest.fn().mockResolvedValue(null),
      });
      const err = await comunidadService.getComunidadById({ id: "bad-id" }).catch((e) => e);
      expect(err).toBeInstanceOf(AppError);
      expect(err.statusCode).toBe(404);
    });

    test("retorna el post cuando existe", async () => {
      const post = makeMockPost();
      Comunidad.findById.mockReturnValue({
        populate: jest.fn().mockResolvedValue(post),
      });
      const result = await comunidadService.getComunidadById({ id: "post-id" });
      expect(result.post).toBe(post);
    });
  });

  // ─── crearComunidad ────────────────────────────────────────────────────────
  describe("crearComunidad", () => {
    test("normaliza titulo y categoria a mayúsculas", async () => {
      let savedData;
      Comunidad.mockImplementation((data) => {
        savedData = data;
        const inst = { ...data, populate: jest.fn().mockResolvedValue(undefined) };
        inst.save = jest.fn().mockResolvedValue(inst);
        return inst;
      });

      await comunidadService.crearComunidad({
        body: {
          titulo: "historia de rescate",
          contenido: "Contenido.",
          categoria: "historia",
          img: "https://res.cloudinary.com/demo/image/upload/test.jpg",
        },
        usuarioActual: makeAdmin(),
        ip: "::1",
      });

      expect(savedData.titulo).toBe("HISTORIA DE RESCATE");
      expect(savedData.categoria).toBe("HISTORIA");
    });

    test("asigna el usuario del admin como creador", async () => {
      let savedData;
      Comunidad.mockImplementation((data) => {
        savedData = data;
        const inst = { ...data, populate: jest.fn().mockResolvedValue(undefined) };
        inst.save = jest.fn().mockResolvedValue(inst);
        return inst;
      });

      const admin = makeAdmin({ _id: "uid-admin-123" });
      await comunidadService.crearComunidad({
        body: { titulo: "T", contenido: "C", categoria: "ALERTA", img: "https://res.cloudinary.com/demo/image/upload/t.jpg" },
        usuarioActual: admin,
        ip: "::1",
      });

      expect(savedData.usuario).toBe("uid-admin-123");
    });
  });

  // ─── actualizarComunidad ───────────────────────────────────────────────────
  describe("actualizarComunidad", () => {
    test("lanza AppError(404) si el post no existe", async () => {
      Comunidad.findByIdAndUpdate.mockReturnValue({
        populate: jest.fn().mockResolvedValue(null),
      });
      const err = await comunidadService
        .actualizarComunidad({ id: "bad-id", body: { titulo: "Nuevo" }, usuarioActual: makeAdmin(), ip: "::1" })
        .catch((e) => e);
      expect(err.statusCode).toBe(404);
    });

    test("normaliza los campos actualizados", async () => {
      const updated = makeMockPost();
      Comunidad.findByIdAndUpdate.mockReturnValue({
        populate: jest.fn().mockResolvedValue(updated),
      });

      await comunidadService.actualizarComunidad({
        id: "post-id",
        body: { titulo: "nuevo titulo", categoria: "alerta" },
        usuarioActual: makeAdmin(),
        ip: "::1",
      });

      const updateArg = Comunidad.findByIdAndUpdate.mock.calls[0][1];
      expect(updateArg.titulo).toBe("NUEVO TITULO");
      expect(updateArg.categoria).toBe("ALERTA");
    });
  });

  // ─── eliminarComunidad ─────────────────────────────────────────────────────
  describe("eliminarComunidad", () => {
    test("lanza AppError(404) si el post no existe", async () => {
      Comunidad.findByIdAndDelete.mockResolvedValue(null);
      const err = await comunidadService
        .eliminarComunidad({ id: "bad-id", usuarioActual: makeAdmin(), ip: "::1" })
        .catch((e) => e);
      expect(err.statusCode).toBe(404);
    });

    test("elimina y retorna el post eliminado", async () => {
      const deleted = makeMockPost();
      Comunidad.findByIdAndDelete.mockResolvedValue(deleted);
      const result = await comunidadService.eliminarComunidad({
        id: "post-id",
        usuarioActual: makeAdmin(),
        ip: "::1",
      });
      expect(result.eliminado).toBe(deleted);
    });
  });
});
