import crypto from "crypto";
import { db } from "../utils/db.server";

const REFRESH_TOKEN_TTL_DAYS = 7;

const tokenTtlMs = () => REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000;

const generateToken = () => crypto.randomBytes(48).toString("hex");

const generateFamily = () => crypto.randomUUID();

export const hashToken = (token: string) =>
    crypto.createHash("sha256").update(token).digest("hex");

export const createRefreshToken = async (userId: number, family?: string) => {
    const rawToken = generateToken();
    const tokenHash = hashToken(rawToken);
    const tokenFamily = family ?? generateFamily();
    const expiresAt = new Date(Date.now() + tokenTtlMs());

    await db.refreshToken.create({
        data: {
            userId,
            token: tokenHash,
            family: tokenFamily,
            expiresAt,
        },
    });

    return { token: rawToken, family: tokenFamily, expiresAt };
};

export const findRefreshToken = async (rawToken: string) => {
    return db.refreshToken.findUnique({
        where: { token: hashToken(rawToken) },
    });
};

export const revokeToken = async (id: number) => {
    return db.refreshToken.update({
        where: { id },
        data: { revokedAt: new Date() },
    });
};

export const revokeFamily = async (family: string) => {
    return db.refreshToken.updateMany({
        where: { family, revokedAt: null },
        data: { revokedAt: new Date() },
    });
};

export const revokeAllForUser = async (userId: number) => {
    return db.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
    });
};
