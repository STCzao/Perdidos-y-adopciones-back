jest.mock("../../../models/usuario");
jest.mock("bcryptjs");
jest.mock("../../../helpers/logger", () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

const usuarioService = require("../../../service/usuarios");
const Usuario = require("../../../models/usuario");
const bcryptjs = require("bcryptjs");
const AppError = require("../../../helpers/AppError");

const makeMockUser = (overrides = {}) => ({
  _id: "uid-123",
  id: "uid-123",
  nombre: "Test User",
  correo: "test@test.com",
  password: "hashed",
  estado: true,
  rol: "USER_ROLE",
  refreshTokens: [],
  save: jest.fn().mockResolvedValue(undefined),
  ...overrides,
});

describe("service/usuarios", () => {
  beforeEach(() => jest.clearAllMocks());

  // ─── getUsuarios ──────────────────────────────────────────────────────────
  describe("getUsuarios", () => {
    test("retorna usuarios con total y paginación", async () => {
      const mockUsers = [makeMockUser(), makeMockUser()];
      Usuario.countDocuments.mockResolvedValue(2);
      // Simula el chain .find().select().skip().limit()
      const chainMock = {
        select: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue(mockUsers),
      };
      Usuario.find.mockReturnValue(chainMock);

      const result = await usuarioService.getUsuarios({ page: 1, limit: 20 });
      expect(result.total).toBe(2);
      expect(result.usuarios).toHaveLength(2);
      expect(result.page).toBe(1);
      expect(result.totalPages).toBe(1);
    });

    test("limita el máximo a 100 por página", async () => {
      Usuario.countDocuments.mockResolvedValue(0);
      const chainMock = {
        select: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([]),
      };
      Usuario.find.mockReturnValue(chainMock);

      await usuarioService.getUsuarios({ page: 1, limit: 9999 });
      expect(chainMock.limit).toHaveBeenCalledWith(100);
    });
  });

  // ─── crearUsuario ─────────────────────────────────────────────────────────
  describe("crearUsuario", () => {
    test("fuerza rol USER_ROLE independientemente del input", async () => {
      let savedData;
      Usuario.mockImplementation((data) => {
        savedData = data;
        return { ...data, save: jest.fn().mockResolvedValue(undefined) };
      });
      bcryptjs.genSaltSync.mockReturnValue("salt");
      bcryptjs.hashSync.mockReturnValue("hashed");

      await usuarioService.crearUsuario({
        nombre: "Juan",
        correo: "juan@test.com",
        password: "pass123",
        telefono: "3812345678",
        rol: "ADMIN_ROLE", // intento de escalada de privilegios
        ip: "::1",
      });

      expect(savedData.rol).toBe("USER_ROLE");
    });

    test("hashea la contraseña antes de guardar", async () => {
      const mockSave = jest.fn().mockResolvedValue(undefined);
      const mockInstance = { password: "original", save: mockSave };
      Usuario.mockImplementation(() => mockInstance);
      bcryptjs.genSaltSync.mockReturnValue("salt");
      bcryptjs.hashSync.mockReturnValue("hashed-pass");

      await usuarioService.crearUsuario({
        nombre: "Juan",
        correo: "juan@test.com",
        password: "pass123",
        telefono: "3812345678",
        ip: "::1",
      });

      expect(bcryptjs.hashSync).toHaveBeenCalledWith("pass123", "salt");
    });
  });

  // ─── actualizarUsuario ────────────────────────────────────────────────────
  describe("actualizarUsuario", () => {
    test("lanza AppError(403) si usuario no-admin intenta modificar otro usuario", async () => {
      const actualizante = makeMockUser({ _id: "uid-abc", rol: "USER_ROLE" });
      const err = await usuarioService
        .actualizarUsuario({ id: "uid-xyz", datos: {}, usuarioActual: actualizante })
        .catch((e) => e);
      expect(err).toBeInstanceOf(AppError);
      expect(err.statusCode).toBe(403);
    });

    test("lanza AppError(404) si el usuario no existe", async () => {
      const admin = makeMockUser({ rol: "ADMIN_ROLE" });
      Usuario.findByIdAndUpdate.mockReturnValue({
        select: jest.fn().mockResolvedValue(null),
      });
      const err = await usuarioService
        .actualizarUsuario({ id: "uid-xyz", datos: { nombre: "Nuevo" }, usuarioActual: admin })
        .catch((e) => e);
      expect(err.statusCode).toBe(404);
    });

    test("hashea la contraseña cuando se incluye en los datos", async () => {
      const admin = makeMockUser({ _id: "uid-123", rol: "ADMIN_ROLE" });
      const updatedUser = makeMockUser({ nombre: "Nuevo" });
      Usuario.findByIdAndUpdate.mockReturnValue({
        select: jest.fn().mockResolvedValue(updatedUser),
      });
      bcryptjs.genSaltSync.mockReturnValue("salt");
      bcryptjs.hashSync.mockReturnValue("hashed-new");

      await usuarioService.actualizarUsuario({
        id: "uid-123",
        datos: { password: "nuevaPass" },
        usuarioActual: admin,
      });

      expect(bcryptjs.hashSync).toHaveBeenCalledWith("nuevaPass", "salt");
    });
  });

  // ─── cambiarEstado ────────────────────────────────────────────────────────
  describe("cambiarEstado", () => {
    test("lanza AppError(404) si el usuario no existe", async () => {
      Usuario.findById.mockResolvedValue(null);
      const err = await usuarioService
        .cambiarEstado({ id: "uid", estado: false, usuarioActual: makeMockUser(), ip: "::1" })
        .catch((e) => e);
      expect(err.statusCode).toBe(404);
    });

    test("lanza AppError(403) al intentar cambiar estado de un ADMIN_ROLE", async () => {
      Usuario.findById.mockResolvedValue(makeMockUser({ rol: "ADMIN_ROLE" }));
      const err = await usuarioService
        .cambiarEstado({ id: "uid", estado: false, usuarioActual: makeMockUser(), ip: "::1" })
        .catch((e) => e);
      expect(err.statusCode).toBe(403);
    });

    test("limpia refreshTokens al deshabilitar usuario", async () => {
      const mockUser = makeMockUser({
        refreshTokens: [{ token: "t1" }, { token: "t2" }],
      });
      Usuario.findById.mockResolvedValue(mockUser);

      await usuarioService.cambiarEstado({
        id: "uid-123",
        estado: false,
        usuarioActual: makeMockUser({ rol: "ADMIN_ROLE" }),
        ip: "::1",
      });

      expect(mockUser.estado).toBe(false);
      expect(mockUser.refreshTokens).toHaveLength(0);
      expect(mockUser.save).toHaveBeenCalled();
    });

    test("NO limpia refreshTokens al habilitar usuario", async () => {
      const mockUser = makeMockUser({
        estado: false,
        refreshTokens: [{ token: "t1" }],
      });
      Usuario.findById.mockResolvedValue(mockUser);

      await usuarioService.cambiarEstado({
        id: "uid-123",
        estado: true,
        usuarioActual: makeMockUser({ rol: "ADMIN_ROLE" }),
        ip: "::1",
      });

      expect(mockUser.refreshTokens).toHaveLength(1);
    });
  });

  // ─── eliminarUsuario ──────────────────────────────────────────────────────
  describe("eliminarUsuario", () => {
    test("lanza AppError(403) si no-admin intenta borrar otro usuario", async () => {
      const usuarioActual = makeMockUser({ _id: "uid-abc" });
      const err = await usuarioService
        .eliminarUsuario({ id: "uid-xyz", usuarioActual, ip: "::1" })
        .catch((e) => e);
      expect(err.statusCode).toBe(403);
    });

    test("auto-eliminación retorna logout:true", async () => {
      const usuarioActual = makeMockUser({ _id: "uid-self" });
      const deletedUser = makeMockUser({ _id: "uid-self", estado: false });
      Usuario.findByIdAndUpdate.mockResolvedValue(deletedUser);

      const result = await usuarioService.eliminarUsuario({
        id: "uid-self",
        usuarioActual,
        ip: "::1",
      });

      expect(result.logout).toBe(true);
    });

    test("admin eliminando otro usuario retorna logout:false", async () => {
      const admin = makeMockUser({ _id: "uid-admin", rol: "ADMIN_ROLE" });
      const deletedUser = makeMockUser({ _id: "uid-user", estado: false });
      Usuario.findByIdAndUpdate.mockResolvedValue(deletedUser);

      const result = await usuarioService.eliminarUsuario({
        id: "uid-user",
        usuarioActual: admin,
        ip: "::1",
      });

      expect(result.logout).toBe(false);
    });
  });

  // ─── actualizarMiPerfil ───────────────────────────────────────────────────
  describe("actualizarMiPerfil", () => {
    test("lanza AppError(400) si se intenta cambiar password", async () => {
      const err = await usuarioService
        .actualizarMiPerfil({ userId: "uid", datos: { password: "nueva" } })
        .catch((e) => e);
      expect(err.statusCode).toBe(400);
      expect(err.errors?.password).toBeDefined();
    });

    test("lanza AppError(400) si se intenta cambiar correo", async () => {
      const err = await usuarioService
        .actualizarMiPerfil({ userId: "uid", datos: { correo: "nuevo@test.com" } })
        .catch((e) => e);
      expect(err.statusCode).toBe(400);
    });

    test("lanza AppError(400) si se envían campos no permitidos", async () => {
      const err = await usuarioService
        .actualizarMiPerfil({ userId: "uid", datos: { estadoHacker: true, otroField: "x" } })
        .catch((e) => e);
      expect(err.statusCode).toBe(400);
    });

    test("lanza AppError(400) si nombre es muy corto", async () => {
      const err = await usuarioService
        .actualizarMiPerfil({ userId: "uid", datos: { nombre: "AB" } })
        .catch((e) => e);
      expect(err.statusCode).toBe(400);
      expect(err.errors?.nombre).toBeDefined();
    });

    test("lanza AppError(400) si teléfono tiene letras", async () => {
      const err = await usuarioService
        .actualizarMiPerfil({ userId: "uid", datos: { telefono: "abc123" } })
        .catch((e) => e);
      expect(err.statusCode).toBe(400);
      expect(err.errors?.telefono).toBeDefined();
    });

    test("lanza AppError(400) si no hay cambios válidos para guardar", async () => {
      const err = await usuarioService
        .actualizarMiPerfil({ userId: "uid", datos: { rol: "ADMIN_ROLE" } })
        .catch((e) => e);
      // rol se descarta, pero no hay campos válidos → AppError
      expect(err.statusCode).toBe(400);
    });

    test("actualiza nombre correctamente y retorna el usuario", async () => {
      const updatedUser = makeMockUser({ nombre: "NUEVO NOMBRE" });
      Usuario.findByIdAndUpdate.mockReturnValue({
        select: jest.fn().mockResolvedValue(updatedUser),
      });

      const result = await usuarioService.actualizarMiPerfil({
        userId: "uid",
        datos: { nombre: "Nuevo Nombre" },
      });

      expect(result.usuario).toBe(updatedUser);
      expect(result.msg).toBeDefined();
    });
  });
});
