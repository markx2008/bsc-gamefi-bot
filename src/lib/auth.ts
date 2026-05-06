import crypto from "crypto";
import { verifyMessage } from "viem";

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

export function signSessionToken(payload: SessionPayload, secret: string) {
  if (!secret) throw new Error("JWT_SECRET is required");
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = base64url(JSON.stringify(payload));
  const signature = crypto.createHmac("sha256", secret).update(`${header}.${body}`).digest("base64url");
  return `${header}.${body}.${signature}`;
}

export function verifySessionToken(token: string, secret: string): SessionPayload {
  if (!secret) throw new Error("JWT_SECRET is required");
  const [header, body, signature] = token.split(".");
  if (!header || !body || !signature) throw new Error("Invalid session token");

  const expected = crypto.createHmac("sha256", secret).update(`${header}.${body}`).digest("base64url");
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    throw new Error("Invalid session signature");
  }

  return JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SessionPayload;
}

export async function verifyWalletBindingSignature(params: {
  tgId: string;
  walletAddress: `0x${string}`;
  signature: `0x${string}`;
  message?: string;
}) {
  const message = params.message || buildWalletBindingMessage(params.tgId, params.walletAddress);
  return verifyMessage({
    address: params.walletAddress,
    message,
    signature: params.signature,
  });
}
