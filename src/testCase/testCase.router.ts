import express from "express";
import type { Request, Response } from "express";
import { body, validationResult } from "express-validator";
import { token } from "../utils/token.server";
import { buildPaginatedResponse, getPaginationParams } from "../utils/pagination";
import { db } from "../utils/db.server";
import { tenantMiddleware } from "../utils/tenant.middleware";
import { ensureProjectAccess, getProjectIdByTestCase, requireSystemAccess, USER_ACCESS_LEVEL } from "../utils/permissions";

import * as TestCaseService from "./testCase.service";
import * as ProjectService from "../project/project.service";
import { assertWithinLimit, LimitExceededError } from "../billing/billing.service";
import { dispatchEvent } from "../webhook/webhook.service";

export const testCaseRouter = express.Router();

testCaseRouter.get("/project/:projectId", token.authMiddleware, tenantMiddleware, async (request: Request, response: Response) => {
    // #swagger.tags = ['TestCases']
    // #swagger.description = 'Lista casos de teste de um projeto (paginado).'
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
        const testScenarioId = request.query.testScenarioId ? parseInt(String(request.query.testScenarioId), 10) : null;
        const where: any = { projectId: projectId };
        if (testScenarioId) {
            where.testScenarioId = testScenarioId;
        }
        const result = await TestCaseService.findByPaged(where, pagination);
        return response.status(200).json(
            buildPaginatedResponse(result.data, result.total, pagination.page, pagination.limit)
        );
    } catch (error: any) {
        return response.status(500).json(error.message);
    }
});

testCaseRouter.get("/project/:projectId/assigned", token.authMiddleware, tenantMiddleware, async (request: Request, response: Response) => {
    // #swagger.tags = ['TestCases']
    // #swagger.description = 'Lista casos de teste designados ao usuario (paginado).'
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
        const userId = request.user?.id;
        const pagination = getPaginationParams(request.query);
        const testScenarioId = request.query.testScenarioId ? parseInt(String(request.query.testScenarioId), 10) : null;
        const where: any = {
            projectId: projectId,
            assignments: {
                some: {
                    userId: userId,
                },
            },
        };
        if (testScenarioId) {
            where.testScenarioId = testScenarioId;
        }
        const result = await TestCaseService.findByPaged(where, pagination);
        return response.status(200).json(
            buildPaginatedResponse(result.data, result.total, pagination.page, pagination.limit)
        );
    } catch (error: any) {
        return response.status(500).json(error.message);
    }
});

testCaseRouter.post("/:id/assignment/start", token.authMiddleware, tenantMiddleware, async (request: Request, response: Response) => {
    // #swagger.tags = ['TestCases']
    // #swagger.description = 'Inicia a execucao de um caso de teste designado.'
    if (!requireSystemAccess(request, response, USER_ACCESS_LEVEL)) return;
    try {
        const testCaseId: number = parseInt(request.params.id);
        const userId = request.user?.id;
        if (!testCaseId || !userId) {
            return response.status(401).json({ error: "Usuário ou caso de teste não identificado" });
        }
        const projectId = await getProjectIdByTestCase(testCaseId);
        if (!projectId) {
            return response.status(404).json({ error: "Caso de Teste não encontrado" });
        }
        const access = await ensureProjectAccess(request, response, projectId, {
            allowRoles: ["owner", "manager", "tester"],
        });
        if (!access) return;
        const assignment = await db.testCaseAssignment.findUnique({
            where: { testCaseId_userId: { testCaseId, userId } },
        });
        if (!assignment) {
            return response.status(404).json({ error: "Designação não encontrada" });
        }
        if (assignment.finishedAt) {
            return response.status(400).json({ error: "Teste já finalizado" });
        }
        const updated = await db.testCaseAssignment.update({
            where: { id: assignment.id },
            data: { startedAt: assignment.startedAt ?? new Date(), lastPausedAt: null },
        });
        return response.status(200).json(updated);
    } catch (error: any) {
        return response.status(500).json(error.message);
    }
});

