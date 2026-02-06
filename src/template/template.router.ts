import express from "express";
import type { Request, Response } from "express";
import { body, validationResult } from "express-validator";
import { token } from "../utils/token.server";
import { tenantMiddleware } from "../utils/tenant.middleware";
import { buildPaginatedResponse, getPaginationParams } from "../utils/pagination";
import { ensureProjectAccess } from "../utils/permissions";

import * as TemplateService from "./template.service";

export const templateRouter = express.Router();

templateRouter.get("/defaults/:type", token.authMiddleware, async (request: Request, response: Response) => {
    // #swagger.tags = ['Templates']
    // #swagger.description = 'Lista templates padrao por tipo (paginado).'
    const type: number = parseInt(request.params.type);
    try {
        const pagination = getPaginationParams(request.query);
        const result = await TemplateService.findByPaged({ projectId: null, type }, pagination);
        return response.status(200).json(
            buildPaginatedResponse(result.data, result.total, pagination.page, pagination.limit)
        );
    } catch (error: any) {
        return response.status(500).json(error.message);
    }
});

templateRouter.get("/:projectId/all", token.authMiddleware, tenantMiddleware, async (request: Request, response: Response) => {
    // #swagger.tags = ['Templates']
    // #swagger.description = 'Lista templates do projeto e templates padrao (paginado).'
    const projectId: number = parseInt(request.params.projectId);
    try {
        const access = await ensureProjectAccess(request, response, projectId, {
            allowRoles: ["owner", "manager", "tester"],
        });
        if (!access) return;
        const pagination = getPaginationParams(request.query);
        const result = await TemplateService.findByPaged({
            OR: [
                { projectId },
                { projectId: null, organizationId: null },
                { projectId: null, organizationId: request.organizationId },
            ],
        }, pagination);
        return response.status(200).json(
            buildPaginatedResponse(result.data, result.total, pagination.page, pagination.limit)
        );
    } catch (error: any) {
        return response.status(500).json(error.message);
    }
});

templateRouter.get("/:projectId/:type", token.authMiddleware, tenantMiddleware, async (request: Request, response: Response) => {
    // #swagger.tags = ['Templates']
    // #swagger.description = 'Lista templates do projeto por tipo (inclui padroes).'
    const projectId: number = parseInt(request.params.projectId);
    const type: number = parseInt(request.params.type);
    try {
        if (!projectId) {
            return response.status(400).json("Parâemtro 'Projeto' não encontrado.");
        }
        if (!type) {
            return response.status(400).json("Parâmetro 'Tipo' não encontrado.");
        }
        const access = await ensureProjectAccess(request, response, projectId, {
            allowRoles: ["owner", "manager", "tester"],
        });
        if (!access) return;
        const pagination = getPaginationParams(request.query);
        const result = await TemplateService.findByPaged({
            OR: [
                { projectId, type },
                { projectId: null, type, organizationId: null },
                { projectId: null, type, organizationId: request.organizationId },
            ],
        }, pagination);
        return response.status(200).json(
            buildPaginatedResponse(result.data, result.total, pagination.page, pagination.limit)
        );
    } catch (error: any) {
        return response.status(500).json(error.message);
    }
});

templateRouter.get("/:templateId", token.authMiddleware, tenantMiddleware, async (request: Request, response: Response) => {
    // #swagger.tags = ['Templates']
    // #swagger.description = 'Busca um template por id.'
    const id: number = parseInt(request.params.templateId);
    try {
        const template = await TemplateService.find(id);
        if (template) {
            if (template.projectId) {
                const access = await ensureProjectAccess(request, response, template.projectId, {
                    allowRoles: ["owner", "manager", "tester"],
                });
                if (!access) return;
            } else if (template.organizationId && template.organizationId !== request.organizationId) {
                return response.status(404).json("Template não encontrado");
            }
            return response.status(200).json(template);
        }
        return response.status(404).json("Template não encontrado");
    } catch (error: any) {
        return response.status(500).json(error.message);
    }
});

templateRouter.post("/:projectId", token.authMiddleware, tenantMiddleware, body("name").isString(), body("description").isString(), body("type").isNumeric(), body("data").isObject(), async (request: Request, response: Response) => {
    // #swagger.tags = ['Templates']
    // #swagger.description = 'Cria um template no projeto.'
    const errors = validationResult(request);
    if (!errors.isEmpty()) {
        return response.status(400).json({ errors: errors.array() });
    }
    try {
        const projectId: number = parseInt(request.params.projectId);
        if (!projectId) {
            return response.status(404).json({ error: "Projeto não definido" });
        }
        const access = await ensureProjectAccess(request, response, projectId, {
            allowRoles: ["owner", "manager"],
        });
        if (!access) return;
        const projectData = { ...request.body, projectId: projectId, organizationId: request.organizationId };
        const newTemplate = await TemplateService.create(projectData);
        return response.status(201).json(newTemplate);
    } catch (error: any) {
        return response.status(500).json(error.message);
    }
});
