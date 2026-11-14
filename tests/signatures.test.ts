import { createHash, createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { signedEmbedUrl, signUpload, trailerUrls, verifyBunnyWebhook } from "@/lib/bunny";
import { verifyWebhookSignature } from "@/lib/payments/mercadopago";
import { safeNext, signSession, verifySession } from "@/lib/session";

const sha = (s: string) => createHash("sha256").update(s).digest("hex");

describe("Mercado Pago: firma del webhook", () => {
  const secret = "mp-secret";
  const sign = (manifest: string) => createHmac("sha256", secret).update(manifest).digest("hex");

  it("acepta una firma válida", () => {
    const v1 = sign("id:123456;request-id:req-1;ts:1700000000;");
    expect(
      verifyWebhookSignature({ signatureHeader: `ts=1700000000,v1=${v1}`, requestId: "req-1", dataId: "123456", secret }),
    ).toBe(true);
  });

  it("pasa el id a minúsculas si es alfanumérico", () => {
    const v1 = sign("id:abc123;request-id:req-1;ts:1;");
    expect(verifyWebhookSignature({ signatureHeader: `ts=1,v1=${v1}`, requestId: "req-1", dataId: "ABC123", secret })).toBe(true);
  });

  it("rechaza firma alterada, otro pago, otro secreto o header ausente", () => {
    const v1 = sign("id:123456;request-id:req-1;ts:1700000000;");
    const base = { signatureHeader: `ts=1700000000,v1=${v1}`, requestId: "req-1", dataId: "123456", secret };
    expect(verifyWebhookSignature({ ...base, dataId: "999" })).toBe(false);
    expect(verifyWebhookSignature({ ...base, secret: "otro" })).toBe(false);
    expect(verifyWebhookSignature({ ...base, signatureHeader: `ts=1700000000,v1=${"0".repeat(64)}` })).toBe(false);
    expect(verifyWebhookSignature({ ...base, signatureHeader: null })).toBe(false);
    expect(verifyWebhookSignature({ ...base, signatureHeader: "basura" })).toBe(false);
  });
});

describe("Bunny", () => {
  const saved = { ...process.env };
  beforeEach(() => {
    process.env.BUNNY_LIBRARY_ID = "759";
    process.env.BUNNY_API_KEY = "api-key";
    process.env.BUNNY_TOKEN_AUTH_KEY = "token-key";
    process.env.BUNNY_TRAILER_CDN_HOST = "vz-demo.b-cdn.net";
  });
  afterEach(() => {
    process.env = { ...saved };
  });

  it("firma la URL del reproductor: SHA256(token_key + video_id + expires)", () => {
    const url = new URL(signedEmbedUrl("vid-1", 3600, 1_700_000_000));
    expect(url.origin + url.pathname).toBe("https://player.mediadelivery.net/embed/759/vid-1");
    expect(url.searchParams.get("expires")).toBe("1700003600");
    expect(url.searchParams.get("token")).toBe(sha("token-keyvid-11700003600"));
  });

  it("la firma cambia con el video y con el vencimiento", () => {
    const a = signedEmbedUrl("vid-1", 3600, 1_700_000_000);
    expect(signedEmbedUrl("vid-2", 3600, 1_700_000_000)).not.toBe(a);
    expect(signedEmbedUrl("vid-1", 3601, 1_700_000_000)).not.toBe(a);
  });

  it("firma la subida: SHA256(library_id + api_key + expiration + video_id)", () => {
    const t = signUpload("full", "vid-1", 1_700_000_000);
    const expire = String(1_700_000_000 + 6 * 3600);
    expect(t.headers.AuthorizationExpire).toBe(expire);
    expect(t.headers.AuthorizationSignature).toBe(sha(`759api-key${expire}vid-1`));
    expect(t.headers.LibraryId).toBe("759");
    expect(t.headers.VideoId).toBe("vid-1");
    expect(JSON.stringify(t)).not.toContain("api-key");
  });

  it("valida la firma del webhook sobre el cuerpo crudo", () => {
    const body = '{"VideoLibraryId":759,"VideoGuid":"g","Status":3}';
    const sig = createHmac("sha256", "ro-key").update(body).digest("hex");
    expect(verifyBunnyWebhook(body, sig, "ro-key")).toBe(true);
    expect(verifyBunnyWebhook(body + " ", sig, "ro-key")).toBe(false);
    expect(verifyBunnyWebhook(body, null, "ro-key")).toBe(false);
  });

  it("elige el mejor MP4 disponible para el tráiler", () => {
    expect(trailerUrls("v", { availableResolutions: "240p,360p,720p,1080p", hasMP4Fallback: true }).mp4).toBe(
      "https://vz-demo.b-cdn.net/v/play_720p.mp4",
    );
    expect(trailerUrls("v", { availableResolutions: "240p,360p", hasMP4Fallback: true }).mp4).toBe(
      "https://vz-demo.b-cdn.net/v/play_360p.mp4",
    );
    expect(trailerUrls("v", { availableResolutions: "720p", hasMP4Fallback: false }).mp4).toBeNull();
    expect(trailerUrls("v", { availableResolutions: null }).cover).toBe("https://vz-demo.b-cdn.net/v/thumbnail.jpg");
  });
});

describe("Sesión", () => {
  beforeEach(() => {
    process.env.SESSION_SECRET = "s3cr3t";
  });

  it("firma y verifica", () => {
    expect(verifySession(signSession("Ana@Mail.com"))).toBe("ana@mail.com");
  });

  it("rechaza cookies alteradas, vencidas o firmadas con otro secreto", () => {
    const c = signSession("ana@mail.com", 0);
    expect(verifySession(c, 61 * 86400_000)).toBeNull();
    const [payload, sig] = signSession("ana@mail.com").split(".");
    const forged = Buffer.from(JSON.stringify({ e: "admin@mail.com", x: Date.now() + 1e9 })).toString("base64url");
    expect(verifySession(`${forged}.${sig}`)).toBeNull();
    expect(verifySession(`${payload}.xxxx`)).toBeNull();
    expect(verifySession(undefined)).toBeNull();
    process.env.SESSION_SECRET = "otro";
    expect(verifySession(`${payload}.${sig}`)).toBeNull();
  });

  it("solo redirige a rutas internas", () => {
    expect(safeNext("/ver/x")).toBe("/ver/x");
    expect(safeNext("https://malo.com")).toBe("/biblioteca");
    expect(safeNext("//malo.com")).toBe("/biblioteca");
    expect(safeNext("/\\malo.com")).toBe("/biblioteca");
    expect(safeNext(undefined)).toBe("/biblioteca");
  });
});
