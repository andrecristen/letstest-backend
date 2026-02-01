import express from "express";
import type { Request, Response } from "express";
import { body, validationResult } from "express-validator";
import { token } from "../utils/token.server";
import { buildPaginatedResponse, getPaginationParams } from "../utils/pagination";

import * as TestExecutionService from "./testExecution.service";

export const testExecutionRouter = express.Router();

testExecutionRouter.get("/test-case/:testCaseId", token.authMiddleware, async (request: Request, response: Response) => {
    //@todo adiconar validações para ver se usuário está no projeto
    const testCaseId: number = parseInt(request.params.testCaseId);
    try {
        const pagination = getPaginationParams(request.query);
        const result = await TestExecutionService.findByPaged({ testCaseId }, pagination);
        return response.status(200).json(
            buildPaginatedResponse(result.data, result.total, pagination.page, pagination.limit)
        );
    } catch (error: any) {
        return response.status(500).json(error.message);
    }
});

testExecutionRouter.get("/test-case/:testCaseId/my", token.authMiddleware, async (request: Request, response: Response) => {
    //@todo adiconar validações para ver se usuário está no projeto
    const testCaseId: number = parseInt(request.params.testCaseId);
    const userId = request.user?.id;
    try {
        const pagination = getPaginationParams(request.query);
        const result = await TestExecutionService.findByPaged({ testCaseId, userId }, pagination);
        return response.status(200).json(
            buildPaginatedResponse(result.data, result.total, pagination.page, pagination.limit)
        );
    } catch (error: any) {
        return response.status(500).json(error.message);
    }
});

testExecutionRouter.get("/:id", token.authMiddleware, async (request: Request, response: Response) => {
    //@todo adiconar validações para ver se usuário está no projeto
    const id: number = parseInt(request.params.id);
    try {
        const testExecution = await TestExecutionService.find(id);
        if (testExecution) {
            return response.status(200).json(testExecution);
        }
        return response.status(404).json("Execução de testes não encontrada");
    } catch (error: any) {
        return response.status(500).json(error.message);
    }
});

testExecutionRouter.post("/:testCaseId", token.authMiddleware, body("testTime").isNumeric(), body("data").isObject(), async (request: Request, response: Response) => {
    const errors = validationResult(request);
    if (!errors.isEmpty()) {
        return response.status(400).json({ errors: errors.array() });
    }
    try {
        const userId = request.user?.id;
        const testCaseId: number = parseInt(request.params.testCaseId);
        if (!testCaseId) {
            return response.status(404).json({ error: "Caso de Teste não definido" });
        }
        //@todo adiconar validações para ver se usuário está no projeto
        const testExecutionData = { ...request.body, testCaseId, userId };
        const newTestExecution = await TestExecutionService.create(testExecutionData);
        return response.status(201).json(newTestExecution);
    } catch (error: any) {
        return response.status(500).json(error.message);
    }
});
