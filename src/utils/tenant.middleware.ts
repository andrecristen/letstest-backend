import { Request, Response, NextFunction } from "express";
import { db } from "./db.server";

declare global {
    namespace Express {
        interface Request {
            organizationId?: number;
            organizationRole?: string;
        }
    }
}

export const tenantMiddleware = async (req: Request, res: Response, next: NextFunction) => {
    const userId = req.user?.id;
    if (!userId) {
        return res.status(401).json({ error: "Usuário não autenticado" });
    }

    const organizationId = req.user?.organizationId;
    if (!organizationId) {
        return res.status(400).json({ error: "Organização não selecionada" });
    }

    try {
        const membership = await db.organizationMember.findUnique({
            where: {
                organizationId_userId: {
                    organizationId,
                    userId,
                },
            },
        });

        if (!membership) {
            return res.status(403).json({ error: "Você não é membro desta organização" });
        }

        req.organizationId = organizationId;
        req.organizationRole = membership.role;
        next();
    } catch (error) {
        return res.status(500).json({ error: "Erro ao verificar organização" });
    }
};
