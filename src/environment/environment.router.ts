import express from "express";
import type { Request, Response } from "express";
import { body, validationResult } from "express-validator";
import { token } from "../utils/token.server";
import { buildPaginatedResponse, getPaginationParams } from "../utils/pagination";
import { tenantMiddleware } from "../utils/tenant.middleware";
import { ensureProjectAccess, requireSystemAccess, USER_ACCESS_LEVEL } from "../utils/permissions";

import * as EnvironmentCaseService from "./environment.service";

export const environmentRouter = express.Router();

environmentRouter.get("/project/:projectId", token.authMiddleware, tenantMiddleware, async (request: Request, response: Response) => {
    // #swagger.tags = ['Environments']
    // #swagger.description = 'Lista ambientes de um projeto (paginado).'
    if (!requireSystemAccess(request, response, USER_ACCESS_LEVEL)) return;
    try {
        const projectId: number = parseInt(request.params.projectId);
        if (!projectId) {
            return response.status(401).json({ error: "Projeto não identificado" });
        }
        const access = await ensureProjectAccess(request, response, projectId, {
            allowRoles: ["owner", "manager", "tester"],
        });
        if (!access) return;
        const pagination = getPaginationParams(request.query);
        const result = await EnvironmentCaseService.findByPaged({ projectId: projectId }, pagination);
        return response.status(200).json(
            buildPaginatedResponse(result.data, result.total, pagination.page, pagination.limit)
        );
    } catch (error: any) {
        return response.status(500).json(error.message);
    }
});

environmentRouter.get("/:id",  token.authMiddleware, tenantMiddleware, async (request: Request, response: Response) => {
    // #swagger.tags = ['Environments']
    // #swagger.description = 'Busca um ambiente por id.'
    if (!requireSystemAccess(request, response, USER_ACCESS_LEVEL)) return;
    const id: number = parseInt(request.params.id);
    try {
        const environment = await EnvironmentCaseService.find(id);
        if (environment) {
            const access = await ensureProjectAccess(request, response, environment.projectId, {
                allowRoles: ["owner", "manager", "tester"],
            });
            if (!access) return;
            return response.status(200).json(environment);
        }
        return response.status(404).json("Ambiente não encontrado");
    } catch (error: any) {
        return response.status(500).json(error.message);
    }
});

environmentRouter.post("/:projectId", token.authMiddleware, tenantMiddleware, body("name").isString(), body("description").isString(), async (request: Request, response: Response) => {
    // #swagger.tags = ['Environments']
    // #swagger.description = 'Cria um ambiente para o projeto.'
    if (!requireSystemAccess(request, response, USER_ACCESS_LEVEL)) return;
    const errors = validationResult(request);
    if (!errors.isEmpty()) {
        return response.status(400).json({ errors: errors.array() });
    }
    try {
        const projectId: number = parseInt(request.params.projectId);
        const access = await ensureProjectAccess(request, response, projectId, {
            allowRoles: ["owner", "manager"],
        });
        if (!access) return;
        const environmentData = { ...request.body, projectId: projectId };
        const newEnvironment = await EnvironmentCaseService.create(environmentData);
        return response.status(201).json(newEnvironment);
    } catch (error: any) {
        return response.status(500).json(error.message);
    }
});

environmentRouter.put("/:id", token.authMiddleware, tenantMiddleware, async (request: Request, response: Response) => {
    // #swagger.tags = ['Environments']
    // #swagger.description = 'Atualiza um ambiente.'
    if (!requireSystemAccess(request, response, USER_ACCESS_LEVEL)) return;
    const id: number = parseInt(request.params.id);
    try {
        const environment = await EnvironmentCaseService.find(id);
        if (!environment) {
            return response.status(404).json("Ambiente não encontrado");
        }
        const access = await ensureProjectAccess(request, response, environment.projectId, {
            allowRoles: ["owner", "manager"],
        });
        if (!access) return;
        const updateEnvironment = await EnvironmentCaseService.update(id, request.body);
        return response.status(200).json(updateEnvironment);
    } catch (error: any) {
        return response.status(500).json(error.message);
    }
});