testCaseRouter.post("/:id/assignment/pause", token.authMiddleware, tenantMiddleware, async (request: Request, response: Response) => {
    // #swagger.tags = ['TestCases']
    // #swagger.description = 'Pausa a execucao de um caso de teste.'
    if (!requireSystemAccess(request, response, USER_ACCESS_LEVEL)) return;
    try {
        const testCaseId: number = parseInt(request.params.id);
        const userId = request.user?.id;
        if (!testCaseId || !userId) {
            return response.status(401).json({ error: "Usuário ou caso de teste não identificado" });
        }
        const projectId = await getProjectIdByTestCase(testCaseId);
        if (!projectId) {
            return response.status(404).json({ error: "Caso de Teste não encontrado" });
        }
        const access = await ensureProjectAccess(request, response, projectId, {
            allowRoles: ["owner", "manager", "tester"],
        });
        if (!access) return;
        const assignment = await db.testCaseAssignment.findUnique({
            where: { testCaseId_userId: { testCaseId, userId } },
        });
        if (!assignment) {
            return response.status(404).json({ error: "Designação não encontrada" });
        }
        if (assignment.finishedAt) {
            return response.status(400).json({ error: "Teste já finalizado" });
        }
        if (!assignment.startedAt) {
            return response.status(400).json({ error: "Teste não iniciado" });
        }
        const updated = await db.testCaseAssignment.update({
            where: { id: assignment.id },
            data: { lastPausedAt: assignment.lastPausedAt ?? new Date() },
        });
        return response.status(200).json(updated);
    } catch (error: any) {
        return response.status(500).json(error.message);
    }
});

testCaseRouter.post("/:id/assignment/resume", token.authMiddleware, tenantMiddleware, async (request: Request, response: Response) => {
    // #swagger.tags = ['TestCases']
    // #swagger.description = 'Retoma a execucao de um caso de teste.'
    if (!requireSystemAccess(request, response, USER_ACCESS_LEVEL)) return;
    try {
        const testCaseId: number = parseInt(request.params.id);
        const userId = request.user?.id;
        if (!testCaseId || !userId) {
            return response.status(401).json({ error: "Usuário ou caso de teste não identificado" });
        }
        const projectId = await getProjectIdByTestCase(testCaseId);
        if (!projectId) {
            return response.status(404).json({ error: "Caso de Teste não encontrado" });
        }
        const access = await ensureProjectAccess(request, response, projectId, {
            allowRoles: ["owner", "manager", "tester"],
        });
        if (!access) return;
        const assignment = await db.testCaseAssignment.findUnique({
            where: { testCaseId_userId: { testCaseId, userId } },
        });
        if (!assignment) {
            return response.status(404).json({ error: "Designação não encontrada" });
        }
        if (assignment.finishedAt) {
            return response.status(400).json({ error: "Teste já finalizado" });
        }
        if (!assignment.lastPausedAt) {
            return response.status(400).json({ error: "Teste não pausado" });
        }
        const pausedSeconds = Math.max(0, Math.floor((Date.now() - assignment.lastPausedAt.getTime()) / 1000));
        const updated = await db.testCaseAssignment.update({
            where: { id: assignment.id },
            data: {
                lastPausedAt: null,
                totalPausedSeconds: assignment.totalPausedSeconds + pausedSeconds,
            },
        });
        return response.status(200).json(updated);
    } catch (error: any) {
        return response.status(500).json(error.message);
    }
});

testCaseRouter.post("/:id/assignment/finish", token.authMiddleware, tenantMiddleware, async (request: Request, response: Response) => {
    // #swagger.tags = ['TestCases']
    // #swagger.description = 'Finaliza a execucao de um caso de teste.'
    if (!requireSystemAccess(request, response, USER_ACCESS_LEVEL)) return;
    try {
        const testCaseId: number = parseInt(request.params.id);
        const userId = request.user?.id;
        if (!testCaseId || !userId) {
            return response.status(401).json({ error: "Usuário ou caso de teste não identificado" });
        }
        const projectId = await getProjectIdByTestCase(testCaseId);
        if (!projectId) {
            return response.status(404).json({ error: "Caso de Teste não encontrado" });
        }
        const access = await ensureProjectAccess(request, response, projectId, {
            allowRoles: ["owner", "manager", "tester"],
        });
        if (!access) return;
        const assignment = await db.testCaseAssignment.findUnique({
            where: { testCaseId_userId: { testCaseId, userId } },
        });
        if (!assignment) {
            return response.status(404).json({ error: "Designação não encontrada" });
        }
        if (assignment.finishedAt) {
            return response.status(400).json({ error: "Teste já finalizado" });
        }
        const updated = await db.testCaseAssignment.update({
            where: { id: assignment.id },
            data: { finishedAt: new Date(), lastPausedAt: null },
        });
        return response.status(200).json(updated);
    } catch (error: any) {
        return response.status(500).json(error.message);
    }
});

