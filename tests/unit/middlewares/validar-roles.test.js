const { esAdminRole, esModeradorOAdmin, tieneRole } = require("../../../middlewares/validar-roles");

const buildRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe("esAdminRole", () => {
  test("llama next() cuando el rol es ADMIN_ROLE", () => {
    const req = { usuario: { rol: "ADMIN_ROLE", nombre: "Admin" } };
    const next = jest.fn();
    esAdminRole(req, buildRes(), next);
    expect(next).toHaveBeenCalledWith();
  });

  test("responde 403 cuando el rol es USER_ROLE", () => {
    const req = { usuario: { rol: "USER_ROLE", nombre: "Juan" } };
    const res = buildRes();
    const next = jest.fn();
    esAdminRole(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json.mock.calls[0][0].success).toBe(false);
  });

  test("responde 500 si req.usuario no está definido", () => {
    const req = {};
    const res = buildRes();
    esAdminRole(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe("tieneRole", () => {
  test("permite acceso cuando el usuario tiene uno de los roles requeridos", () => {
    const req = { usuario: { rol: "ADMIN_ROLE", nombre: "Admin" } };
    const next = jest.fn();
    tieneRole("ADMIN_ROLE", "USER_ROLE")(req, buildRes(), next);
    expect(next).toHaveBeenCalledWith();
  });

  test("deniega cuando el usuario no tiene ninguno de los roles requeridos", () => {
    const req = { usuario: { rol: "USER_ROLE", nombre: "Juan" } };
    const res = buildRes();
    tieneRole("ADMIN_ROLE")(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(403);
  });

  test("responde 500 si req.usuario no está definido", () => {
    const req = {};
    const res = buildRes();
    tieneRole("ADMIN_ROLE")(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe("esModeradorOAdmin", () => {
  test("permite acceso cuando el usuario es moderador", () => {
    const req = { usuario: { rol: "MODERADOR_ROLE", nombre: "Mod" } };
    const next = jest.fn();
    esModeradorOAdmin(req, buildRes(), next);
    expect(next).toHaveBeenCalledWith();
  });

  test("deniega cuando el usuario no es admin ni moderador", () => {
    const req = { usuario: { rol: "USER_ROLE", nombre: "Juan" } };
    const res = buildRes();
    esModeradorOAdmin(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(403);
  });
});
