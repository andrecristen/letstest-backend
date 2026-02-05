import express from "express";
import type { Request, Response } from "express";
import { token } from "../utils/token.server";
import { tenantMiddleware } from "../utils/tenant.middleware";
import { features } from "../utils/features";
import { PlanKey, plans } from "./plans.config";
import { createCheckoutSession, createPortalSession, getSubscriptionSummary, getUsageSummary, handleStripeWebhook } from "./billing.service";
import { stripe, stripeConfig } from "./stripe.server";

interface RequestWithRawBody extends Request {
  rawBody?: Buffer;
}

export const billingRouter = express.Router();

billingRouter.get("/plans", token.authMiddleware, tenantMiddleware, async (_request: Request, response: Response) => {
  return response.status(200).json(Object.values(plans));
});

billingRouter.get("/subscription", token.authMiddleware, tenantMiddleware, async (request: Request, response: Response) => {
  try {
    const organizationId = request.organizationId!;
    const summary = await getSubscriptionSummary(organizationId);
    return response.status(200).json(summary);
  } catch (error: any) {
    return response.status(500).json({ error: error.message });
  }
});

billingRouter.get("/usage", token.authMiddleware, tenantMiddleware, async (request: Request, response: Response) => {
  try {
    const organizationId = request.organizationId!;
    const summary = await getUsageSummary(organizationId);
    return response.status(200).json(summary);
  } catch (error: any) {
    return response.status(500).json({ error: error.message });
  }
});

billingRouter.post("/checkout", token.authMiddleware, tenantMiddleware, async (request: Request, response: Response) => {
  try {
    if (!features.billingEnabled) {
      return response.status(400).json({ error: "Billing disabled" });
    }
    const planKey = String(request.body.plan || "").toLowerCase() as PlanKey;
    if (!["pro", "enterprise"].includes(planKey)) {
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
  try {
    if (!features.billingEnabled) {
      return response.status(400).json({ error: "Billing disabled" });
    }
    const organizationId = request.organizationId!;
    const session = await createPortalSession(organizationId);
    return response.status(200).json({ url: session.url });
  } catch (error: any) {
    return response.status(500).json({ error: error.message });
  }
});

billingRouter.post("/webhook", async (request: RequestWithRawBody, response: Response) => {
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
