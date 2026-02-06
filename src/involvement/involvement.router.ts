import express from "express";
import type { Request, Response } from "express";
import { body, validationResult } from "express-validator";
import { token } from "../utils/token.server";
import { buildPaginatedResponse, getPaginationParams } from "../utils/pagination";
import { db } from "../utils/db.server";
import { tenantMiddleware } from "../utils/tenant.middleware";
import { ensureProjectAccess, requireSystemAccess, USER_ACCESS_LEVEL } from "../utils/permissions";

import * as InvolvementService from "./involvement.service";
import * as ProjectService from "../project/project.service";
import { assertWithinLimit, LimitExceededError } from "../billing/billing.service";

export const involvementRouter = express.Router();

involvementRouter.get("/project/:projectId", token.authMiddleware, tenantMiddleware, async (request: Request, response: Response) => {
    // #swagger.tags = ['Involvements']
    // #swagger.description = 'Lista envolvimentos por projeto (paginado).'
    if (!requireSystemAccess(request, response, USER_ACCESS_LEVEL)) return;
    const projectId: number = parseInt(request.params.projectId);
    try {
        const access = await ensureProjectAccess(request, response, projectId, {
            allowRoles: ["owner", "manager"],
        });
        if (!access) return;
        const pagination = getPaginationParams(request.query);
        const search = typeof request.query.search === "string" ? request.query.search.trim() : "";
        const type = request.query.type ? parseInt(String(request.query.type), 10) : null;
        const where: any = { projectId };
        if (type && !Number.isNaN(type)) {
            where.type = type;
        }
        if (search) {
            where.user = {
                OR: [
                    { name: { contains: search, mode: "insensitive" } },
                    { email: { contains: search, mode: "insensitive" } },
                ],
            };
        }
        const result = await InvolvementService.findByPaged(where, pagination);
        return response.status(200).json(
            buildPaginatedResponse(result.data, result.total, pagination.page, pagination.limit)
        );
    } catch (error: any) {
        return response.status(500).json(error.message);
    }
});

involvementRouter.get("/project/:projectId/testers", token.authMiddleware, tenantMiddleware, async (request: Request, response: Response) => {
    // #swagger.tags = ['Involvements']
    // #swagger.description = 'Lista testadores de um projeto.'
    if (!requireSystemAccess(request, response, USER_ACCESS_LEVEL)) return;
    try {
        const projectId: number = parseInt(request.params.projectId);
        if (!projectId) {
            return response.status(400).json("Projeto não identificado");
        }
        const access = await ensureProjectAccess(request, response, projectId, {
            allowRoles: ["owner", "manager", "tester"],
        });
        if (!access) return;
        const testers = await InvolvementService.findBy({
            projectId,
            type: InvolvementService.InvolvementType.tester,
        });
        return response.status(200).json(testers ?? []);
    } catch (error: any) {
        return response.status(500).json(error.message);
    }
});

involvementRouter.get("/project/:projectId/my-role", token.authMiddleware, tenantMiddleware, async (request: Request, response: Response) => {
    // #swagger.tags = ['Involvements']
    // #swagger.description = 'Retorna o papel do usuario autenticado no projeto.'
    if (!requireSystemAccess(request, response, USER_ACCESS_LEVEL)) return;
    try {
        const projectId: number = parseInt(request.params.projectId);
        const userId = request.user?.id;
        if (!projectId) {
            return response.status(400).json("Projeto não identificado");
        }
        const access = await ensureProjectAccess(request, response, projectId, {
            allowRoles: ["owner", "manager", "tester"],
        });
        if (!access) return;
        const project = await ProjectService.find(projectId);
        if (!project) {
            return response.status(404).json("Projeto não encontrado");
        }
        const isOwner = project.creatorId === userId;
        const involvement = await db.involvement.findFirst({
            where: { projectId, userId },
        });
        const isManager = involvement?.type === InvolvementService.InvolvementType.manager;
        const isTester = involvement?.type === InvolvementService.InvolvementType.tester;
        return response.status(200).json({
            isOwner,
            isManager,
            isTester,
            canManageTests: isOwner || isManager,
        });
    } catch (error: any) {
        return response.status(500).json(error.message);
    }
});

involvementRouter.post(
    "/project/:projectId",
    token.authMiddleware,
    tenantMiddleware,
    body("userId").isNumeric(),
    body("type").isNumeric(),
    async (request: Request, response: Response) => {
        // #swagger.tags = ['Involvements']
        // #swagger.description = 'Vincula um usuario a um projeto.'
        if (!requireSystemAccess(request, response, USER_ACCESS_LEVEL)) return;
        try {
            const errors = validationResult(request);
            if (!errors.isEmpty()) {
                return response.status(400).json({ errors: errors.array() });
            }
            const projectId = parseInt(request.params.projectId);
            const project = await ProjectService.find(projectId);
            if (!project) {
                return response.status(404).json("Projeto não encontrado");
            }
            const access = await ensureProjectAccess(request, response, projectId, {
                allowRoles: ["owner", "manager"],
            });
            if (!access) return;
            await assertWithinLimit("seats", { organizationId: project.organizationId, increment: 1 });
            const userId = parseInt(request.body.userId);
            const type = parseInt(request.body.type);

            const membership = await db.organizationMember.findUnique({
                where: { organizationId_userId: { organizationId: project.organizationId, userId } },
            });
            if (!membership) {
                return response.status(400).json({ error: "Usuário não pertence à organização" });
            }

            const existing = await db.involvement.findFirst({
                where: { projectId, userId, type },
            });
            if (existing) {
                return response.status(200).json(existing);
            }

            const involvement = await InvolvementService.create({
                type,
                userId,
                projectId,
            });
            return response.status(201).json(involvement);
        } catch (error: any) {
            if (error instanceof LimitExceededError) {
                return response.status(402).json({
                    code: "LIMIT_EXCEEDED",
                    metric: error.metric,
                    current: error.current,
                    limit: error.limit,
                });
            }
            return response.status(500).json(error.message);
        }
    }
);

involvementRouter.delete("/:id", token.authMiddleware, tenantMiddleware, async (request: Request, response: Response) => {
    // #swagger.tags = ['Involvements']
    // #swagger.description = 'Remove um envolvimento.'
    if (!requireSystemAccess(request, response, USER_ACCESS_LEVEL)) return;
    const id: number = parseInt(request.params.id);
    try {
        const involvement = await InvolvementService.find(id);
        if (!involvement) {
            return response.status(404).json("Vínculo não encontrado");
        }
        const access = await ensureProjectAccess(request, response, involvement.projectId, {
            allowRoles: ["owner", "manager"],
        });
        if (!access) return;
        const updatedInvolvement = await InvolvementService.remove(id);
        return response.status(200).json(updatedInvolvement);
    } catch (error: any) {
        return response.status(500).json(error.message);
    }
});
