import crypto from "crypto";
import { isAddress, verifyMessage } from "viem";

export type TelegramAuthPayload = {
  id: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  authDate: number;
};

export type SessionPayload = {
  tgId: string;
  iat: number;
  exp: number;
};

function base64url(input: Buffer | string) {
  return Buffer.from(input).toString("base64url");
}

function hmacSha256(key: crypto.BinaryLike | crypto.KeyObject, value: string) {
  return crypto.createHmac("sha256", key).update(value).digest();
}

export function normalizeWalletAddress(walletAddress: string) {
  return walletAddress.toLowerCase();
}

export function assertWalletAddress(walletAddress: string): `0x${string}` {
  if (!isAddress(walletAddress)) throw new Error("Invalid wallet address");
  return normalizeWalletAddress(walletAddress) as `0x${string}`;
}

export function buildWalletBindingMessage(tgId: string, walletAddress: string) {
  return `Bind wallet ${normalizeWalletAddress(walletAddress)} to Telegram user ${tgId}`;
}

export function verifyTelegramInitData(initData: string, botToken: string, maxAgeSeconds = 86400): TelegramAuthPayload {
  if (!botToken) throw new Error("TELEGRAM_BOT_TOKEN is required");

  const params = new URLSearchParams(initData);
  const receivedHash = params.get("hash");
  const userJson = params.get("user");
  const authDateRaw = params.get("auth_date");

  if (!receivedHash || !userJson || !authDateRaw) {
    throw new Error("Invalid Telegram initData");
  }

  const dataCheckString = [...params.entries()]
    .filter(([key]) => key !== "hash")
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  const secretKey = hmacSha256("WebAppData", botToken);
  const calculatedHash = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

  const expected = Buffer.from(calculatedHash, "hex");
  const actual = Buffer.from(receivedHash, "hex");
  if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) {
    throw new Error("Telegram initData signature mismatch");
  }

  const authDate = Number(authDateRaw);
  if (!Number.isFinite(authDate)) throw new Error("Invalid Telegram auth_date");

  const ageSeconds = Math.floor(Date.now() / 1000) - authDate;
  if (ageSeconds > maxAgeSeconds) throw new Error("Telegram initData expired");

  const user = JSON.parse(userJson) as {
    id: number | string;
    username?: string;
    first_name?: string;
    last_name?: string;
  };

  return {
    id: String(user.id),
    username: user.username,
    firstName: user.first_name,
    lastName: user.last_name,
    authDate,
  };
}

export function signSessionToken(payload: { tgId: string }, secret: string, ttlSeconds = 86400) {
  if (!secret) throw new Error("JWT_SECRET is required");
  const now = Math.floor(Date.now() / 1000);
  const sessionPayload: SessionPayload = {
    tgId: payload.tgId,
    iat: now,
    exp: now + ttlSeconds,
  };
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = base64url(JSON.stringify(sessionPayload));
  const signature = crypto.createHmac("sha256", secret).update(`${header}.${body}`).digest("base64url");
  return `${header}.${body}.${signature}`;
}

export function verifySessionToken(token: string, secret: string): SessionPayload {
  if (!secret) throw new Error("JWT_SECRET is required");
  const [header, body, signature] = token.split(".");
  if (!header || !body || !signature) throw new Error("Invalid session token");

  const expected = crypto.createHmac("sha256", secret).update(`${header}.${body}`).digest("base64url");
  const actual = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (actual.length !== expectedBuffer.length || !crypto.timingSafeEqual(actual, expectedBuffer)) {
    throw new Error("Invalid session signature");
  }

  const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SessionPayload;
  if (!payload.exp || Math.floor(Date.now() / 1000) > payload.exp) {
    throw new Error("Session expired");
  }
  return payload;
}

export function getBearerSession(request: Request) {
  const authorization = request.headers.get("authorization") || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice("Bearer ".length) : "";
  return verifySessionToken(token, process.env.JWT_SECRET || "");
}

export function assertAdminSession(session: SessionPayload) {
  if (!process.env.ADMIN_TG_ID) throw new Error("ADMIN_TG_ID is required");
  if (session.tgId !== process.env.ADMIN_TG_ID) throw new Error("Admin privileges required");
}

export async function verifyWalletBindingSignature(params: {
  tgId: string;
  walletAddress: `0x${string}`;
  signature: `0x${string}`;
}) {
  return verifyMessage({
    address: params.walletAddress,
    message: buildWalletBindingMessage(params.tgId, params.walletAddress),
    signature: params.signature,
  });
}
