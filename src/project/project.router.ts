import express from "express";
import type { Request, Response } from "express";
import { body, validationResult } from "express-validator";
import { token } from "../utils/token.server";
import { tenantMiddleware } from "../utils/tenant.middleware";
import { buildPaginatedResponse, getPaginationParams } from "../utils/pagination";
import { ensureProjectAccess } from "../utils/permissions";

import * as ProjectService from "./project.service";
import * as InvolvementService from "../involvement/involvement.service";
import { assertWithinLimit, LimitExceededError } from "../billing/billing.service";

export const projectRouter = express.Router();

projectRouter.get("/me", token.authMiddleware, tenantMiddleware, async (request: Request, response: Response) => {
    // #swagger.tags = ['Projects']
    // #swagger.description = 'Lista projetos do usuario na organizacao (paginado).'
    try {
        const userId = parseInt(request.user?.id);
        const organizationId = request.organizationId!;
        const pagination = getPaginationParams(request.query);
        const search = typeof request.query.search === "string" ? request.query.search.trim() : "";
        const situation = request.query.situation ? parseInt(String(request.query.situation), 10) : null;
        const visibility = request.query.visibility ? parseInt(String(request.query.visibility), 10) : null;
        const involvements = await InvolvementService.findBy({
            type: InvolvementService.InvolvementType.manager,
            userId,
        });
        const projectIds = involvements?.map((involvement) => involvement.projectId) ?? [];
        const baseWhere = projectIds.length
            ? { organizationId, OR: [{ creatorId: userId }, { id: { in: projectIds } }] }
            : { organizationId, creatorId: userId };
        const filterWhere: any = {};
        if (search) {
            filterWhere.name = { contains: search, mode: "insensitive" };
        }
        if (situation && !Number.isNaN(situation)) {
            filterWhere.situation = situation;
        }
        if (visibility && !Number.isNaN(visibility)) {
            filterWhere.visibility = visibility;
        }
        const where = Object.keys(filterWhere).length
            ? { AND: [baseWhere, filterWhere] }
            : baseWhere;
        const result = await ProjectService.findByPaged(where, pagination);
        return response.status(200).json(
            buildPaginatedResponse(result.data, result.total, pagination.page, pagination.limit)
        );
    } catch (error: any) {
        return response.status(500).json(error.message);
    }
});

projectRouter.get("/test", token.authMiddleware, tenantMiddleware, async (request: Request, response: Response) => {
    // #swagger.tags = ['Projects']
    // #swagger.description = 'Lista projetos em que o usuario participa (paginado).'
    try {
        const userId = parseInt(request.user?.id);
        const organizationId = request.organizationId!;
        const pagination = getPaginationParams(request.query);
        const result = await ProjectService.findByPaged({
            organizationId,
            involvements: {
                some: {
                    userId: userId,
                    type: InvolvementService.InvolvementType.tester,
                },
            },
        }, pagination);
        return response.status(200).json(
            buildPaginatedResponse(result.data, result.total, pagination.page, pagination.limit)
        );
    } catch (error: any) {
        return response.status(500).json(error.message);
    }
});

projectRouter.get("/public", token.authMiddleware, tenantMiddleware, async (request: Request, response: Response) => {
    // #swagger.tags = ['Projects']
    // #swagger.description = 'Lista projetos publicos disponiveis para candidatura (paginado).'
    try {
        const userId = parseInt(request.user?.id);
        const organizationId = request.organizationId!;
        const pagination = getPaginationParams(request.query);
        const result = await ProjectService.findByPaged({
            organizationId,
            visibility: ProjectService.ProjectVisibilityEnum.public,
            situation: ProjectService.ProjectSituationEnum.testing,
            involvements: {
                none: {
                    userId: userId,
                }
            },
            creatorId: {
                not: userId
            }
        }, pagination);
        return response.status(200).json(
            buildPaginatedResponse(result.data, result.total, pagination.page, pagination.limit)
        );
    } catch (error) {
        console.error("Erro ao buscar projetos públicos:", error);
        return response.status(500).json({ message: "Erro interno do servidor" });
    }
});

projectRouter.get("/:id", token.authMiddleware, tenantMiddleware, async (request: Request, response: Response) => {
    // #swagger.tags = ['Projects']
    // #swagger.description = 'Busca um projeto por id.'
    const id: number = parseInt(request.params.id);
    try {
        const access = await ensureProjectAccess(request, response, id, {
            allowRoles: ["owner", "manager", "tester"],
            allowPublic: true,
        });
        if (!access) return;
        const project = await ProjectService.find(id);
        return response.status(200).json(project);
    } catch (error: any) {
        return response.status(500).json(error.message);
    }
});

projectRouter.post("/", token.authMiddleware, tenantMiddleware, body("name").isString(), body("description").isString(), async (request: Request, response: Response) => {
    // #swagger.tags = ['Projects']
    // #swagger.description = 'Cria um projeto.'
    const errors = validationResult(request);
    if (!errors.isEmpty()) {
        return response.status(400).json({ errors: errors.array() });
    }
    try {
        const userId = request.user?.id;
        const organizationId = request.organizationId!;
        await assertWithinLimit("projects", { organizationId, increment: 1 });
        const projectData = { ...request.body, creatorId: userId, organizationId };
        if (projectData.dueDate) {
            projectData.dueDate = new Date(projectData.dueDate);
        }
        const newProject = await ProjectService.create(projectData);
        return response.status(201).json(newProject);
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
});

projectRouter.put("/:id", token.authMiddleware, tenantMiddleware, async (request: Request, response: Response) => {
    // #swagger.tags = ['Projects']
    // #swagger.description = 'Atualiza um projeto.'
    const id: number = parseInt(request.params.id);
    try {
        const userId = request.user?.id;
        const access = await ensureProjectAccess(request, response, id, {
            allowRoles: ["owner", "manager", "tester"],
        });
        if (!access) return;
        const project = await ProjectService.find(id);
        if (!project) {
            return response.status(404).json("Projeto não encontrado");
        }
        if (project.creatorId !== userId) {
            return response.status(403).json({ error: "Você não tem permissão para alterar este projeto" });
        }
        const updatePayload: any = { ...request.body };
        if (updatePayload.dueDate) {
            updatePayload.dueDate = new Date(updatePayload.dueDate);
        }
        const updatedProject = await ProjectService.update(id, updatePayload);
        return response.status(200).json(updatedProject);
    } catch (error: any) {
        return response.status(500).json(error.message);
    }
});

projectRouter.get("/:id/overview", token.authMiddleware, tenantMiddleware, async (request: Request, response: Response) => {
    // #swagger.tags = ['Projects']
    // #swagger.description = 'Retorna indicadores/resumo do projeto.'
    const id: number = parseInt(request.params.id);
    try {
        const access = await ensureProjectAccess(request, response, id, {
            allowRoles: ["owner", "manager", "tester"],
            allowPublic: true,
        });
        if (!access) return;
        const project = await ProjectService.findOverview(id);
        if (project) {
            return response.status(200).json(project);
        }
        return response.status(404).json("Projeto não encontrado");
    } catch (error: any) {
        return response.status(500).json(error.message);
    }
});
