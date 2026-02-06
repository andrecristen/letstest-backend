import express from "express";
import type { Request, Response } from "express";
import { body, validationResult } from "express-validator";
import { token } from "../utils/token.server";
import { tenantMiddleware } from "../utils/tenant.middleware";
import { requireOrgRole, requireSystemAccess, USER_ACCESS_LEVEL } from "../utils/permissions";

import * as WebhookService from "./webhook.service";

export const webhookRouter = express.Router();

const VALID_EVENTS: WebhookService.WebhookEvent[] = [
  "test_execution.created",
  "test_execution.reported",
  "report.created",
  "test_case.created",
  "test_case.updated",
  "test_scenario.created",
  "involvement.accepted",
];

webhookRouter.get("/events", token.authMiddleware, async (request: Request, response: Response) => {
  // #swagger.tags = ['Webhooks']
  // #swagger.description = 'Lista eventos de webhook disponiveis.'
  if (!requireSystemAccess(request, response, USER_ACCESS_LEVEL)) return;
  return response.status(200).json(VALID_EVENTS);
});

webhookRouter.get("/", token.authMiddleware, tenantMiddleware, async (request: Request, response: Response) => {
  // #swagger.tags = ['Webhooks']
  // #swagger.description = 'Lista webhooks da organizacao.'
  if (!requireSystemAccess(request, response, USER_ACCESS_LEVEL)) return;
  try {
    const organizationId = request.organizationId!;
    if (!requireOrgRole(request, response, ["owner", "admin"])) return;
    const { allowed, limit, planKey, organization } = await WebhookService.validateWebhookAccess(organizationId);
    if (!allowed) {
      const orgLabel = organization?.name ?? `org ${organizationId}`;
      return response.status(403).json({
        error: `Webhooks not available on your plan (plan: ${planKey}, organization: ${orgLabel})`,
      });
    }
    const webhooks = await WebhookService.findByOrganization(organizationId);
    return response.status(200).json({ webhooks, limit });
  } catch (error: any) {
    return response.status(500).json({ error: error.message });
  }
});

webhookRouter.post(
  "/",
  token.authMiddleware,
  tenantMiddleware,
  body("url").isURL(),
  body("events").isArray().notEmpty(),
  async (request: Request, response: Response) => {
    // #swagger.tags = ['Webhooks']
    // #swagger.description = 'Cria um novo webhook.'
    if (!requireSystemAccess(request, response, USER_ACCESS_LEVEL)) return;
    const errors = validationResult(request);
    if (!errors.isEmpty()) {
      return response.status(400).json({ errors: errors.array() });
    }
    try {
      const organizationId = request.organizationId!;
      if (!requireOrgRole(request, response, ["owner", "admin"])) return;
      const { allowed, limit, planKey, organization } = await WebhookService.validateWebhookAccess(organizationId);

      if (!allowed) {
        const orgLabel = organization?.name ?? `org ${organizationId}`;
        return response.status(403).json({
          error: `Webhooks not available on your plan (plan: ${planKey}, organization: ${orgLabel})`,
        });
      }

      if (limit !== null) {
        const currentCount = await WebhookService.countByOrganization(organizationId);
        if (currentCount >= limit) {
          return response.status(402).json({
            code: "LIMIT_EXCEEDED",
            metric: "webhooks",
            current: currentCount,
            limit,
          });
        }
      }

      const { url, events } = request.body;

      const invalidEvents = events.filter((e: string) => !VALID_EVENTS.includes(e as any));
      if (invalidEvents.length > 0) {
        return response.status(400).json({ error: `Invalid events: ${invalidEvents.join(", ")}` });
      }

      const webhook = await WebhookService.create({
        organizationId,
        url,
        events,
      });

      return response.status(201).json(webhook);
    } catch (error: any) {
      return response.status(500).json({ error: error.message });
    }
  }
);

webhookRouter.put(
  "/:id",
  token.authMiddleware,
  tenantMiddleware,
  async (request: Request, response: Response) => {
    // #swagger.tags = ['Webhooks']
    // #swagger.description = 'Atualiza um webhook.'
    if (!requireSystemAccess(request, response, USER_ACCESS_LEVEL)) return;
    try {
      const organizationId = request.organizationId!;
      if (!requireOrgRole(request, response, ["owner", "admin"])) return;
      const id = parseInt(request.params.id);

      const existing = await WebhookService.findById(id);
      if (!existing || existing.organizationId !== organizationId) {
        return response.status(404).json({ error: "Webhook not found" });
      }

      const { url, events, active } = request.body;

      if (events) {
        const invalidEvents = events.filter((e: string) => !VALID_EVENTS.includes(e as any));
        if (invalidEvents.length > 0) {
          return response.status(400).json({ error: `Invalid events: ${invalidEvents.join(", ")}` });
        }
      }

      const updated = await WebhookService.update(id, { url, events, active });
      return response.status(200).json(updated);
    } catch (error: any) {
      return response.status(500).json({ error: error.message });
    }
  }
);

webhookRouter.post(
  "/:id/regenerate-secret",
  token.authMiddleware,
  tenantMiddleware,
  async (request: Request, response: Response) => {
    // #swagger.tags = ['Webhooks']
    // #swagger.description = 'Regenera o secret de um webhook.'
    if (!requireSystemAccess(request, response, USER_ACCESS_LEVEL)) return;
    try {
      const organizationId = request.organizationId!;
      if (!requireOrgRole(request, response, ["owner", "admin"])) return;
      const id = parseInt(request.params.id);

      const existing = await WebhookService.findById(id);
      if (!existing || existing.organizationId !== organizationId) {
        return response.status(404).json({ error: "Webhook not found" });
      }

      const updated = await WebhookService.regenerateSecret(id);
      return response.status(200).json({ secret: updated.secret });
    } catch (error: any) {
      return response.status(500).json({ error: error.message });
    }
  }
);

webhookRouter.get(
  "/:id/deliveries",
  token.authMiddleware,
  tenantMiddleware,
  async (request: Request, response: Response) => {
    // #swagger.tags = ['Webhooks']
    // #swagger.description = 'Lista entregas de um webhook.'
    if (!requireSystemAccess(request, response, USER_ACCESS_LEVEL)) return;
    try {
      const organizationId = request.organizationId!;
      if (!requireOrgRole(request, response, ["owner", "admin"])) return;
      const id = parseInt(request.params.id);

      const existing = await WebhookService.findById(id);
      if (!existing || existing.organizationId !== organizationId) {
        return response.status(404).json({ error: "Webhook not found" });
      }

      const deliveries = await WebhookService.getDeliveries(id);
      return response.status(200).json(deliveries);
    } catch (error: any) {
      return response.status(500).json({ error: error.message });
    }
  }
);

webhookRouter.delete("/:id", token.authMiddleware, tenantMiddleware, async (request: Request, response: Response) => {
  // #swagger.tags = ['Webhooks']
  // #swagger.description = 'Remove um webhook.'
  if (!requireSystemAccess(request, response, USER_ACCESS_LEVEL)) return;
  try {
    const organizationId = request.organizationId!;
    if (!requireOrgRole(request, response, ["owner", "admin"])) return;
    const id = parseInt(request.params.id);

    const existing = await WebhookService.findById(id);
    if (!existing || existing.organizationId !== organizationId) {
      return response.status(404).json({ error: "Webhook not found" });
    }

    await WebhookService.remove(id);
    return response.status(200).json({ success: true });
  } catch (error: any) {
    return response.status(500).json({ error: error.message });
  }
});
