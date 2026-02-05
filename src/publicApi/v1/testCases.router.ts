import express from "express";
import type { Request, Response } from "express";
import { body, validationResult } from "express-validator";
import { apiKeyMiddleware, requireScope } from "../../utils/apiKey.middleware";
import { buildPaginatedResponse, getPaginationParams } from "../../utils/pagination";
import { db } from "../../utils/db.server";
import * as TestCaseService from "../../testCase/testCase.service";
import * as ProjectService from "../../project/project.service";
import { dispatchEvent } from "../../webhook/webhook.service";

export const publicTestCaseRouter = express.Router();

publicTestCaseRouter.get(
  "/",
  apiKeyMiddleware,
  requireScope("read", "test_cases"),
  async (request: Request, response: Response) => {
    // #swagger.tags = ['Public API - Test Cases']
    // #swagger.description = 'Lista casos de teste da organizacao via API publica.'
    try {
      const organizationId = request.organizationId!;
      const pagination = getPaginationParams(request.query);
      const projectId = request.query.projectId ? parseInt(String(request.query.projectId)) : undefined;

      const where: any = {
        project: { organizationId },
      };

      if (projectId) {
        where.projectId = projectId;
      }

      const result = await TestCaseService.findByPaged(where, pagination);
      return response.status(200).json(
        buildPaginatedResponse(result.data, result.total, pagination.page, pagination.limit)
      );
    } catch (error: any) {
      return response.status(500).json({ error: error.message });
    }
  }
);

publicTestCaseRouter.get(
  "/:id",
  apiKeyMiddleware,
  requireScope("read", "test_cases"),
  async (request: Request, response: Response) => {
    // #swagger.tags = ['Public API - Test Cases']
    // #swagger.description = 'Busca um caso de teste por id via API publica.'
    try {
      const organizationId = request.organizationId!;
      const id = parseInt(request.params.id);
      const testCase = await TestCaseService.find(id);

      if (!testCase) {
        return response.status(404).json({ error: "Test case not found" });
      }

      const project = await ProjectService.find(testCase.projectId);
      if (!project || project.organizationId !== organizationId) {
        return response.status(404).json({ error: "Test case not found" });
      }

      return response.status(200).json(testCase);
    } catch (error: any) {
      return response.status(500).json({ error: error.message });
    }
  }
);

publicTestCaseRouter.post(
  "/",
  apiKeyMiddleware,
  requireScope("write", "test_cases"),
  body("projectId").isNumeric(),
  body("name").isString().notEmpty(),
  body("data").isObject(),
  async (request: Request, response: Response) => {
    // #swagger.tags = ['Public API - Test Cases']
    // #swagger.description = 'Cria um caso de teste via API publica.'
    const errors = validationResult(request);
    if (!errors.isEmpty()) {
      return response.status(400).json({ errors: errors.array() });
    }
    try {
      const organizationId = request.organizationId!;
      const { projectId, name, data, testScenarioId, environmentId, dueDate } = request.body;

      const project = await ProjectService.find(projectId);
      if (!project || project.organizationId !== organizationId) {
        return response.status(404).json({ error: "Project not found" });
      }

      const testCaseData: any = {
        projectId,
        name,
        data,
        testScenarioId: testScenarioId ?? null,
        environmentId: environmentId ?? null,
        approvalStatus: 3,
      };

      if (dueDate) {
        testCaseData.dueDate = new Date(dueDate);
      }

      const newTestCase = await TestCaseService.create(testCaseData);

      dispatchEvent(organizationId, "test_case.created", {
        id: newTestCase.id,
        projectId: newTestCase.projectId,
        name: newTestCase.name,
      }).catch(console.error);

      return response.status(201).json(newTestCase);
    } catch (error: any) {
      return response.status(500).json({ error: error.message });
    }
  }
);

publicTestCaseRouter.put(
  "/:id",
  apiKeyMiddleware,
  requireScope("write", "test_cases"),
  body("name").optional().isString(),
  body("data").optional().isObject(),
  async (request: Request, response: Response) => {
    // #swagger.tags = ['Public API - Test Cases']
    // #swagger.description = 'Atualiza um caso de teste via API publica.'
    try {
      const organizationId = request.organizationId!;
      const id = parseInt(request.params.id);

      const testCase = await TestCaseService.find(id);
      if (!testCase) {
        return response.status(404).json({ error: "Test case not found" });
      }

      const project = await ProjectService.find(testCase.projectId);
      if (!project || project.organizationId !== organizationId) {
        return response.status(404).json({ error: "Test case not found" });
      }

      const executionCount = await db.testExecution.count({ where: { testCaseId: id } });
      if (executionCount > 0) {
        return response.status(409).json({ error: "Cannot edit a test case with executions" });
      }

      const { name, data, testScenarioId, environmentId, dueDate } = request.body;
      const updatePayload: any = {};

      if (name !== undefined) updatePayload.name = name;
      if (data !== undefined) updatePayload.data = data;
      if (testScenarioId !== undefined) updatePayload.testScenarioId = testScenarioId;
      if (environmentId !== undefined) updatePayload.environmentId = environmentId;
      if (dueDate !== undefined) updatePayload.dueDate = dueDate ? new Date(dueDate) : null;

      const updated = await TestCaseService.update(id, updatePayload);

      dispatchEvent(organizationId, "test_case.updated", {
        id: updated.id,
        projectId: updated.projectId,
        name: updated.name,
      }).catch(console.error);

      return response.status(200).json(updated);
    } catch (error: any) {
      return response.status(500).json({ error: error.message });
    }
  }
);
