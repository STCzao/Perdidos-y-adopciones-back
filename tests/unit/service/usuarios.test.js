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
  img: "https://res.cloudinary.com/demo/image/upload/avatar.jpg",
  refreshTokens: [],
  resetToken: undefined,
  resetTokenExp: undefined,
  save: jest.fn().mockResolvedValue(undefined),
  toJSON: jest.fn(function toJSON() {
    const { password, resetToken, resetTokenExp, refreshTokens, _id, ...resto } = this;
    return { ...resto, uid: _id };
  }),
  ...overrides,
});

describe("service/usuarios", () => {
  beforeEach(() => jest.clearAllMocks());

  describe("getUsuarios", () => {
    test("retorna usuarios con total y paginacion", async () => {
      const mockUsers = [makeMockUser(), makeMockUser()];
      Usuario.countDocuments.mockResolvedValue(2);
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

    test("limita el maximo a 100 por pagina", async () => {
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

  describe("getUsuariosAdmin", () => {
    test("aplica ordenamiento y filtros de admin", async () => {
      const mockUsers = [makeMockUser()];
      Usuario.countDocuments.mockResolvedValue(1);
      const chainMock = {
        select: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue(mockUsers),
      };
      Usuario.find.mockReturnValue(chainMock);

      const result = await usuarioService.getUsuariosAdmin({
        sortBy: "fechaCreacion",
        sortOrder: "desc",
        search: "test",
        rol: "USER_ROLE",
        estado: "true",
      });

      expect(result.total).toBe(1);
      expect(chainMock.sort).toHaveBeenCalledWith({ fechaCreacion: -1 });
      expect(Usuario.countDocuments.mock.calls[0][0]).toMatchObject({
        rol: "USER_ROLE",
        estado: true,
      });
    });
  });

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
        correo: "JUAN@TEST.COM",
        password: "pass123",
        telefono: "3812345678",
        rol: "ADMIN_ROLE",
        ip: "::1",
      });

      expect(savedData.rol).toBe("USER_ROLE");
      expect(savedData.correo).toBe("juan@test.com");
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
      const err = await usuarioService
        .actualizarUsuario({
          id: "uid-123",
          datos: { password: "nuevaPass" },
          usuarioActual: admin,
        })
        .catch((e) => e);

      expect(err).toBeInstanceOf(AppError);
      expect(err.statusCode).toBe(400);
      expect(err.errors?.password).toBeDefined();
      expect(Usuario.findByIdAndUpdate).not.toHaveBeenCalled();
    });
  });

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
  });

  describe("cambiarRolUsuario", () => {
    test("no permite cambiar el propio rol del admin", async () => {
      const admin = makeMockUser({ _id: "admin-id", rol: "ADMIN_ROLE" });
      const err = await usuarioService
        .cambiarRolUsuario({
          id: "admin-id",
          rol: "MODERADOR_ROLE",
          usuarioActual: admin,
          ip: "::1",
        })
        .catch((e) => e);

      expect(err.statusCode).toBe(403);
    });

    test("actualiza el rol de un usuario comun", async () => {
      const target = makeMockUser({ rol: "USER_ROLE" });
      Usuario.findById.mockResolvedValue(target);

      const result = await usuarioService.cambiarRolUsuario({
        id: "uid-456",
        rol: "MODERADOR_ROLE",
        usuarioActual: makeMockUser({ rol: "ADMIN_ROLE", correo: "admin@test.com" }),
        ip: "::1",
      });

      expect(result.usuario.rol).toBe("MODERADOR_ROLE");
      expect(target.save).toHaveBeenCalled();
    });
  });

  describe("eliminarUsuario", () => {
    test("lanza AppError(403) si no-admin intenta borrar otro usuario", async () => {
      const usuarioActual = makeMockUser({ _id: "uid-abc" });
      const err = await usuarioService
        .eliminarUsuario({ id: "uid-xyz", usuarioActual, ip: "::1" })
        .catch((e) => e);
      expect(err.statusCode).toBe(403);
    });

    test("auto-eliminacion retorna logout:true", async () => {
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
  });

  describe("getMiPerfil", () => {
    test("retorna resumen de seguridad con sesiones activas", async () => {
      const mockUser = makeMockUser({
        refreshTokens: [
          { token: "t1", device: "Chrome", ip: "181.20.1.10", createdAt: new Date("2026-01-01") },
        ],
      });
      Usuario.findById.mockResolvedValue(mockUser);

      const result = await usuarioService.getMiPerfil({ userId: "uid" });

      expect(result.usuario.correo).toBe("test@test.com");
      expect(result.seguridad.sesionesActivas).toBe(1);
      expect(result.seguridad.sesiones[0].ip).toBe("181.20.*.*");
    });
  });

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

    test("lanza AppError(400) si telefono tiene letras", async () => {
      const err = await usuarioService
        .actualizarMiPerfil({ userId: "uid", datos: { telefono: "abc123" } })
        .catch((e) => e);
      expect(err.statusCode).toBe(400);
      expect(err.errors?.telefono).toBeDefined();
    });

    test("lanza AppError(400) si imagen no es de Cloudinary", async () => {
      const err = await usuarioService
        .actualizarMiPerfil({ userId: "uid", datos: { img: "https://otro.com/avatar.jpg" } })
        .catch((e) => e);
      expect(err.statusCode).toBe(400);
      expect(err.errors?.img).toBeDefined();
    });

    test("actualiza nombre e imagen y retorna perfil seguro", async () => {
      const updatedUser = makeMockUser({
        nombre: "Nuevo Nombre",
        img: "https://res.cloudinary.com/demo/image/upload/nueva.jpg",
        refreshTokens: [{ token: "t1", device: "Chrome", ip: "181.20.1.10" }],
      });
      Usuario.findByIdAndUpdate.mockResolvedValue(updatedUser);

      const result = await usuarioService.actualizarMiPerfil({
        userId: "uid",
        datos: {
          nombre: "Nuevo Nombre",
          img: "https://res.cloudinary.com/demo/image/upload/nueva.jpg",
        },
        ip: "::1",
      });

      expect(result.usuario).toBeDefined();
      expect(result.usuario.nombre).toBe("Nuevo Nombre");
      expect(result.seguridad.sesionesActivas).toBe(1);
    });
  });

  describe("cambiarPasswordMiPerfil", () => {
    test("falla si la contraseña actual es incorrecta", async () => {
      Usuario.findById.mockResolvedValue(makeMockUser());
      bcryptjs.compareSync.mockReturnValue(false);

      const err = await usuarioService
        .cambiarPasswordMiPerfil({
          userId: "uid",
          correo: "test@test.com",
          currentPassword: "mal",
          newPassword: "Nueva123",
          ip: "::1",
        })
        .catch((e) => e);

      expect(err.statusCode).toBe(400);
      expect(err.errors?.currentPassword).toBeDefined();
    });

    test("actualiza password e invalida sesiones persistidas", async () => {
      const mockUser = makeMockUser({
        refreshTokens: [{ token: "t1" }, { token: "t2" }],
        resetToken: "reset",
        resetTokenExp: new Date(Date.now() + 60000),
      });
      Usuario.findById.mockResolvedValue(mockUser);
      bcryptjs.compareSync
        .mockReturnValueOnce(true)
        .mockReturnValueOnce(false);
      bcryptjs.genSaltSync.mockReturnValue("salt");
      bcryptjs.hashSync.mockReturnValue("hashed-new");

      const result = await usuarioService.cambiarPasswordMiPerfil({
        userId: "uid",
        correo: "test@test.com",
        currentPassword: "Actual123",
        newPassword: "Nueva123",
        ip: "::1",
      });

      expect(mockUser.password).toBe("hashed-new");
      expect(mockUser.refreshTokens).toHaveLength(0);
      expect(mockUser.resetToken).toBeUndefined();
      expect(mockUser.save).toHaveBeenCalled();
      expect(result.msg).toMatch(/Contraseña actualizada/i);
    });
  });
});
