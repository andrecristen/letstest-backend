import express from "express";
import type { Request, Response } from "express";
import { body, validationResult } from "express-validator";
import { token } from "../utils/token.server";
import { buildPaginatedResponse, getPaginationParams } from "../utils/pagination";
import { tenantMiddleware } from "../utils/tenant.middleware";
import { ensureProjectAccess, getProjectIdByTestExecution, requireSystemAccess, USER_ACCESS_LEVEL } from "../utils/permissions";

import * as ReportService from "./report.service";
import * as NotificationService from "../notification/notification.service";
import { db } from "../utils/db.server";
import { dispatchEvent } from "../webhook/webhook.service";

export const reportRouter = express.Router();

reportRouter.get("/test-execution/:testExecutionId", token.authMiddleware, tenantMiddleware, async (request: Request, response: Response) => {
    // #swagger.tags = ['Reports']
    // #swagger.description = 'Lista relatorios de uma execucao de teste (paginado).'
    if (!requireSystemAccess(request, response, USER_ACCESS_LEVEL)) return;
    const testExecutionId: number = parseInt(request.params.testExecutionId);
    try {
        const projectId = await getProjectIdByTestExecution(testExecutionId);
        if (!projectId) {
            return response.status(404).json({ error: "Execução de testes não encontrada" });
        }
        const access = await ensureProjectAccess(request, response, projectId, {
            allowRoles: ["owner", "manager", "tester"],
        });
        if (!access) return;
        const pagination = getPaginationParams(request.query);
        const where: any = { testExecutionId };
        if (access.role === "tester") {
            where.userId = request.user?.id;
        }
        const result = await ReportService.findByPaged(where, pagination);
        return response.status(200).json(
            buildPaginatedResponse(result.data, result.total, pagination.page, pagination.limit)
        );
    } catch (error: any) {
        return response.status(500).json(error.message);
    }
});

reportRouter.post("/:testExecutionId", token.authMiddleware, tenantMiddleware, body("type").isNumeric(), body("score").isNumeric(), body("commentary").isString(), async (request: Request, response: Response) => {
    // #swagger.tags = ['Reports']
    // #swagger.description = 'Cria um relatorio para uma execucao de teste.'
    if (!requireSystemAccess(request, response, USER_ACCESS_LEVEL)) return;
    const errors = validationResult(request);
    if (!errors.isEmpty()) {
        return response.status(400).json({ errors: errors.array() });
    }
    try {
        const userId = request.user?.id;
        if (!userId) {
            return response.status(404).json({ error: "Usuário da avaliação não autenticado" });
        }
        const testExecutionId: number = parseInt(request.params.testExecutionId);
        if (!testExecutionId) {
            return response.status(404).json({ error: "Execução do Caso de Teste não definida" });
        }
        const projectId = await getProjectIdByTestExecution(testExecutionId);
        if (!projectId) {
            return response.status(404).json({ error: "Execução de testes não encontrada" });
        }
        const access = await ensureProjectAccess(request, response, projectId, {
            allowRoles: ["owner", "manager", "tester"],
        });
        if (!access) return;
        const testExecutionData = { ...request.body, testExecutionId, userId };
        const newReport = await ReportService.create(testExecutionData);
        if (newReport.type === ReportService.ReportType.rejected) {
            await NotificationService.notifyExecutionRejected(testExecutionId, newReport.id);
        }

        const execution = await db.testExecution.findUnique({
            where: { id: testExecutionId },
            select: { testCase: { select: { project: { select: { organizationId: true } } } } },
        });
        if (execution?.testCase?.project?.organizationId) {
            dispatchEvent(execution.testCase.project.organizationId, "report.created", {
                id: newReport.id,
                testExecutionId,
                type: newReport.type,
                score: newReport.score,
            }).catch(console.error);
        }

        return response.status(201).json(newReport);
    } catch (error: any) {
        return response.status(500).json(error.message);
    }
});
