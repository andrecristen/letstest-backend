import express from "express";
import type { Request, Response } from "express";
import { body, validationResult } from "express-validator";
import { token } from "../utils/token.server";
import { buildPaginatedResponse, getPaginationParams } from "../utils/pagination";
import { db } from "../utils/db.server";

import * as TestScenarioService from "./testScenario.service";
import * as ProjectService from "../project/project.service";

export const testScenarioRouter = express.Router();

testScenarioRouter.get("/project/:projectId", token.authMiddleware, async (request: Request, response: Response) => {
    try {
        //@todo adiconar validações para ver se usuário está no projeto (gerente ou testador)
        const projectId: number = parseInt(request.params.projectId);
        if (!projectId) {
            return response.status(401).json({ error: "Projeto não identificado" });
        }
        const pagination = getPaginationParams(request.query);
        const result = await TestScenarioService.findByPaged({ projectId: projectId }, pagination);
        return response.status(200).json(
            buildPaginatedResponse(result.data, result.total, pagination.page, pagination.limit)
        );
    } catch (error: any) {
        return response.status(500).json(error.message);
    }
});

testScenarioRouter.get("/:id", token.authMiddleware, async (request: Request, response: Response) => {
    const id: number = parseInt(request.params.id);
    try {
        //@todo adiconar validações para ver se usuário está no projeto (gerente ou testador)
        //se for testador deve validar se está atribuido a ele esse teste
        const testScenario = await TestScenarioService.find(id);
        if (testScenario) {
            const executionCount = await db.testExecution.count({
                where: {
                    testCase: {
                        testScenarioId: id,
                    },
                },
            });
            return response.status(200).json({
                ...testScenario,
                hasExecutions: executionCount > 0,
            });
        }
        return response.status(404).json("Caso de Teste não encontrado");
    } catch (error: any) {
        return response.status(500).json(error.message);
    }
});

testScenarioRouter.post("/:projectId", token.authMiddleware, body("name").isString(), body("data").isObject(), async (request: Request, response: Response) => {
    const errors = validationResult(request);
    if (!errors.isEmpty()) {
        return response.status(400).json({ errors: errors.array() });
    }
    try {
        const projectId: number = parseInt(request.params.projectId);
        //@todo adiconar validações para ver se usuário está no projeto (gerente apenas)
        const project = await ProjectService.find(projectId);
        if (!project) {
            return response.status(404).json("Projeto não encontrado");
        }
        let approvalStatus = 3;
        let approvedAt: Date | undefined;
        let approvedById: number | undefined;
        if (project.approvalEnabled && project.approvalScenarioEnabled) {
            const requestedStatus = parseInt(String(request.body.approvalStatus ?? "1"), 10);
            approvalStatus = requestedStatus === 3 ? 3 : 1;
            if (approvalStatus === 3) {
                approvedAt = new Date();
                approvedById = request.user?.id;
            }
        }
        const testScenarioData = { ...request.body, projectId: projectId, approvalStatus, approvedAt, approvedById };
        const newTestScenario = await TestScenarioService.create(testScenarioData);
        return response.status(201).json(newTestScenario);
    } catch (error: any) {
        return response.status(500).json(error.message);
    }
});

testScenarioRouter.put("/:id/status", token.authMiddleware, body("status").isNumeric(), async (request: Request, response: Response) => {
    const id: number = parseInt(request.params.id);
    const errors = validationResult(request);
    if (!errors.isEmpty()) {
        return response.status(400).json({ errors: errors.array() });
    }
    try {
        const status = parseInt(request.body.status, 10);
        if (![1, 3].includes(status)) {
            return response.status(400).json("Status inválido");
        }
        const testScenario = await TestScenarioService.find(id);
        if (!testScenario) {
            return response.status(404).json("Caso de Teste não encontrado");
        }
        const project = await ProjectService.find(testScenario.projectId);
        if (!project?.approvalEnabled || !project.approvalScenarioEnabled) {
            return response.status(400).json("Workflow de aprovação não habilitado");
        }
        const userId = request.user?.id;
        const isManager = await db.involvement.findFirst({
            where: {
                projectId: testScenario.projectId,
                userId,
                type: 1,
                situation: 2,
            },
        });
        if (project.creatorId !== userId && !isManager) {
            return response.status(403).json("Você não tem permissão para aprovar");
        }
        const updatePayload: any = { approvalStatus: status };
        if (status === 1) {
            updatePayload.reviewedAt = null;
            updatePayload.reviewedById = null;
            updatePayload.approvedAt = null;
            updatePayload.approvedById = null;
        }
        if (status === 3) {
            updatePayload.approvedAt = new Date();
            updatePayload.approvedById = userId;
        }
        const updatedTestScenario = await TestScenarioService.update(id, updatePayload);
        return response.status(200).json(updatedTestScenario);
    } catch (error: any) {
        return response.status(500).json(error.message);
    }
});

testScenarioRouter.put("/:id", token.authMiddleware, body("name").isString(), body("data").isObject(), async (request: Request, response: Response) => {
    const id: number = parseInt(request.params.id);
    const errors = validationResult(request);
    if (!errors.isEmpty()) {
        return response.status(400).json({ errors: errors.array() });
    }
    try {
        const testScenario = await TestScenarioService.find(id);
        if (!testScenario) {
            return response.status(404).json("Caso de Teste não encontrado");
        }
        //@todo adiconar validações para ver se usuário está no projeto (gerente apenas)
        const executionCount = await db.testExecution.count({
            where: {
                testCase: {
                    testScenarioId: id,
                },
            },
        });
        if (executionCount > 0) {
            return response.status(409).json("Não é possível editar um cenário com execuções");
        }
        const updateTestScenario = await TestScenarioService.update(id, request.body);
        return response.status(200).json(updateTestScenario);
    } catch (error: any) {
        return response.status(500).json(error.message);
    }
});
