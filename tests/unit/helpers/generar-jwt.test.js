const jwt = require("jsonwebtoken");
const { generarAccessToken, generarRefreshToken } = require("../../../helpers/generar-jwt");

jest.mock("../../../helpers/logger", () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

describe("generarAccessToken", () => {
  test("genera un JWT válido con uid en el payload", async () => {
    const token = await generarAccessToken("user-id-123");
    expect(typeof token).toBe("string");
    const decoded = jwt.decode(token);
    expect(decoded.uid).toBe("user-id-123");
  });

  test("expira en aproximadamente 30 minutos", async () => {
    const token = await generarAccessToken("user-id-123");
    const decoded = jwt.decode(token);
    const now = Math.floor(Date.now() / 1000);
    const diffMinutes = (decoded.exp - now) / 60;
    expect(diffMinutes).toBeGreaterThan(29);
    expect(diffMinutes).toBeLessThanOrEqual(31);
  });

  test("rechaza con un Error (no string) cuando el secret falta", async () => {
    const originalKey = process.env.SECRETORPRIVATEKEY;
    delete process.env.SECRETORPRIVATEKEY;
    await expect(generarAccessToken("uid")).rejects.toBeInstanceOf(Error);
    process.env.SECRETORPRIVATEKEY = originalKey;
  });
});

describe("generarRefreshToken", () => {
  test("genera un JWT con type='refresh' en el payload", async () => {
    const token = await generarRefreshToken("user-id-456");
    const decoded = jwt.decode(token);
    expect(decoded.uid).toBe("user-id-456");
    expect(decoded.type).toBe("refresh");
  });

  test("expira en aproximadamente 30 días", async () => {
    const token = await generarRefreshToken("user-id-456");
    const decoded = jwt.decode(token);
    const now = Math.floor(Date.now() / 1000);
    const diffDays = (decoded.exp - now) / 86400;
    expect(diffDays).toBeGreaterThan(29);
    expect(diffDays).toBeLessThanOrEqual(31);
  });

  test("usa un secret diferente al del accessToken", async () => {
    const access = await generarAccessToken("uid");
    const refresh = await generarRefreshToken("uid");
    // Si usaran el mismo secret, verificar uno con el secret del otro funcionaría
    const decodeWithWrongSecret = () =>
      jwt.verify(refresh, process.env.SECRETORPRIVATEKEY);
    expect(decodeWithWrongSecret).toThrow();
  });

  test("rechaza con un Error cuando el secret falta", async () => {
    const originalKey = process.env.REFRESH_SECRET;
    delete process.env.REFRESH_SECRET;
    await expect(generarRefreshToken("uid")).rejects.toBeInstanceOf(Error);
    process.env.REFRESH_SECRET = originalKey;
  });
});
