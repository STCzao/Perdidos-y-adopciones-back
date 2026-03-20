jest.mock("../../helpers/logger", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }));

const db = require("../setup/db");
const { createUser, createAdmin } = require("../setup/factories");
const bcryptjs = require("bcryptjs");
const Usuario = require("../../models/usuario");
const usuarioService = require("../../service/usuarios");

describe("service/usuarios — integración", () => {
  beforeAll(async () => await db.connect());
  afterAll(async () => await db.disconnect());
  afterEach(async () => await db.clearCollections());

  // ─── crearUsuario ────────────────────────────────────────────────────────────
  describe("crearUsuario", () => {
    test("crea el usuario con rol USER_ROLE aunque se envíe otro rol", async () => {
      const result = await usuarioService.crearUsuario({
        nombre: "Juan Perez",
        correo: "juan@test.com",
        password: "pass123",
        telefono: "3812345678",
        rol: "ADMIN_ROLE", // intento de escalada
        ip: "::1",
      });
      expect(result.usuario.rol).toBe("USER_ROLE");
    });

    test("hashea la contraseña — no guarda texto plano", async () => {
      const result = await usuarioService.crearUsuario({
        nombre: "Juan",
        correo: "juan@test.com",
        password: "plainPassword",
        telefono: "3812345678",
        ip: "::1",
      });
      expect(result.usuario.password).not.toBe("plainPassword");
      const inDB = await Usuario.findOne({ correo: "juan@test.com" }).select("+password");
      expect(bcryptjs.compareSync("plainPassword", inDB.password)).toBe(true);
    });

    test("persiste el usuario en MongoDB", async () => {
      await usuarioService.crearUsuario({
        nombre: "Maria Lopez",
        correo: "maria@test.com",
        password: "pass123",
        telefono: "3812345678",
        ip: "::1",
      });
      const count = await Usuario.countDocuments({ correo: "maria@test.com" });
      expect(count).toBe(1);
    });
  });

  // ─── getUsuarios ─────────────────────────────────────────────────────────────
  describe("getUsuarios", () => {
    test("retorna todos los usuarios con paginación", async () => {
      await createUser();
      await createUser();
      const result = await usuarioService.getUsuarios({ page: 1, limit: 20 });
      expect(result.total).toBe(2);
      expect(result.usuarios).toHaveLength(2);
      expect(result.page).toBe(1);
      expect(result.totalPages).toBe(1);
    });

    test("aplica paginación correctamente", async () => {
      await createUser();
      await createUser();
      await createUser();
      const result = await usuarioService.getUsuarios({ page: 2, limit: 2 });
      expect(result.page).toBe(2);
      expect(result.totalPages).toBe(2);
      expect(result.usuarios).toHaveLength(1);
    });

    test("no retorna el campo password en el resultado", async () => {
      await createUser();
      const result = await usuarioService.getUsuarios({});
      result.usuarios.forEach((u) => {
        expect(u.password).toBeUndefined();
      });
    });
  });

  // ─── cambiarEstado ──────────────────────────────────────────────────────────
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
        })
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

  // ─── eliminarUsuario ─────────────────────────────────────────────────────────
  describe("eliminarUsuario", () => {
    test("soft delete — el usuario queda con estado:false en DB", async () => {
      const user = await createUser();
      const admin = await createAdmin();
      await usuarioService.eliminarUsuario({
        id: user._id.toString(),
        usuarioActual: admin,
        ip: "::1",
      });
      const inDB = await Usuario.findById(user._id);
      expect(inDB.estado).toBe(false);
    });

    test("auto-eliminación retorna logout:true", async () => {
      const user = await createUser();
      const result = await usuarioService.eliminarUsuario({
        id: user._id.toString(),
        usuarioActual: user,
        ip: "::1",
      });
      expect(result.logout).toBe(true);
    });
  });

  // ─── actualizarMiPerfil ──────────────────────────────────────────────────────
  describe("actualizarMiPerfil", () => {
    test("actualiza el nombre del usuario en DB", async () => {
      const user = await createUser();
      await usuarioService.actualizarMiPerfil({
        userId: user._id.toString(),
        datos: { nombre: "Nombre Actualizado" },
      });
      const updated = await Usuario.findById(user._id);
      expect(updated.nombre).toBe("Nombre Actualizado");
    });

    test("no modifica la contraseña", async () => {
      const user = await createUser();
      const originalHash = (await Usuario.findById(user._id).select("+password")).password;

      await expect(
        usuarioService.actualizarMiPerfil({
          userId: user._id.toString(),
          datos: { password: "hackeado123" },
        })
      ).rejects.toMatchObject({ statusCode: 400 });

      const unchanged = (await Usuario.findById(user._id).select("+password")).password;
      expect(unchanged).toBe(originalHash);
    });
  });
});
