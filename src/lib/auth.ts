import crypto from "crypto";
import { isAddress, verifyMessage } from "viem";

export type SessionPayload = {
  walletAddress: string;
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

export function buildWalletLoginMessage(walletAddress: string) {
  return `Sign in to BSC GameFi Web with wallet ${normalizeWalletAddress(walletAddress)}`;
}

export function signSessionToken(payload: { walletAddress: string }, secret: string, ttlSeconds = 86400) {
  if (!secret) throw new Error("JWT_SECRET is required");
  const now = Math.floor(Date.now() / 1000);
  const sessionPayload: SessionPayload = {
    walletAddress: assertWalletAddress(payload.walletAddress),
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
  return {
    walletAddress: assertWalletAddress(payload.walletAddress),
    iat: payload.iat,
    exp: payload.exp,
  };
}

export function getBearerSession(request: Request) {
  const authorization = request.headers.get("authorization") || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice("Bearer ".length) : "";
  return verifySessionToken(token, process.env.JWT_SECRET || "");
}

export function isAdminWalletAddress(walletAddress: string) {
  const adminWallet = process.env.ADMIN_WALLET_ADDRESS;
  if (!adminWallet) return false;
  return normalizeWalletAddress(walletAddress) === normalizeWalletAddress(adminWallet);
}

export function assertAdminSession(session: SessionPayload) {
  if (!process.env.ADMIN_WALLET_ADDRESS) throw new Error("ADMIN_WALLET_ADDRESS is required");
  if (!isAdminWalletAddress(session.walletAddress)) throw new Error("Admin privileges required");
}

export async function verifyWalletLoginSignature(params: {
  walletAddress: `0x${string}`;
  signature: `0x${string}`;
}) {
  return verifyMessage({
    address: params.walletAddress,
    message: buildWalletLoginMessage(params.walletAddress),
    signature: params.signature,
  });
}
