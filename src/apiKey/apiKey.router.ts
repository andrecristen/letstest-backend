import express from "express";
import type { Request, Response } from "express";
import { body, validationResult } from "express-validator";
import { token } from "../utils/token.server";
import { tenantMiddleware } from "../utils/tenant.middleware";
import { requireOrgRole } from "../utils/permissions";

import * as ApiKeyService from "./apiKey.service";

export const apiKeyRouter = express.Router();

apiKeyRouter.get("/", token.authMiddleware, tenantMiddleware, async (request: Request, response: Response) => {
  // #swagger.tags = ['ApiKeys']
  // #swagger.description = 'Lista API keys da organizacao.'
  try {
    const organizationId = request.organizationId!;
    if (!requireOrgRole(request, response, ["owner", "admin"])) return;
    const access = await ApiKeyService.validateApiAccess(organizationId);
    if (!access.allowed) {
      const orgLabel = access.organization?.name ?? `org ${organizationId}`;
      return response.status(403).json({
        error: `API access not available on your plan (plan: ${access.planKey}, organization: ${orgLabel})`,
      });
    }
    const apiKeys = await ApiKeyService.findByOrganization(organizationId);
    return response.status(200).json(apiKeys);
  } catch (error: any) {
    return response.status(500).json({ error: error.message });
  }
});

apiKeyRouter.post(
  "/",
  token.authMiddleware,
  tenantMiddleware,
  body("name").isString().notEmpty(),
  body("scopes").isArray(),
  async (request: Request, response: Response) => {
    // #swagger.tags = ['ApiKeys']
    // #swagger.description = 'Cria uma nova API key.'
    const errors = validationResult(request);
    if (!errors.isEmpty()) {
      return response.status(400).json({ errors: errors.array() });
    }
    try {
      const organizationId = request.organizationId!;
      if (!requireOrgRole(request, response, ["owner", "admin"])) return;
      const userId = request.user?.id;

      const access = await ApiKeyService.validateApiAccess(organizationId);
      if (!access.allowed) {
        const orgLabel = access.organization?.name ?? `org ${organizationId}`;
        return response.status(403).json({
          error: `API access not available on your plan (plan: ${access.planKey}, organization: ${orgLabel})`,
        });
      }

      const { name, scopes, expiresAt } = request.body;
      const apiKey = await ApiKeyService.create({
        organizationId,
        name,
        scopes,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        createdById: userId,
      });

      return response.status(201).json(apiKey);
    } catch (error: any) {
      return response.status(500).json({ error: error.message });
    }
  }
);

apiKeyRouter.put(
  "/:id",
  token.authMiddleware,
  tenantMiddleware,
  body("name").optional().isString(),
  body("scopes").optional().isArray(),
  async (request: Request, response: Response) => {
    // #swagger.tags = ['ApiKeys']
    // #swagger.description = 'Atualiza uma API key.'
  try {
    const organizationId = request.organizationId!;
    if (!requireOrgRole(request, response, ["owner", "admin"])) return;
    const id = parseInt(request.params.id);

    const existing = await ApiKeyService.findById(id);
    if (!existing || existing.organizationId !== organizationId) {
      return response.status(404).json({ error: "API key not found" });
    }

    const access = await ApiKeyService.validateApiAccess(organizationId);
    if (!access.allowed) {
      const orgLabel = access.organization?.name ?? `org ${organizationId}`;
      return response.status(403).json({
        error: `API access not available on your plan (plan: ${access.planKey}, organization: ${orgLabel})`,
      });
    }

    const { name, scopes, expiresAt } = request.body;
    const updated = await ApiKeyService.update(id, {
      name,
      scopes,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      });

      return response.status(200).json(updated);
    } catch (error: any) {
      return response.status(500).json({ error: error.message });
    }
  }
);

apiKeyRouter.delete("/:id", token.authMiddleware, tenantMiddleware, async (request: Request, response: Response) => {
  // #swagger.tags = ['ApiKeys']
  // #swagger.description = 'Remove uma API key.'
  try {
    const organizationId = request.organizationId!;
    if (!requireOrgRole(request, response, ["owner", "admin"])) return;
    const id = parseInt(request.params.id);

    const existing = await ApiKeyService.findById(id);
    if (!existing || existing.organizationId !== organizationId) {
      return response.status(404).json({ error: "API key not found" });
    }

    const access = await ApiKeyService.validateApiAccess(organizationId);
    if (!access.allowed) {
      const orgLabel = access.organization?.name ?? `org ${organizationId}`;
      return response.status(403).json({
        error: `API access not available on your plan (plan: ${access.planKey}, organization: ${orgLabel})`,
      });
    }

    await ApiKeyService.remove(id);
    return response.status(200).json({ success: true });
  } catch (error: any) {
    return response.status(500).json({ error: error.message });
  }
});
