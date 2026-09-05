jest.mock("../../../models/publicacion");
jest.mock("../../../helpers/cloudinary", () => ({
  eliminarImagen: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("../../../helpers/logger", () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

const publicacionService = require("../../../service/publicaciones");
const Publicacion = require("../../../models/publicacion");
const { eliminarImagen } = require("../../../helpers/cloudinary");
const AppError = require("../../../helpers/AppError");
const TAMANIO_KEY = "tama\u00f1o";

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

  test("getPublicaciones acepta el nuevo estado publico", async () => {
    Publicacion.countDocuments.mockResolvedValue(0);
    Publicacion.find.mockReturnValue({
      populate: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue([]),
    });

    await publicacionService.getPublicaciones({ estado: "TIENE NUEVA FAMILIA" });

    const query = Publicacion.countDocuments.mock.calls[0][0];
    expect(query.estado).toBe("TIENE NUEVA FAMILIA");
  });

  test("getPublicacion lanza 404 si no se encuentra", async () => {
    Publicacion.findOne.mockReturnValue({
      populate: jest.fn().mockReturnThis(),
      select: jest.fn().mockResolvedValue(null),
    });

    const err = await publicacionService.getPublicacion({ id: "bad-id" }).catch((e) => e);

    expect(err).toBeInstanceOf(AppError);
    expect(err.statusCode).toBe(404);
  });

  test("crearPublicacion asigna el estado por defecto segun el tipo", async () => {
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
        [TAMANIO_KEY]: "GRANDE",
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
    expect(savedData.imgs).toEqual(["https://res.cloudinary.com/t/i/t.jpg"]);
  });

  test("actualizarPublicacion elimina cada imagen removida si cambia el arreglo", async () => {
    const existente = makeMockPub({
      usuario: "uid-owner",
      imgs: [
        "https://res.cloudinary.com/demo/image/upload/v1/vieja-1.jpg",
        "https://res.cloudinary.com/demo/image/upload/v1/vieja-2.jpg",
      ],
    });
    Publicacion.findById.mockResolvedValue(existente);
    Publicacion.findByIdAndUpdate.mockReturnValue({
      populate: jest.fn().mockResolvedValue(existente),
    });

    await publicacionService.actualizarPublicacion({
      id: "pub-id",
      body: { imgs: ["https://res.cloudinary.com/demo/image/upload/v2/nueva.jpg"] },
      usuarioActual: makeUsuario({ _id: "uid-owner" }),
    });

    expect(eliminarImagen).toHaveBeenCalledTimes(2);
    expect(eliminarImagen).toHaveBeenCalledWith(existente.imgs[0]);
    expect(eliminarImagen).toHaveBeenCalledWith(existente.imgs[1]);
  });

  test("actualizarPublicacion rechaza el cambio de tipo con un error claro", async () => {
    const existente = makeMockPub({ usuario: "uid-owner", tipo: "PERDIDO" });
    Publicacion.findById.mockResolvedValue(existente);

    const err = await publicacionService
      .actualizarPublicacion({
        id: "pub-id",
        body: { tipo: "ADOPCION" },
        usuarioActual: makeUsuario({ _id: "uid-owner" }),
      })
      .catch((error) => error);

    expect(err).toBeInstanceOf(AppError);
    expect(err.statusCode).toBe(400);
    expect(err.message).toMatch(/correccion de tipo/i);
  });

  test("corregirTipoPublicacion crea una nueva publicacion y deja la original inactiva", async () => {
    const existente = makeMockPub({
      _id: "pub-original",
      usuario: "uid-owner",
      tipo: "PERDIDO",
      estado: "SE BUSCA",
      especie: "PERRO",
      raza: "MESTIZO",
      nombreanimal: "LUNA",
      sexo: "HEMBRA",
      [TAMANIO_KEY]: "MEDIANO",
      color: "NEGRO",
      edad: "JOVEN",
      localidad: "SAN MIGUEL DE TUCUMAN",
      lugar: "PLAZA",
      fecha: "2026-06-01",
      whatsapp: "3812345678",
      imgs: ["https://res.cloudinary.com/demo/image/upload/v1/original.jpg"],
    });

    let createdData;
    Publicacion.findById.mockResolvedValue(existente);
    Publicacion.mockImplementation((data) => {
      createdData = data;
      const inst = { ...data, _id: "pub-nueva", populate: jest.fn().mockResolvedValue(undefined) };
      inst.save = jest.fn().mockResolvedValue(inst);
      return inst;
    });
    Publicacion.findByIdAndUpdate.mockReturnValue({
      populate: jest.fn().mockResolvedValue({
        ...existente,
        estado: "INACTIVO",
        reemplazadaPor: "pub-nueva",
        motivoInactivacion: "CORRECCION_TIPO",
      }),
    });

    const result = await publicacionService.corregirTipoPublicacion({
      id: "pub-original",
      body: {
        tipo: "ADOPCION",
        afinidad: "ALTA",
        afinidadanimales: "MEDIA",
        energia: "ALTA",
        castrado: true,
      },
      usuarioActual: makeUsuario({ _id: "uid-owner" }),
      correo: "user@test.com",
      ip: "::1",
    });

    expect(createdData.tipo).toBe("ADOPCION");
    expect(createdData.estado).toBe("EN BUSCA DE UN HOGAR");
    expect(createdData.reemplaza).toBe("pub-original");
    expect(createdData.localidad).toBeUndefined();
    expect(createdData.afinidad).toBe("ALTA");
    expect(Publicacion.findByIdAndUpdate).toHaveBeenCalledWith(
      "pub-original",
      expect.objectContaining({
        estado: "INACTIVO",
        reemplazadaPor: "pub-nueva",
        motivoInactivacion: "CORRECCION_TIPO",
      }),
      expect.any(Object),
    );
    expect(result.publicacion._id).toBe("pub-nueva");
  });

  test("eliminarPublicacion elimina todas las imagenes de Cloudinary antes de borrar", async () => {
    const pub = makeMockPub({
      usuario: "uid-owner",
      imgs: [
        "https://res.cloudinary.com/demo/image/upload/v1/test-1.jpg",
        "https://res.cloudinary.com/demo/image/upload/v1/test-2.jpg",
      ],
    });
    Publicacion.findById.mockResolvedValue(pub);
    Publicacion.findByIdAndDelete.mockResolvedValue(pub);

    await publicacionService.eliminarPublicacion({
      id: "pub-id",
      usuarioActual: makeUsuario({ _id: "uid-owner" }),
      correo: "x@x.com",
      ip: "::1",
    });

    expect(eliminarImagen).toHaveBeenCalledTimes(2);
    expect(eliminarImagen).toHaveBeenCalledWith(pub.imgs[0]);
    expect(eliminarImagen).toHaveBeenCalledWith(pub.imgs[1]);
  });
});
