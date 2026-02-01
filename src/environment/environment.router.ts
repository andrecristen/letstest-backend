import express from "express";
import type { Request, Response } from "express";
import { body, validationResult } from "express-validator";
import { token } from "../utils/token.server";
import { buildPaginatedResponse, getPaginationParams } from "../utils/pagination";

import * as EnvironmentCaseService from "./environment.service";

export const environmentRouter = express.Router();

environmentRouter.get("/project/:projectId", token.authMiddleware, async (request: Request, response: Response) => {
    try {
        //@todo adiconar validações para ver se usuário está no projeto (gerente ou testador)
        const projectId: number = parseInt(request.params.projectId);
        if (!projectId) {
            return response.status(401).json({ error: "Projeto não identificado" });
        }
        const pagination = getPaginationParams(request.query);
        const result = await EnvironmentCaseService.findByPaged({ projectId: projectId }, pagination);
        return response.status(200).json(
            buildPaginatedResponse(result.data, result.total, pagination.page, pagination.limit)
        );
    } catch (error: any) {
        return response.status(500).json(error.message);
    }
});

environmentRouter.get("/:id",  token.authMiddleware, async (request: Request, response: Response) => {
    const id: number = parseInt(request.params.id);
    try {
        //@todo adiconar validações para ver se usuário está no projeto (gerente ou testador)
        const testCase = await EnvironmentCaseService.find(id);
        if (testCase) {
            return response.status(200).json(testCase);
        }
        return response.status(404).json("Ambiente não encontrado");
    } catch (error: any) {
        return response.status(500).json(error.message);
    }
});

environmentRouter.post("/:projectId", token.authMiddleware, body("name").isString(), body("description").isString(), async (request: Request, response: Response) => {
    const errors = validationResult(request);
    if (!errors.isEmpty()) {
        return response.status(400).json({ errors: errors.array() });
    }
    try {
        const projectId: number = parseInt(request.params.projectId);
         //@todo adiconar validações para ver se usuário está no projeto (gerente apenas)
        const environmentData = { ...request.body, projectId: projectId };
        const newEnvironment = await EnvironmentCaseService.create(environmentData);
        return response.status(201).json(newEnvironment);
    } catch (error: any) {
        return response.status(500).json(error.message);
    }
});

environmentRouter.put("/:id", token.authMiddleware, async (request: Request, response: Response) => {
    const id: number = parseInt(request.params.id);
    try {
        const testCase = await EnvironmentCaseService.find(id);
        if (!testCase) {
            return response.status(404).json("Ambiente não encontrado");
        }
        //@todo adiconar validações para ver se usuário está no projeto (gerente apenas)
        const updateEnvironment = await EnvironmentCaseService.update(id, request.body);
        return response.status(200).json(updateEnvironment);
    } catch (error: any) {
        return response.status(500).json(error.message);
    }
});
