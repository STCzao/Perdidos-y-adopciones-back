jest.mock("../../helpers/logger", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));

const mongoose = require("mongoose");
const db = require("../setup/db");
const { createUser, createPublicacion } = require("../setup/factories");
const Publicacion = require("../../models/publicacion");
const HistorialReclamo = require("../../models/historialReclamo");
const reclamosService = require("../../service/reclamos");

describe("service/reclamos — integración", () => {
  beforeAll(async () => await db.connect());
  afterAll(async () => await db.disconnect());
  afterEach(async () => await db.clearCollections());

  describe("buscarHuerfanos", () => {
    test("agrupa publicaciones huerfanas por usuario viejo y excluye las de usuarios existentes", async () => {
      const usuarioVivo = await createUser();
      const usuarioViejoDifusor = new mongoose.Types.ObjectId();
      const usuarioViejoDueño = new mongoose.Types.ObjectId();

      // Cuenta viva: no debe aparecer como huerfana
      await createPublicacion(usuarioVivo._id, { whatsapp: "3810000001" });

      // Difusor viejo: varias publicaciones con whatsapp de distintos dueños reales
      await createPublicacion(usuarioViejoDifusor, {
        whatsapp: "3811111111",
        localidad: "YERBA BUENA",
      });
      await createPublicacion(usuarioViejoDifusor, {
        whatsapp: "3812222222",
        localidad: "TAFI VIEJO",
      });

      // Dueño viejo: publico su propia mascota con su propio numero
      await createPublicacion(usuarioViejoDueño, { whatsapp: "3813333333" });

      const { clusters } = await reclamosService.buscarHuerfanos();

      expect(clusters).toHaveLength(2);
      const difusorCluster = clusters.find((c) => String(c.usuarioViejoId) === String(usuarioViejoDifusor));
      expect(difusorCluster.cantidad).toBe(2);
      expect(difusorCluster.localidades.sort()).toEqual(["TAFI VIEJO", "YERBA BUENA"]);
    });

    test("filtra por telefono buscando en el whatsapp de la publicacion", async () => {
      const usuarioViejoDueño = new mongoose.Types.ObjectId();
      await createPublicacion(usuarioViejoDueño, { whatsapp: "3819999999" });

      const { clusters } = await reclamosService.buscarHuerfanos({ telefono: "3819999999" });

      expect(clusters).toHaveLength(1);
      expect(clusters[0].cantidad).toBe(1);
    });

    test("pagina los clusters y devuelve total/totalPages correctamente", async () => {
      for (let i = 0; i < 5; i++) {
        await createPublicacion(new mongoose.Types.ObjectId(), { whatsapp: `381000000${i}` });
      }

      const primeraPagina = await reclamosService.buscarHuerfanos({ page: 1, limit: 2 });
      expect(primeraPagina.clusters).toHaveLength(2);
      expect(primeraPagina.total).toBe(5);
      expect(primeraPagina.totalPages).toBe(3);
      expect(primeraPagina.page).toBe(1);

      const segundaPagina = await reclamosService.buscarHuerfanos({ page: 2, limit: 2 });
      expect(segundaPagina.clusters).toHaveLength(2);

      const terceraPagina = await reclamosService.buscarHuerfanos({ page: 3, limit: 2 });
      expect(terceraPagina.clusters).toHaveLength(1);

      const idsPrimera = primeraPagina.clusters.map((c) => String(c.usuarioViejoId));
      const idsSegunda = segundaPagina.clusters.map((c) => String(c.usuarioViejoId));
      expect(idsPrimera.some((id) => idsSegunda.includes(id))).toBe(false);
    });
  });

  describe("detalleCluster", () => {
    test("devuelve todas las publicaciones de una cuenta vieja", async () => {
      const usuarioViejo = new mongoose.Types.ObjectId();
      await createPublicacion(usuarioViejo, { nombreanimal: "FIRULAIS" });
      await createPublicacion(usuarioViejo, { nombreanimal: "MICHI", tipo: "ENCONTRADO" });

      const { publicaciones } = await reclamosService.detalleCluster(usuarioViejo);

      expect(publicaciones).toHaveLength(2);
    });
  });

  describe("asignarPublicaciones", () => {
    test("reasigna un cluster completo al usuario nuevo y deja rastro en HistorialReclamo", async () => {
      const usuarioNuevo = await createUser();
      const usuarioViejo = new mongoose.Types.ObjectId();
      const pub1 = await createPublicacion(usuarioViejo, { whatsapp: "3815555555" });
      const pub2 = await createPublicacion(usuarioViejo, { whatsapp: "3816666666" });
      const admin = await createUser();

      await reclamosService.asignarPublicaciones({
        usuarioViejoId: usuarioViejo,
        usuarioNuevoId: usuarioNuevo._id,
        adminId: admin._id,
      });

      const p1Actualizada = await Publicacion.findById(pub1._id);
      const p2Actualizada = await Publicacion.findById(pub2._id);
      expect(String(p1Actualizada.usuario)).toBe(String(usuarioNuevo._id));
      expect(String(p2Actualizada.usuario)).toBe(String(usuarioNuevo._id));

      const historial = await HistorialReclamo.find();
      expect(historial).toHaveLength(1);
      expect(historial[0].publicaciones).toHaveLength(2);
      expect(String(historial[0].resueltoPor)).toBe(String(admin._id));
    });

    test("reasigna solo el subconjunto puntual de publicaciones pedido", async () => {
      const usuarioNuevo = await createUser();
      const usuarioViejo = new mongoose.Types.ObjectId();
      const pubConfirmada = await createPublicacion(usuarioViejo, { whatsapp: "3817777777" });
      const pubNoConfirmada = await createPublicacion(usuarioViejo, { whatsapp: "3818888888" });
      const admin = await createUser();

      await reclamosService.asignarPublicaciones({
        publicaciones: [pubConfirmada._id],
        usuarioNuevoId: usuarioNuevo._id,
        adminId: admin._id,
      });

      const confirmada = await Publicacion.findById(pubConfirmada._id);
      const noConfirmada = await Publicacion.findById(pubNoConfirmada._id);
      expect(String(confirmada.usuario)).toBe(String(usuarioNuevo._id));
      expect(String(noConfirmada.usuario)).toBe(String(usuarioViejo));
    });
  });
});
