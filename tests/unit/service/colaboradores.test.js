jest.mock("../../../models/colaborador");

const colaboradoresService = require("../../../service/colaboradores");
const Colaborador = require("../../../models/colaborador");
const AppError = require("../../../helpers/AppError");

describe("service/colaboradores", () => {
  beforeEach(() => jest.clearAllMocks());

  test("registrarColaborador guarda solo detalles de formas seleccionadas", async () => {
    let savedData;
    Colaborador.mockImplementation((data) => {
      savedData = data;
      return { ...data, save: jest.fn().mockResolvedValue(data) };
    });

    const result = await colaboradoresService.registrarColaborador({
      body: {
        nombre: "Ana",
        telefono: "3812345678",
        localidad: "SAN MIGUEL DE TUCUMAN",
        barrio: "Centro",
        formasColaboracion: ["TRANSITO"],
        disponibilidadGeneral: "URGENCIAS",
        aceptaContactoWhatsapp: true,
        aceptaTerminos: true,
        detalleTransito: { opciones: ["PERROS"], observaciones: "ok" },
        detalleDifusion: { opciones: ["IG"], observaciones: "no deberia guardarse" },
      },
    });

    expect(savedData.detalleTransito).toEqual({ opciones: ["PERROS"], observaciones: "ok" });
    expect(savedData.detalleDifusion).toBeUndefined();
    expect(result.colaborador).toBeDefined();
  });

  test("getColaborador lanza 404 si no existe", async () => {
    Colaborador.findById.mockResolvedValue(null);

    const err = await colaboradoresService.getColaborador({ id: "bad-id" }).catch((e) => e);
    expect(err).toBeInstanceOf(AppError);
    expect(err.statusCode).toBe(404);
  });

  test("cambiarEstadoColaborador actualiza el estado", async () => {
    Colaborador.findById.mockResolvedValue({ _id: "col-1", activo: true });
    Colaborador.findByIdAndUpdate.mockResolvedValue({ _id: "col-1", activo: false });

    const result = await colaboradoresService.cambiarEstadoColaborador({
      id: "col-1",
      activo: false,
    });

    expect(Colaborador.findByIdAndUpdate).toHaveBeenCalledWith(
      "col-1",
      { activo: false },
      { new: true },
    );
    expect(result.colaborador.activo).toBe(false);
  });
});
