import express from "express";
import type { Request, Response } from "express";
import { body, validationResult } from "express-validator";
import { token } from "../utils/token.server";

import * as TestExecutionService from "./testExecution.service";

export const testExecutionRouter = express.Router();

testExecutionRouter.get("/test-case/:testCaseId", async (request: Request, response: Response) => {
    //@todo adiconar validações para ver se usuário está no projeto
    const testCaseId: number = parseInt(request.params.testCaseId);
    try {
        const testExecutions = await TestExecutionService.findBy({ testCaseId });
        if (testExecutions) {
            return response.status(200).json(testExecutions);
        }
        return response.status(404).json("Nenhuma execução de testes encontrada");
    } catch (error: any) {
        return response.status(500).json(error.message);
    }
});

testExecutionRouter.get("/:id", async (request: Request, response: Response) => {
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
        if (!userId) {
            return response.status(401).json({ error: "Usuário não autenticado" });
        }
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