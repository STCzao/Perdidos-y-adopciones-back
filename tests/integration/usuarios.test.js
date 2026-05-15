jest.mock("../../helpers/logger", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));

const db = require("../setup/db");
const { createUser, createAdmin } = require("../setup/factories");
const bcryptjs = require("bcryptjs");
const Usuario = require("../../models/usuario");
const usuarioService = require("../../service/usuarios");

describe("service/usuarios - integracion", () => {
  beforeAll(async () => await db.connect());
  afterAll(async () => await db.disconnect());
  afterEach(async () => await db.clearCollections());

  describe("crearUsuario", () => {
    test("crea el usuario con rol USER_ROLE aunque se envie otro rol", async () => {
      const result = await usuarioService.crearUsuario({
        nombre: "Juan Perez",
        correo: "juan@test.com",
        password: "pass12345",
        telefono: "3812345678",
        rol: "ADMIN_ROLE",
        ip: "::1",
      });
      expect(result.usuario.rol).toBe("USER_ROLE");
    });

    test("hashea la contraseña y normaliza el correo", async () => {
      const result = await usuarioService.crearUsuario({
        nombre: "Juan",
        correo: "JUAN@TEST.COM",
        password: "plainPassword",
        telefono: "3812345678",
        ip: "::1",
      });
      expect(result.usuario.password).not.toBe("plainPassword");
      const inDB = await Usuario.findOne({ correo: "juan@test.com" }).select("+password");
      expect(bcryptjs.compareSync("plainPassword", inDB.password)).toBe(true);
    });
  });

  describe("cambiarEstado", () => {
    test("no permite cambiar el estado de un ADMIN_ROLE", async () => {
      const admin = await createAdmin();
      const operador = await createAdmin();
      await expect(
        usuarioService.cambiarEstado({
          id: admin._id.toString(),
          estado: false,
          usuarioActual: operador,
          ip: "::1",
        }),
      ).rejects.toMatchObject({ statusCode: 403 });
    });

    test("deshabilitar usuario limpia sus refreshTokens en DB", async () => {
      const user = await createUser();
      await Usuario.findByIdAndUpdate(user._id, {
        refreshTokens: [{ token: "rt", device: "D", ip: "::1" }],
      });

      const admin = await createAdmin();
      await usuarioService.cambiarEstado({
        id: user._id.toString(),
        estado: false,
        usuarioActual: admin,
        ip: "::1",
      });

      const updated = await Usuario.findById(user._id);
      expect(updated.estado).toBe(false);
      expect(updated.refreshTokens).toHaveLength(0);
    });
  });

  describe("getUsuariosAdmin", () => {
    test("ordena por fechaCreacion descendente y permite filtrar", async () => {
      await createUser({
        nombre: "Ana",
        correo: "ana@test.com",
        fechaCreacion: new Date("2026-01-01"),
      });
      await createUser({
        nombre: "Beto",
        correo: "beto@test.com",
        rol: "MODERADOR_ROLE",
        fechaCreacion: new Date("2026-02-01"),
      });

      const result = await usuarioService.getUsuariosAdmin({
        sortBy: "fechaCreacion",
        sortOrder: "desc",
        rol: "MODERADOR_ROLE",
      });

      expect(result.total).toBe(1);
      expect(result.usuarios[0].rol).toBe("MODERADOR_ROLE");
    });
  });

  describe("cambiarRolUsuario", () => {
    test("permite que un admin promueva a moderador", async () => {
      const admin = await createAdmin();
      const user = await createUser();

      await usuarioService.cambiarRolUsuario({
        id: user._id.toString(),
        rol: "MODERADOR_ROLE",
        usuarioActual: admin,
        ip: "::1",
      });

      const updated = await Usuario.findById(user._id);
      expect(updated.rol).toBe("MODERADOR_ROLE");
    });
  });

  describe("actualizarMiPerfil", () => {
    test("actualiza el nombre y la imagen del usuario en DB", async () => {
      const user = await createUser();
      await usuarioService.actualizarMiPerfil({
        userId: user._id.toString(),
        datos: {
          nombre: "Nombre Actualizado",
          img: "https://res.cloudinary.com/demo/image/upload/perfil.jpg",
        },
        ip: "::1",
      });
      const updated = await Usuario.findById(user._id);
      expect(updated.nombre).toBe("Nombre Actualizado");
      expect(updated.img).toBe("https://res.cloudinary.com/demo/image/upload/perfil.jpg");
    });

    test("retorna resumen de seguridad en mi perfil", async () => {
      const user = await createUser({
        refreshTokens: [{ token: "rt", device: "Chrome", ip: "181.20.1.10" }],
      });
      const result = await usuarioService.getMiPerfil({ userId: user._id.toString() });
      expect(result.usuario.correo).toBe(user.correo);
      expect(result.seguridad.sesionesActivas).toBe(1);
    });
  });

  describe("cambiarPasswordMiPerfil", () => {
    test("cambia la contraseña y limpia refreshTokens", async () => {
      const user = await createUser({
        rawPassword: "Vieja123",
        refreshTokens: [{ token: "rt", device: "Chrome", ip: "::1" }],
      });

      await usuarioService.cambiarPasswordMiPerfil({
        userId: user._id.toString(),
        correo: user.correo,
        currentPassword: "Vieja123",
        newPassword: "Nueva123",
        ip: "::1",
      });

      const updated = await Usuario.findById(user._id).select("+password");
      expect(updated.refreshTokens).toHaveLength(0);
      expect(bcryptjs.compareSync("Nueva123", updated.password)).toBe(true);
    });
  });
});
