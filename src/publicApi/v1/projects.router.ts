import express from "express";
import type { Request, Response } from "express";
import { apiKeyMiddleware, requireScope } from "../../utils/apiKey.middleware";
import { buildPaginatedResponse, getPaginationParams } from "../../utils/pagination";
import * as ProjectService from "../../project/project.service";

export const publicProjectRouter = express.Router();

publicProjectRouter.get(
  "/",
  apiKeyMiddleware,
  requireScope("read", "projects"),
  async (request: Request, response: Response) => {
    // #swagger.tags = ['Public API - Projects']
    // #swagger.description = 'Lista projetos da organizacao via API publica.'
    try {
      const organizationId = request.organizationId!;
      const pagination = getPaginationParams(request.query);
      const result = await ProjectService.findByPaged({ organizationId }, pagination);
      return response.status(200).json(
        buildPaginatedResponse(result.data, result.total, pagination.page, pagination.limit)
      );
    } catch (error: any) {
      return response.status(500).json({ error: error.message });
    }
  }
);

publicProjectRouter.get(
  "/:id",
  apiKeyMiddleware,
  requireScope("read", "projects"),
  async (request: Request, response: Response) => {
    // #swagger.tags = ['Public API - Projects']
    // #swagger.description = 'Busca um projeto por id via API publica.'
    try {
      const organizationId = request.organizationId!;
      const id = parseInt(request.params.id);
      const project = await ProjectService.find(id);

      if (!project || project.organizationId !== organizationId) {
        return response.status(404).json({ error: "Project not found" });
      }

      return response.status(200).json(project);
    } catch (error: any) {
      return response.status(500).json({ error: error.message });
    }
  }
);

publicProjectRouter.get(
  "/:id/overview",
  apiKeyMiddleware,
  requireScope("read", "projects"),
  async (request: Request, response: Response) => {
    // #swagger.tags = ['Public API - Projects']
    // #swagger.description = 'Retorna resumo do projeto via API publica.'
    try {
      const organizationId = request.organizationId!;
      const id = parseInt(request.params.id);
      const project = await ProjectService.find(id);

      if (!project || project.organizationId !== organizationId) {
        return response.status(404).json({ error: "Project not found" });
      }

      const overview = await ProjectService.findOverview(id);
      return response.status(200).json(overview);
    } catch (error: any) {
      return response.status(500).json({ error: error.message });
    }
  }
);
