import express from "express";
import type { Request, Response } from "express";
import { body, validationResult } from "express-validator";
import { token } from "../utils/token.server";
import { buildPaginatedResponse, getPaginationParams } from "../utils/pagination";
import { db } from "../utils/db.server";

import * as TestExecutionService from "./testExecution.service";
import * as ProjectService from "../project/project.service";
import { assertWithinLimit, LimitExceededError } from "../billing/billing.service";
import { dispatchEvent } from "../webhook/webhook.service";

export const testExecutionRouter = express.Router();

testExecutionRouter.get("/test-case/:testCaseId", token.authMiddleware, async (request: Request, response: Response) => {
    // #swagger.tags = ['TestExecutions']
    // #swagger.description = 'Lista execucoes de um caso de teste (paginado).'
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
    // #swagger.tags = ['TestExecutions']
    // #swagger.description = 'Lista minhas execucoes de um caso de teste (paginado).'
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
    // #swagger.tags = ['TestExecutions']
    // #swagger.description = 'Busca uma execucao de teste por id.'
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
    // #swagger.tags = ['TestExecutions']
    // #swagger.description = 'Cria uma execucao para um caso de teste.'
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
        const testCase = await db.testCase.findUnique({
            where: { id: testCaseId },
            select: { id: true, projectId: true, approvalStatus: true, testScenario: { select: { approvalStatus: true } } },
        });
        if (!testCase?.projectId) {
            return response.status(404).json({ error: "Caso de Teste não encontrado" });
        }
        const project = await ProjectService.find(testCase.projectId);
        if (project?.organizationId) {
            await assertWithinLimit("test_executions", { organizationId: project.organizationId, increment: 1 });
        }
        if (project?.approvalEnabled && project.approvalTestCaseEnabled && testCase.approvalStatus !== 3) {
            return response.status(409).json("Caso de Teste ainda não aprovado");
        }
        if (project?.approvalEnabled && project.approvalScenarioEnabled && testCase.testScenario?.approvalStatus && testCase.testScenario.approvalStatus !== 3) {
            return response.status(409).json("Cenario de Teste ainda não aprovado");
        }
        const testExecutionData = { ...request.body, testCaseId, userId };
        const newTestExecution = await TestExecutionService.create(testExecutionData);

        if (project?.organizationId) {
            dispatchEvent(project.organizationId, "test_execution.created", {
                id: newTestExecution.id,
                testCaseId: newTestExecution.testCaseId,
                projectId: testCase.projectId,
                userId: newTestExecution.userId,
            }).catch(console.error);
        }

        return response.status(201).json(newTestExecution);
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
