import express from "express";
import type { Request, Response } from "express";
import { db } from "../utils/db.server";
import { token } from "../utils/token.server";
import { requireSystemAccess } from "../utils/permissions";
import { isPlanConfigured, syncPlansFromStripe } from "./billing.service";
import type { MetricKey } from "./plans.config";

const limitKeys: MetricKey[] = ["seats", "projects", "test_cases", "storage_bytes", "test_executions"];
const featureKeys = ["apiAccess", "webhooks", "auditLogsDays"] as const;

const parseNullableNumber = (value: unknown): number | null | undefined => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value === "number" && !Number.isNaN(value)) return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "" || normalized === "undefined") return undefined;
    if (normalized === "null" || normalized === "unlimited") return null;
    const parsed = Number(normalized);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return undefined;
};

const parseBoolean = (value: unknown): boolean | undefined => {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "boolean") return value;
  const normalized = String(value).trim().toLowerCase();
  if (normalized === "true" || normalized === "1") return true;
  if (normalized === "false" || normalized === "0") return false;
  return undefined;
};

export const billingAdminRouter = express.Router();

billingAdminRouter.get("/billing/plans", token.authMiddleware, async (request: Request, response: Response) => {
  if (!requireSystemAccess(request, response)) return;
  try {
    const plans = await db.billingPlan.findMany({
      orderBy: { name: "asc" },
    });
    return response.status(200).json(plans);
  } catch (error: any) {
    return response.status(500).json({ error: error.message });
  }
});

billingAdminRouter.post("/billing/plans/sync", token.authMiddleware, async (request: Request, response: Response) => {
  if (!requireSystemAccess(request, response)) return;
  try {
    const plans = await syncPlansFromStripe({ allowEmpty: true });
    return response.status(200).json({ synced: plans.length });
  } catch (error: any) {
    return response.status(500).json({ error: error.message });
  }
});

billingAdminRouter.patch("/billing/plans/:id", token.authMiddleware, async (request: Request, response: Response) => {
  if (!requireSystemAccess(request, response)) return;
  const id = Number(request.params.id);
  if (!Number.isFinite(id)) {
    return response.status(400).json({ error: "ID inválido" });
  }

  try {
    const existing = await db.billingPlan.findUnique({ where: { id } });
    if (!existing) {
      return response.status(404).json({ error: "Plano não encontrado" });
    }

    const data: Record<string, unknown> = {};

    if ("name" in request.body) {
      const name = String(request.body.name ?? "").trim();
      if (!name) {
        return response.status(400).json({ error: "Nome inválido" });
      }
      data.name = name;
    }

    if ("priceMonthlyCents" in request.body) {
      const raw = request.body.priceMonthlyCents;
      const parsed = raw === null ? null : parseNullableNumber(raw);
      if (parsed === undefined) {
        return response.status(400).json({ error: "Preço inválido" });
      }
      data.priceMonthlyCents = parsed;
    }

    if ("active" in request.body) {
      data.active = Boolean(request.body.active);
    }

    if ("limits" in request.body) {
      const limitsInput = request.body.limits;
      if (!limitsInput || typeof limitsInput !== "object") {
        return response.status(400).json({ error: "Limits inválido" });
      }
      const normalizedLimits = {} as Record<MetricKey, number | null>;
      for (const key of limitKeys) {
        if (!(key in limitsInput)) {
          return response.status(400).json({ error: `Limits incompleto: ${key}` });
        }
        const parsed = parseNullableNumber((limitsInput as any)[key]);
        if (parsed === undefined) {
          return response.status(400).json({ error: `Limits inválido: ${key}` });
        }
        normalizedLimits[key] = parsed;
      }
      data.limits = normalizedLimits;
    }

    if ("features" in request.body) {
      const featuresInput = request.body.features;
      if (!featuresInput || typeof featuresInput !== "object") {
        return response.status(400).json({ error: "Features inválido" });
      }
      const apiAccess = parseBoolean((featuresInput as any).apiAccess);
      if (apiAccess === undefined) {
        return response.status(400).json({ error: "Features inválido: apiAccess" });
      }
      const webhooks = parseNullableNumber((featuresInput as any).webhooks);
      if (webhooks === undefined) {
        return response.status(400).json({ error: "Features inválido: webhooks" });
      }
      const auditLogsDays = parseNullableNumber((featuresInput as any).auditLogsDays);
      if (auditLogsDays === undefined) {
        return response.status(400).json({ error: "Features inválido: auditLogsDays" });
      }
      data.features = { apiAccess, webhooks, auditLogsDays };

      const missing = featureKeys.filter((key) => !(key in (data.features as any)));
      if (missing.length > 0) {
        return response.status(400).json({ error: `Features incompleto: ${missing.join(", ")}` });
      }
    }

    const nextLimits = (data.limits ?? existing.limits) as Record<string, unknown>;
    const nextFeatures = (data.features ?? existing.features) as Record<string, unknown>;
    data.configured = isPlanConfigured({
      stripePriceId: existing.stripePriceId,
      limits: nextLimits,
      features: nextFeatures,
    });

    const updated = await db.billingPlan.update({
      where: { id },
      data,
    });
    return response.status(200).json(updated);
  } catch (error: any) {
    return response.status(500).json({ error: error.message });
  }
});
