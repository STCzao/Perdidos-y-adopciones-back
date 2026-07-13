jest.mock("../../../helpers/logger", () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));
jest.mock("../../../repositories/publicacionesRepository");
jest.mock("../../../repositories/usuariosRepository");
jest.mock("../../../repositories/historialReclamosRepository");

const reclamosService = require("../../../service/reclamos");
const publicacionesRepository = require("../../../repositories/publicacionesRepository");
const usuariosRepository = require("../../../repositories/usuariosRepository");
const historialReclamosRepository = require("../../../repositories/historialReclamosRepository");
const AppError = require("../../../helpers/AppError");

describe("service/reclamos", () => {
  beforeEach(() => jest.clearAllMocks());

  describe("buscarHuerfanos", () => {
    test("devuelve los clusters mapeados desde el repository", async () => {
      publicacionesRepository.findClustersHuerfanos.mockResolvedValue({
        clusters: [
          {
            _id: "usuario-viejo-1",
            cantidad: 5,
            primeraFecha: new Date("2026-01-01"),
            ultimaFecha: new Date("2026-02-01"),
            localidades: ["YERBA BUENA"],
            tipos: ["PERDIDO"],
          },
        ],
        total: 1,
      });

      const result = await reclamosService.buscarHuerfanos({ telefono: "3811111111" });

      expect(publicacionesRepository.findClustersHuerfanos).toHaveBeenCalledWith({
        telefono: "3811111111",
        skip: 0,
        limit: 20,
      });
      expect(result.clusters).toHaveLength(1);
      expect(result.clusters[0].usuarioViejoId).toBe("usuario-viejo-1");
      expect(result.clusters[0].cantidad).toBe(5);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.totalPages).toBe(1);
    });

    test("calcula skip segun page y limit, clampeando limit al maximo permitido", async () => {
      publicacionesRepository.findClustersHuerfanos.mockResolvedValue({ clusters: [], total: 0 });

      await reclamosService.buscarHuerfanos({ page: 3, limit: 500 });

      expect(publicacionesRepository.findClustersHuerfanos).toHaveBeenCalledWith({
        telefono: undefined,
        skip: 200,
        limit: 100,
      });
    });
  });

  describe("asignarPublicaciones", () => {
    test("lanza 404 si el usuario destino no existe", async () => {
      usuariosRepository.findById.mockResolvedValue(null);

      const err = await reclamosService
        .asignarPublicaciones({ usuarioViejoId: "cluster-1", usuarioNuevoId: "no-existe" })
        .catch((e) => e);

      expect(err).toBeInstanceOf(AppError);
      expect(err.statusCode).toBe(404);
    });

    test("reasigna todas las publicaciones de un cluster completo", async () => {
      usuariosRepository.findById.mockResolvedValue({ _id: "usuario-nuevo-1" });
      publicacionesRepository.findByUsuarioId.mockResolvedValue([{ _id: "pub-1" }, { _id: "pub-2" }]);
      publicacionesRepository.findByIdAndUpdate.mockResolvedValue({});
      const save = jest.fn().mockResolvedValue({});
      historialReclamosRepository.create.mockReturnValue({ save });
      historialReclamosRepository.save.mockImplementation((h) => h.save());

      const result = await reclamosService.asignarPublicaciones({
        usuarioViejoId: "cluster-1",
        usuarioNuevoId: "usuario-nuevo-1",
        adminId: "admin-1",
      });

      expect(publicacionesRepository.findByIdAndUpdate).toHaveBeenCalledTimes(2);
      expect(publicacionesRepository.findByIdAndUpdate).toHaveBeenCalledWith("pub-1", {
        usuario: "usuario-nuevo-1",
      });
      expect(historialReclamosRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ usuarioViejoId: "cluster-1", usuarioNuevo: "usuario-nuevo-1" }),
      );
      expect(result.publicacionesReasignadas).toBe(2);
    });

    test("reasigna solo la lista puntual de publicaciones cuando no viene un cluster completo", async () => {
      usuariosRepository.findById.mockResolvedValue({ _id: "usuario-nuevo-1" });
      publicacionesRepository.findByIdAndUpdate.mockResolvedValue({});
      const save = jest.fn().mockResolvedValue({});
      historialReclamosRepository.create.mockReturnValue({ save });
      historialReclamosRepository.save.mockImplementation((h) => h.save());

      const result = await reclamosService.asignarPublicaciones({
        publicaciones: ["pub-a"],
        usuarioNuevoId: "usuario-nuevo-1",
        adminId: "admin-1",
      });

      expect(publicacionesRepository.findByUsuarioId).not.toHaveBeenCalled();
      expect(publicacionesRepository.findByIdAndUpdate).toHaveBeenCalledTimes(1);
      expect(result.publicacionesReasignadas).toBe(1);
    });

    test("lanza 400 si el cluster no tiene publicaciones para reasignar", async () => {
      usuariosRepository.findById.mockResolvedValue({ _id: "usuario-nuevo-1" });
      publicacionesRepository.findByUsuarioId.mockResolvedValue([]);

      const err = await reclamosService
        .asignarPublicaciones({ usuarioViejoId: "cluster-vacio", usuarioNuevoId: "usuario-nuevo-1" })
        .catch((e) => e);

      expect(err).toBeInstanceOf(AppError);
      expect(err.statusCode).toBe(400);
    });
  });
});
