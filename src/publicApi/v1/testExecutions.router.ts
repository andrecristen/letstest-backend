import express from "express";
import type { Request, Response } from "express";
import { body, validationResult } from "express-validator";
import { apiKeyMiddleware, requireScope } from "../../utils/apiKey.middleware";
import { buildPaginatedResponse, getPaginationParams } from "../../utils/pagination";
import { db } from "../../utils/db.server";
import * as TestExecutionService from "../../testExecution/testExecution.service";
import * as TestCaseService from "../../testCase/testCase.service";
import * as ProjectService from "../../project/project.service";
import { dispatchEvent } from "../../webhook/webhook.service";

export const publicTestExecutionRouter = express.Router();

publicTestExecutionRouter.get(
  "/",
  apiKeyMiddleware,
  requireScope("read", "test_executions"),
  async (request: Request, response: Response) => {
    // #swagger.tags = ['Public API - Test Executions']
    // #swagger.description = 'Lista execucoes de teste da organizacao via API publica.'
    try {
      const organizationId = request.organizationId!;
      const pagination = getPaginationParams(request.query);
      const testCaseId = request.query.testCaseId ? parseInt(String(request.query.testCaseId)) : undefined;
      const projectId = request.query.projectId ? parseInt(String(request.query.projectId)) : undefined;

      const where: any = {
        testCase: {
          project: { organizationId },
        },
      };

      if (testCaseId) {
        where.testCaseId = testCaseId;
      }

      if (projectId) {
        where.testCase = { ...where.testCase, projectId };
      }

      const result = await TestExecutionService.findByPaged(where, pagination);
      return response.status(200).json(
        buildPaginatedResponse(result.data, result.total, pagination.page, pagination.limit)
      );
    } catch (error: any) {
      return response.status(500).json({ error: error.message });
    }
  }
);

publicTestExecutionRouter.get(
  "/:id",
  apiKeyMiddleware,
  requireScope("read", "test_executions"),
  async (request: Request, response: Response) => {
    // #swagger.tags = ['Public API - Test Executions']
    // #swagger.description = 'Busca uma execucao de teste por id via API publica.'
    try {
      const organizationId = request.organizationId!;
      const id = parseInt(request.params.id);
      const execution = await db.testExecution.findUnique({
        where: { id },
        include: {
          testCase: { select: { projectId: true } },
          user: { select: { id: true, name: true } },
          device: { select: { id: true, model: true, brand: true } },
        },
      });

      if (!execution || !execution.testCase) {
        return response.status(404).json({ error: "Test execution not found" });
      }

      const project = await ProjectService.find(execution.testCase.projectId);
      if (!project || project.organizationId !== organizationId) {
        return response.status(404).json({ error: "Test execution not found" });
      }

      return response.status(200).json(execution);
    } catch (error: any) {
      return response.status(500).json({ error: error.message });
    }
  }
);

publicTestExecutionRouter.post(
  "/",
  apiKeyMiddleware,
  requireScope("write", "test_executions"),
  body("testCaseId").isNumeric(),
  body("data").isObject(),
  body("testTime").isNumeric(),
  async (request: Request, response: Response) => {
    // #swagger.tags = ['Public API - Test Executions']
    // #swagger.description = 'Cria uma execucao de teste via API publica.'
    const errors = validationResult(request);
    if (!errors.isEmpty()) {
      return response.status(400).json({ errors: errors.array() });
    }
    try {
      const organizationId = request.organizationId!;
      const { testCaseId, data, testTime, deviceId } = request.body;

      const testCase = await db.testCase.findUnique({
        where: { id: testCaseId },
        select: { id: true, projectId: true, name: true },
      });

      if (!testCase) {
        return response.status(404).json({ error: "Test case not found" });
      }

      const project = await ProjectService.find(testCase.projectId);
      if (!project || project.organizationId !== organizationId) {
        return response.status(404).json({ error: "Test case not found" });
      }

      const apiUser = await db.user.findFirst({
        where: {
          memberships: {
            some: { organizationId, role: "owner" },
          },
        },
      });

      if (!apiUser) {
        return response.status(500).json({ error: "No owner found for organization" });
      }

      const executionData = {
        testCaseId,
        data,
        testTime: parseInt(String(testTime)),
        userId: apiUser.id,
        deviceId: deviceId ?? null,
        reported: new Date(),
      };

      const newExecution = await TestExecutionService.create(executionData);

      dispatchEvent(organizationId, "test_execution.created", {
        id: newExecution.id,
        testCaseId: newExecution.testCaseId,
        projectId: testCase.projectId,
        testCaseName: testCase.name,
      }).catch(console.error);

      return response.status(201).json(newExecution);
    } catch (error: any) {
      return response.status(500).json({ error: error.message });
    }
  }
);

publicTestExecutionRouter.get(
  "/:id/reports",
  apiKeyMiddleware,
  requireScope("read", "test_executions"),
  async (request: Request, response: Response) => {
    // #swagger.tags = ['Public API - Test Executions']
    // #swagger.description = 'Lista avaliacoes de uma execucao via API publica.'
    try {
      const organizationId = request.organizationId!;
      const id = parseInt(request.params.id);

      const execution = await db.testExecution.findUnique({
        where: { id },
        include: {
          testCase: { select: { projectId: true } },
          reports: true,
        },
      });

      if (!execution || !execution.testCase) {
        return response.status(404).json({ error: "Test execution not found" });
      }

      const project = await ProjectService.find(execution.testCase.projectId);
      if (!project || project.organizationId !== organizationId) {
        return response.status(404).json({ error: "Test execution not found" });
      }

      return response.status(200).json(execution.reports);
    } catch (error: any) {
      return response.status(500).json({ error: error.message });
    }
  }
);
