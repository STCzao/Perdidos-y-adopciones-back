jest.mock("../../helpers/enviar-mails", () => ({ enviarEmail: jest.fn().mockResolvedValue(undefined) }));
jest.mock("../../helpers/logger", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));

const request = require("supertest");
const db = require("../setup/db");
const createApp = require("../setup/testApp");
const { createAdmin } = require("../setup/factories");

let app;

const loginAs = async (correo, password = "password123") => {
  const res = await request(app).post("/api/auth/login").send({ correo, password });
  return res.body.accessToken;
};

const COLABORADOR_VALIDO = {
  nombre: "Ana Perez",
  telefono: "3812345678",
  email: "ana@test.com",
  localidad: "SAN MIGUEL DE TUCUMAN",
  barrio: "Centro",
  direccionReferencia: "Frente a la plaza",
  formasColaboracion: ["TRANSITO", "DIFUSION"],
  detalleTransito: { opciones: ["PERROS"], observaciones: "Lugar para uno" },
  detalleDifusion: { opciones: ["INSTAGRAM"] },
  disponibilidadGeneral: "URGENCIAS",
  momentosDisponibilidad: ["TARDE", "NOCHE"],
  aceptaContactoWhatsapp: true,
  quiereGruposWhatsapp: true,
  prefiereContactoIndividual: false,
  observacionesFinales: "Disponible esta semana",
  aceptaTerminos: true,
};

describe("E2E: /api/colaboradores", () => {
  beforeAll(async () => {
    await db.connect();
    app = createApp();
  });

  afterAll(async () => await db.disconnect());
  afterEach(async () => await db.clearCollections());

  test("POST /api/colaboradores registra un colaborador", async () => {
    const res = await request(app).post("/api/colaboradores").send(COLABORADOR_VALIDO);

    expect(res.status).toBe(201);
    expect(res.body.colaborador).toBeDefined();
    expect(res.body.colaborador.nombre).toBe("Ana Perez");
  });

  test("GET /api/colaboradores requiere admin", async () => {
    const res = await request(app).get("/api/colaboradores");
    expect(res.status).toBe(401);
  });

  test("GET /api/colaboradores devuelve listado para admin", async () => {
    await request(app).post("/api/colaboradores").send(COLABORADOR_VALIDO);
    await createAdmin({ correo: "admin-col@test.com", rawPassword: "password123" });
    const token = await loginAs("admin-col@test.com");

    const res = await request(app)
      .get("/api/colaboradores")
      .set("x-token", token);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(Array.isArray(res.body.colaboradores)).toBe(true);
  });
});
