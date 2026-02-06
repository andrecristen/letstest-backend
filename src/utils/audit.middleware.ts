import type { Request } from "express";
import { db } from "./db.server";

type AuditInput = {
    organizationId: number;
    userId?: number;
    action: string;
    resourceType: string;
    resourceId?: number;
    metadata?: any;
};

const getIpAddress = (req: Request): string | undefined => {
    const forwarded = req.headers["x-forwarded-for"];
    if (typeof forwarded === "string" && forwarded.trim()) {
        return forwarded.split(",")[0].trim();
    }
    return req.socket?.remoteAddress ?? undefined;
};

export const recordAuditLog = async (req: Request, input: AuditInput) => {
    try {
        await db.auditLog.create({
            data: {
                organizationId: input.organizationId,
                userId: input.userId,
                action: input.action,
                resourceType: input.resourceType,
                resourceId: input.resourceId,
                metadata: input.metadata,
                ipAddress: getIpAddress(req),
            },
        });
    } catch (error) {
        console.error("Failed to record audit log:", error);
    }
};
