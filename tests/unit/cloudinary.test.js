jest.mock("../../helpers/logger", () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

const crypto = require("crypto");
const {
  assertValidCloudinaryFolder,
  buildCloudinarySignaturePayload,
} = require("../../controllers/cloudinary");

describe("controllers/cloudinary", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...originalEnv,
      CLOUDINARY_API_SECRET: "test-cloudinary-secret",
    };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  test("genera una firma SHA1 valida para carpeta y timestamp", () => {
    const carpeta = "publicaciones";
    const timestamp = 1234567890;
    const expectedParams = `folder=${carpeta}&timestamp=${timestamp}`;
    const expectedSignature = crypto
      .createHash("sha1")
      .update(`${expectedParams}${process.env.CLOUDINARY_API_SECRET}`)
      .digest("hex");

    const result = buildCloudinarySignaturePayload({ carpeta, timestamp });

    expect(result.paramsToSign).toBe(expectedParams);
    expect(result.signature).toBe(expectedSignature);
    expect(result.signature).toMatch(/^[a-f0-9]{40}$/);
  });

  test("lanza error cuando la carpeta no pertenece al whitelist", () => {
    expect(() => assertValidCloudinaryFolder("scripts")).toThrow(
      "Carpeta de Cloudinary no valida",
    );
  });

  test("acepta carpetas permitidas", () => {
    expect(() => assertValidCloudinaryFolder("publicaciones")).not.toThrow();
    expect(() => assertValidCloudinaryFolder("comunidad")).not.toThrow();
    expect(() => assertValidCloudinaryFolder("usuarios")).not.toThrow();
  });
});