testCaseRouter.get("/:id", token.authMiddleware, tenantMiddleware, async (request: Request, response: Response) => {
    // #swagger.tags = ['TestCases']
    // #swagger.description = 'Busca um caso de teste por id.'
    if (!requireSystemAccess(request, response, USER_ACCESS_LEVEL)) return;
    const id: number = parseInt(request.params.id);
    try {
        const testCase = await TestCaseService.find(id);
        if (testCase) {
            const access = await ensureProjectAccess(request, response, testCase.projectId, {
                allowRoles: ["owner", "manager", "tester"],
            });
            if (!access) return;
            return response.status(200).json(testCase);
        }
        return response.status(404).json("Caso de Teste não encontrado");
    } catch (error: any) {
        return response.status(500).json(error.message);
    }
});

testCaseRouter.post("/:projectId", token.authMiddleware, tenantMiddleware, body("name").isString(), body("data").isObject(), async (request: Request, response: Response) => {
    // #swagger.tags = ['TestCases']
    // #swagger.description = 'Cria um caso de teste no projeto.'
    if (!requireSystemAccess(request, response, USER_ACCESS_LEVEL)) return;
    const errors = validationResult(request);
    if (!errors.isEmpty()) {
        return response.status(400).json({ errors: errors.array() });
    }
    try {
        const projectId: number = parseInt(request.params.projectId);
        const userId = request.user?.id;
        const access = await ensureProjectAccess(request, response, projectId, {
            allowRoles: ["owner", "manager"],
        });
        if (!access) return;
        const project = await ProjectService.find(projectId);
        if (!project) {
            return response.status(404).json("Projeto não encontrado");
        }
        const isManager = await db.involvement.findFirst({
            where: {
                projectId: projectId,
                userId,
                type: 2,
            },
        });
        if (project.creatorId !== userId && !isManager) {
            return response.status(403).json("Você não tem permissão para criar casos de teste");
        }
        await assertWithinLimit("test_cases", { organizationId: project.organizationId, projectId, increment: 1 });
        if (project.approvalEnabled && project.approvalScenarioEnabled) {
            if (!request.body.testScenarioId) {
                return response.status(409).json("Cenario de Teste aprovado e obrigatorio");
            }
            const scenario = await db.testScenario.findUnique({
                where: { id: parseInt(String(request.body.testScenarioId), 10) },
                select: { approvalStatus: true, projectId: true },
            });
            if (!scenario || scenario.projectId !== projectId || scenario.approvalStatus !== 3) {
                return response.status(409).json("Cenario de Teste ainda nao aprovado");
            }
        }
        const approvalStatus = project.approvalEnabled && project.approvalTestCaseEnabled ? 1 : 3;
        const testCaseData: any = { ...request.body, projectId: projectId, approvalStatus };
        if (testCaseData.dueDate) {
            testCaseData.dueDate = new Date(testCaseData.dueDate);
        }
        const newTestCase = await TestCaseService.create(testCaseData);

        dispatchEvent(project.organizationId, "test_case.created", {
            id: newTestCase.id,
            projectId: newTestCase.projectId,
            name: newTestCase.name,
        }).catch(console.error);

        return response.status(201).json(newTestCase);
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

testCaseRouter.put("/:id/status", token.authMiddleware, tenantMiddleware, body("status").isNumeric(), async (request: Request, response: Response) => {
    // #swagger.tags = ['TestCases']
    // #swagger.description = 'Atualiza o status de aprovacao do caso de teste.'
    if (!requireSystemAccess(request, response, USER_ACCESS_LEVEL)) return;
    const id: number = parseInt(request.params.id);
    const errors = validationResult(request);
    if (!errors.isEmpty()) {
        return response.status(400).json({ errors: errors.array() });
    }
    try {
        const status = parseInt(request.body.status, 10);
        if (![1, 2, 3].includes(status)) {
            return response.status(400).json("Status inválido");
        }
        const testCase = await TestCaseService.find(id);
        if (!testCase) {
            return response.status(404).json("Caso de Teste não encontrado");
        }
        const access = await ensureProjectAccess(request, response, testCase.projectId, {
            allowRoles: ["owner", "manager"],
        });
        if (!access) return;
        const project = await ProjectService.find(testCase.projectId);
        if (!project?.approvalEnabled || !project.approvalTestCaseEnabled) {
            return response.status(400).json("Workflow de aprovação não habilitado");
        }
        const userId = request.user?.id;
        const isManager = await db.involvement.findFirst({
            where: {
                projectId: testCase.projectId,
                userId,
                type: 2,
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
        if (status === 2) {
            updatePayload.reviewedAt = new Date();
            updatePayload.reviewedById = userId;
            updatePayload.approvedAt = null;
            updatePayload.approvedById = null;
        }
        if (status === 3) {
            updatePayload.approvedAt = new Date();
            updatePayload.approvedById = userId;
        }
        const updatedTestCase = await TestCaseService.update(id, updatePayload);
        return response.status(200).json(updatedTestCase);
    } catch (error: any) {
        return response.status(500).json(error.message);
    }
});

testCaseRouter.post("/:id/assign", token.authMiddleware, tenantMiddleware, body("userIds").isArray(), async (request: Request, response: Response) => {
    // #swagger.tags = ['TestCases']
    // #swagger.description = 'Designa testadores para um caso de teste.'
    if (!requireSystemAccess(request, response, USER_ACCESS_LEVEL)) return;
    const id: number = parseInt(request.params.id);
    const errors = validationResult(request);
    if (!errors.isEmpty()) {
        return response.status(400).json({ errors: errors.array() });
    }
    try {
        const testCase = await TestCaseService.find(id);
        if (!testCase) {
            return response.status(404).json("Caso de Teste não encontrado");
        }
        const access = await ensureProjectAccess(request, response, testCase.projectId, {
            allowRoles: ["owner", "manager"],
        });
        if (!access) return;
        const project = await ProjectService.find(testCase.projectId);
        if (!project) {
            return response.status(404).json("Projeto não encontrado");
        }
        const userId = request.user?.id;
        const isManager = await db.involvement.findFirst({
            where: {
                projectId: testCase.projectId,
                userId,
                type: 2,
            },
        });
        if (project.creatorId !== userId && !isManager) {
            return response.status(403).json("Você não tem permissão para designar testadores");
        }
        const userIds = (request.body.userIds as number[]).filter(Boolean);
        await db.testCaseAssignment.deleteMany({ where: { testCaseId: id } });
        if (userIds.length) {
            await db.testCaseAssignment.createMany({
                data: userIds.map((assignedUserId) => ({
                    testCaseId: id,
                    userId: assignedUserId,
                    assignedById: userId ?? null,
                })),
            });
            if (project.approvalEnabled && project.approvalTestCaseEnabled && testCase.approvalStatus !== 3) {
                await TestCaseService.update(id, {
                    approvalStatus: 3,
                    approvedAt: new Date(),
                    approvedById: userId ?? null,
                });
            }
        }
        const updated = await TestCaseService.find(id);
        return response.status(200).json(updated);
    } catch (error: any) {
        return response.status(500).json(error.message);
    }
});

testCaseRouter.put("/:id", token.authMiddleware, tenantMiddleware, body("name").isString(), body("data").isObject(), async (request: Request, response: Response) => {
    // #swagger.tags = ['TestCases']
    // #swagger.description = 'Atualiza um caso de teste (sem execucoes).'
    if (!requireSystemAccess(request, response, USER_ACCESS_LEVEL)) return;
    const id: number = parseInt(request.params.id);
    const errors = validationResult(request);
    if (!errors.isEmpty()) {
        return response.status(400).json({ errors: errors.array() });
    }
    try {
        const testCase = await TestCaseService.find(id);
        if (!testCase) {
            return response.status(404).json("Caso de Teste não encontrado");
        }
        const access = await ensureProjectAccess(request, response, testCase.projectId, {
            allowRoles: ["owner", "manager"],
        });
        if (!access) return;
        const userId = request.user?.id;
        const project = await ProjectService.find(testCase.projectId);
        if (!project) {
            return response.status(404).json("Projeto não encontrado");
        }
        const isManager = await db.involvement.findFirst({
            where: {
                projectId: testCase.projectId,
                userId,
                type: 2,
            },
        });
        if (project.creatorId !== userId && !isManager) {
            return response.status(403).json("Você não tem permissão para editar casos de teste");
        }
        const executionCount = await db.testExecution.count({ where: { testCaseId: id } });
        if (executionCount > 0) {
            return response.status(409).json("Não é possível editar um caso com execuções");
        }
        if (request.body.testScenarioId) {
            const scenario = await db.testScenario.findUnique({
                where: { id: parseInt(String(request.body.testScenarioId), 10) },
                select: { approvalStatus: true, projectId: true },
            });
            if (!scenario || scenario.projectId !== testCase.projectId || scenario.approvalStatus !== 3) {
                return response.status(409).json("Cenario de Teste ainda nao aprovado");
            }
        }
        const updatePayload: any = { ...request.body };
        if (updatePayload.dueDate) {
            updatePayload.dueDate = new Date(updatePayload.dueDate);
        }
        const updateTestCase = await TestCaseService.update(id, updatePayload);

        if (project?.organizationId) {
            dispatchEvent(project.organizationId, "test_case.updated", {
                id: updateTestCase.id,
                projectId: updateTestCase.projectId,
                name: updateTestCase.name,
            }).catch(console.error);
        }

        return response.status(200).json(updateTestCase);
    } catch (error: any) {
        return response.status(500).json(error.message);
    }
});
