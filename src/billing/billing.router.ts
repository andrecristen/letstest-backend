import express from "express";
import type { Request, Response } from "express";
import { token } from "../utils/token.server";
import { db } from "../utils/db.server";
import { tenantMiddleware } from "../utils/tenant.middleware";
import { requireOrgRole, requireSystemAccess, USER_ACCESS_LEVEL } from "../utils/permissions";
import { features } from "../utils/features";
import { PlanKey } from "./plans.config";
import { createCheckoutSession, createPortalSession, getBillingPlans, getSubscriptionSummary, getUsageSummary, handleStripeWebhook, syncPlansFromStripe } from "./billing.service";
import { stripe, stripeConfig } from "./stripe.server";

interface RequestWithRawBody extends Request {
  rawBody?: Buffer;
}

export const billingRouter = express.Router();

billingRouter.get("/plans", token.authMiddleware, tenantMiddleware, async (request: Request, response: Response) => {
  // #swagger.tags = ['Billing']
  // #swagger.description = 'Lista planos de assinatura disponiveis.'
  if (!requireSystemAccess(request, response, USER_ACCESS_LEVEL)) return;
  try {
    const plans = await getBillingPlans();
    return response.status(200).json(plans);
  } catch (error: any) {
    return response.status(500).json({ error: error.message });
  }
});

billingRouter.get("/subscription", token.authMiddleware, tenantMiddleware, async (request: Request, response: Response) => {
  // #swagger.tags = ['Billing']
  // #swagger.description = 'Retorna resumo da assinatura da organizacao.'
  if (!requireSystemAccess(request, response, USER_ACCESS_LEVEL)) return;
  try {
    if (!requireOrgRole(request, response, ["owner", "admin"])) return;
    const organizationId = request.organizationId!;
    const summary = await getSubscriptionSummary(organizationId);
    return response.status(200).json(summary);
  } catch (error: any) {
    return response.status(500).json({ error: error.message });
  }
});

billingRouter.get("/usage", token.authMiddleware, tenantMiddleware, async (request: Request, response: Response) => {
  // #swagger.tags = ['Billing']
  // #swagger.description = 'Retorna resumo de uso da organizacao.'
  if (!requireSystemAccess(request, response, USER_ACCESS_LEVEL)) return;
  try {
    if (!requireOrgRole(request, response, ["owner", "admin"])) return;
    const organizationId = request.organizationId!;
    const summary = await getUsageSummary(organizationId);
    return response.status(200).json(summary);
  } catch (error: any) {
    return response.status(500).json({ error: error.message });
  }
});

billingRouter.post("/checkout", token.authMiddleware, tenantMiddleware, async (request: Request, response: Response) => {
  // #swagger.tags = ['Billing']
  // #swagger.description = 'Cria sessao de checkout no Stripe.'
  if (!requireSystemAccess(request, response, USER_ACCESS_LEVEL)) return;
  try {
    if (!requireOrgRole(request, response, ["owner", "admin"])) return;
    if (!features.billingEnabled) {
      return response.status(400).json({ error: "Billing disabled" });
    }
    const planKey = String(request.body.plan || "").trim().toLowerCase() as PlanKey;
    if (!planKey) {
      return response.status(400).json({ error: "Plano inválido" });
    }
    const plan = await db.billingPlan.findUnique({
      where: { key: planKey },
      select: { active: true, stripePriceId: true },
    });
    if (!plan?.active || !plan.stripePriceId) {
      return response.status(400).json({ error: "Plano inválido" });
    }
    const organizationId = request.organizationId!;
    const session = await createCheckoutSession(organizationId, planKey);
    return response.status(200).json({ url: session.url });
  } catch (error: any) {
    return response.status(500).json({ error: error.message });
  }
});

billingRouter.post("/portal", token.authMiddleware, tenantMiddleware, async (request: Request, response: Response) => {
  // #swagger.tags = ['Billing']
  // #swagger.description = 'Cria sessao do portal de billing no Stripe.'
  if (!requireSystemAccess(request, response, USER_ACCESS_LEVEL)) return;
  try {
    if (!requireOrgRole(request, response, ["owner", "admin"])) return;
    if (!features.billingEnabled) {
      return response.status(400).json({ error: "Billing disabled" });
    }
    const rawReturnUrl = request.body?.returnUrl;
    let returnUrl: string | undefined;
    if (rawReturnUrl !== undefined && rawReturnUrl !== null) {
      if (typeof rawReturnUrl !== "string" || !rawReturnUrl.trim()) {
        return response.status(400).json({ error: "returnUrl inválida" });
      }
      try {
        const parsed = new URL(rawReturnUrl);
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
          return response.status(400).json({ error: "returnUrl inválida" });
        }
      } catch {
        return response.status(400).json({ error: "returnUrl inválida" });
      }
      returnUrl = rawReturnUrl;
    }
    const organizationId = request.organizationId!;
    const session = await createPortalSession(organizationId, returnUrl);
    return response.status(200).json({ url: session.url });
  } catch (error: any) {
    return response.status(500).json({ error: error.message });
  }
});

billingRouter.post("/plans/sync", token.authMiddleware, tenantMiddleware, async (request: Request, response: Response) => {
  // #swagger.tags = ['Billing']
  // #swagger.description = 'Sincroniza planos a partir do Stripe.'
  if (!requireSystemAccess(request, response, USER_ACCESS_LEVEL)) return;
  try {
    if (!requireOrgRole(request, response, ["owner", "admin"])) return;
    if (!features.billingEnabled) {
      return response.status(400).json({ error: "Billing disabled" });
    }
    const plans = await syncPlansFromStripe();
    return response.status(200).json({ synced: plans.length, plans });
  } catch (error: any) {
    return response.status(500).json({ error: error.message });
  }
});

billingRouter.post("/webhook", async (request: RequestWithRawBody, response: Response) => {
  // #swagger.tags = ['Billing']
  // #swagger.description = 'Recebe webhook do Stripe.'
  if (!stripeConfig.webhookSecret) {
    return response.status(400).json({ error: "Webhook secret not configured" });
  }
  const sig = request.headers["stripe-signature"];
  if (!sig || typeof sig !== "string") {
    return response.status(400).json({ error: "Missing signature" });
  }
  try {
    const rawBody = request.rawBody ?? Buffer.from(JSON.stringify(request.body ?? {}));
    const event = stripe.webhooks.constructEvent(rawBody, sig, stripeConfig.webhookSecret);
    await handleStripeWebhook(event);
    return response.status(200).json({ received: true });
  } catch (error: any) {
    return response.status(400).json({ error: error.message });
  }
});
