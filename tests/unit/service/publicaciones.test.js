jest.mock("../../../models/publicacion");
jest.mock("../../../helpers/logger", () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

const publicacionService = require("../../../service/publicaciones");
const Publicacion = require("../../../models/publicacion");
const AppError = require("../../../helpers/AppError");

const makeMockPub = (overrides = {}) => ({
  _id: "pub-id-123",
  tipo: "PERDIDO",
  especie: "PERRO",
  raza: "LABRADOR RETRIEVER",
  estado: "SE BUSCA",
  usuario: "uid-123",
  ...overrides,
});

const makeUsuario = (overrides = {}) => ({
  _id: "uid-123",
  rol: "USER_ROLE",
  correo: "user@test.com",
  ...overrides,
});

describe("service/publicaciones", () => {
  beforeEach(() => jest.clearAllMocks());

  // ─── getPublicaciones ──────────────────────────────────────────────────────
  describe("getPublicaciones", () => {
    const setupQueryMock = (pubs, total = pubs.length) => {
      Publicacion.countDocuments.mockResolvedValue(total);
      Publicacion.find.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue(pubs),
      });
    };

    test("retorna publicaciones con paginación", async () => {
      const pubs = [makeMockPub(), makeMockPub()];
      setupQueryMock(pubs, 2);
      const result = await publicacionService.getPublicaciones({});
      expect(result.publicaciones).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
    });

    test("limita el máximo a 50 por página", async () => {
      setupQueryMock([]);
      const limitSpy = jest.fn().mockResolvedValue([]);
      Publicacion.find.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: limitSpy,
      });
      await publicacionService.getPublicaciones({ limit: "9999" });
      expect(limitSpy).toHaveBeenCalledWith(50);
    });

    test("filtra por tipo cuando se proporciona", async () => {
      setupQueryMock([]);
      await publicacionService.getPublicaciones({ tipo: "perdido" });
      const query = Publicacion.countDocuments.mock.calls[0][0];
      expect(query.tipo).toBe("PERDIDO");
    });

    test("no filtra estados NO públicos", async () => {
      setupQueryMock([]);
      await publicacionService.getPublicaciones({ estado: "INACTIVO" });
      const query = Publicacion.countDocuments.mock.calls[0][0];
      // INACTIVO no está en ESTADOS_PUBLICOS, no debe quedar en el query
      expect(query.estado).not.toBe("INACTIVO");
    });
  });

  // ─── getPublicacion ────────────────────────────────────────────────────────
  describe("getPublicacion", () => {
    test("lanza AppError(404) si no se encuentra la publicación", async () => {
      Publicacion.findOne.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        select: jest.fn().mockResolvedValue(null),
      });
      const err = await publicacionService.getPublicacion({ id: "bad-id" }).catch((e) => e);
      expect(err).toBeInstanceOf(AppError);
      expect(err.statusCode).toBe(404);
    });

    test("excluye el campo whatsapp del resultado público", async () => {
      const selectSpy = jest.fn().mockResolvedValue(makeMockPub());
      Publicacion.findOne.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        select: selectSpy,
      });
      await publicacionService.getPublicacion({ id: "pub-id" });
      expect(selectSpy).toHaveBeenCalledWith("-whatsapp");
    });
  });

  // ─── getPublicacionesUsuario ───────────────────────────────────────────────
  describe("getPublicacionesUsuario", () => {
    test("lanza AppError(403) si el usuario no tiene permiso", async () => {
      const usuarioActual = makeUsuario({ _id: "uid-otro" });
      const err = await publicacionService
        .getPublicacionesUsuario({ id: "uid-owner", usuarioActual })
        .catch((e) => e);
      expect(err.statusCode).toBe(403);
    });

    test("permite acceso al propio usuario", async () => {
      const usuarioActual = makeUsuario({ _id: "uid-owner" });
      Publicacion.find.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockResolvedValue([]),
      });
      const result = await publicacionService.getPublicacionesUsuario({
        id: "uid-owner",
        usuarioActual,
      });
      expect(result.publicaciones).toBeDefined();
    });

    test("permite acceso al admin sobre cualquier usuario", async () => {
      const admin = makeUsuario({ _id: "uid-admin", rol: "ADMIN_ROLE" });
      Publicacion.find.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockResolvedValue([]),
      });
      const result = await publicacionService.getPublicacionesUsuario({
        id: "uid-user",
        usuarioActual: admin,
      });
      expect(result.publicaciones).toBeDefined();
    });
  });

  // ─── crearPublicacion ──────────────────────────────────────────────────────
  describe("crearPublicacion", () => {
    test("asigna el estado por defecto según el tipo (PERDIDO → SE BUSCA)", async () => {
      let savedData;
      Publicacion.mockImplementation((data) => {
        savedData = data;
        const inst = { ...data, populate: jest.fn().mockResolvedValue(undefined) };
        inst.save = jest.fn().mockResolvedValue(inst);
        return inst;
      });

      await publicacionService.crearPublicacion({
        body: {
          tipo: "perdido",
          especie: "PERRO",
          raza: "MESTIZO",
          sexo: "MACHO",
          tamaño: "GRANDE",
          color: "negro",
          localidad: "TUCUMAN",
          lugar: "parque",
          fecha: "2026-01-01",
          whatsapp: "3812345678",
          img: "https://res.cloudinary.com/t/i/t.jpg",
        },
        usuarioId: "uid-123",
        correo: "user@test.com",
        ip: "::1",
      });

      expect(savedData.estado).toBe("SE BUSCA");
    });

    test("normaliza todas las strings a mayúsculas", async () => {
      let savedData;
      Publicacion.mockImplementation((data) => {
        savedData = data;
        const inst = { ...data, populate: jest.fn().mockResolvedValue(undefined) };
        inst.save = jest.fn().mockResolvedValue(inst);
        return inst;
      });

      await publicacionService.crearPublicacion({
        body: { tipo: "perdido", color: "negro", especie: "PERRO", raza: "MESTIZO", sexo: "MACHO", tamaño: "GRANDE", localidad: "tucuman", lugar: "parque", fecha: "2026-01-01", whatsapp: "3812345678901", img: "https://res.cloudinary.com/t/i/t.jpg" },
        usuarioId: "uid",
        correo: "x@x.com",
        ip: "::1",
      });

      expect(savedData.color).toBe("NEGRO");
      expect(savedData.localidad).toBe("TUCUMAN");
    });

    test("no incluye campos de ADOPCION en publicaciones PERDIDO", async () => {
      let savedData;
      Publicacion.mockImplementation((data) => {
        savedData = data;
        const inst = { ...data, populate: jest.fn().mockResolvedValue(undefined) };
        inst.save = jest.fn().mockResolvedValue(inst);
        return inst;
      });

      await publicacionService.crearPublicacion({
        body: { tipo: "PERDIDO", color: "negro", especie: "PERRO", raza: "MESTIZO", sexo: "MACHO", tamaño: "GRANDE", localidad: "tucuman", lugar: "parque", fecha: "2026-01-01", whatsapp: "3812345678901", img: "https://res.cloudinary.com/t/i/t.jpg" },
        usuarioId: "uid",
        correo: "x@x.com",
        ip: "::1",
      });

      expect(savedData.afinidad).toBeUndefined();
      expect(savedData.energia).toBeUndefined();
    });
  });

  // ─── actualizarPublicacion ────────────────────────────────────────────────
  describe("actualizarPublicacion", () => {
    test("lanza AppError(404) si la publicación no existe", async () => {
      Publicacion.findById.mockResolvedValue(null);
      const err = await publicacionService
        .actualizarPublicacion({ id: "bad-id", body: {}, usuarioActual: makeUsuario() })
        .catch((e) => e);
      expect(err.statusCode).toBe(404);
    });

    test("lanza AppError(403) si el usuario no es el dueño ni admin", async () => {
      Publicacion.findById.mockResolvedValue(makeMockPub({ usuario: "uid-owner" }));
      const usuarioActual = makeUsuario({ _id: "uid-otro" });
      const err = await publicacionService
        .actualizarPublicacion({ id: "pub-id", body: {}, usuarioActual })
        .catch((e) => e);
      expect(err.statusCode).toBe(403);
    });

    test("no permite cambiar el tipo de publicación", async () => {
      const existente = makeMockPub({ usuario: "uid-owner" });
      Publicacion.findById.mockResolvedValue(existente);
      Publicacion.findByIdAndUpdate.mockReturnValue({
        populate: jest.fn().mockResolvedValue(existente),
      });

      const usuario = makeUsuario({ _id: "uid-owner" });
      await publicacionService.actualizarPublicacion({
        id: "pub-id",
        body: { tipo: "ADOPCION", color: "blanco" },
        usuarioActual: usuario,
      });

      const updateCall = Publicacion.findByIdAndUpdate.mock.calls[0][1];
      expect(updateCall.tipo).toBeUndefined();
    });

    test("elimina campos de ADOPCION en publicaciones PERDIDO al actualizar", async () => {
      const existente = makeMockPub({ tipo: "PERDIDO", usuario: "uid-owner" });
      Publicacion.findById.mockResolvedValue(existente);
      Publicacion.findByIdAndUpdate.mockReturnValue({
        populate: jest.fn().mockResolvedValue(existente),
      });

      const usuario = makeUsuario({ _id: "uid-owner" });
      await publicacionService.actualizarPublicacion({
        id: "pub-id",
        body: { color: "blanco", afinidad: "ALTA" },
        usuarioActual: usuario,
      });

      const updateCall = Publicacion.findByIdAndUpdate.mock.calls[0][1];
      expect(updateCall.afinidad).toBeUndefined();
    });
  });

  // ─── eliminarPublicacion ──────────────────────────────────────────────────
  describe("eliminarPublicacion", () => {
    test("lanza AppError(404) si la publicación no existe", async () => {
      Publicacion.findById.mockResolvedValue(null);
      const err = await publicacionService
        .eliminarPublicacion({ id: "bad-id", usuarioActual: makeUsuario(), correo: "x@x.com", ip: "::1" })
        .catch((e) => e);
      expect(err.statusCode).toBe(404);
    });

    test("lanza AppError(403) si el usuario no es el dueño ni admin", async () => {
      Publicacion.findById.mockResolvedValue(makeMockPub({ usuario: "uid-owner" }));
      const err = await publicacionService
        .eliminarPublicacion({ id: "pub-id", usuarioActual: makeUsuario({ _id: "uid-otro" }), correo: "x@x.com", ip: "::1" })
        .catch((e) => e);
      expect(err.statusCode).toBe(403);
    });
  });

  // ─── getContacto ──────────────────────────────────────────────────────────
  describe("getContacto", () => {
    test("lanza AppError(404) si la publicación no existe", async () => {
      Publicacion.findOne.mockReturnValue({
        select: jest.fn().mockResolvedValue(null),
      });
      const err = await publicacionService.getContacto({ id: "bad-id" }).catch((e) => e);
      expect(err.statusCode).toBe(404);
    });

    test("retorna el whatsapp cuando la publicación existe", async () => {
      Publicacion.findOne.mockReturnValue({
        select: jest.fn().mockResolvedValue({ whatsapp: "3812345678" }),
      });
      const result = await publicacionService.getContacto({ id: "pub-id" });
      expect(result.whatsapp).toBe("3812345678");
    });
  });
});
