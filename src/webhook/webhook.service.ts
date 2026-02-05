import crypto from "crypto";
import { db } from "../utils/db.server";
import { getPlan } from "../billing/plans.config";
import { features } from "../utils/features";

export type WebhookEvent =
  | "test_execution.created"
  | "test_execution.reported"
  | "report.created"
  | "test_case.created"
  | "test_case.updated"
  | "test_scenario.created"
  | "involvement.accepted";

const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAYS = [60000, 300000, 900000]; // 1min, 5min, 15min

export const generateSecret = (): string => {
  return `whsec_${crypto.randomBytes(24).toString("hex")}`;
};

export const signPayload = (payload: string, secret: string): string => {
  const timestamp = Math.floor(Date.now() / 1000);
  const signedPayload = `${timestamp}.${payload}`;
  const signature = crypto
    .createHmac("sha256", secret)
    .update(signedPayload)
    .digest("hex");
  return `t=${timestamp},v1=${signature}`;
};

export const create = async (data: {
  organizationId: number;
  url: string;
  events: WebhookEvent[];
}) => {
  const secret = generateSecret();
  return db.webhook.create({
    data: {
      organizationId: data.organizationId,
      url: data.url,
      secret,
      events: data.events,
      active: true,
    },
  });
};

export const findByOrganization = async (organizationId: number) => {
  return db.webhook.findMany({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      url: true,
      events: true,
      active: true,
      createdAt: true,
      _count: {
        select: { deliveries: true },
      },
    },
  });
};

export const findById = async (id: number) => {
  return db.webhook.findUnique({
    where: { id },
  });
};

export const update = async (
  id: number,
  data: { url?: string; events?: WebhookEvent[]; active?: boolean }
) => {
  return db.webhook.update({
    where: { id },
    data,
  });
};

export const remove = async (id: number) => {
  await db.webhookDelivery.deleteMany({ where: { webhookId: id } });
  return db.webhook.delete({ where: { id } });
};

export const regenerateSecret = async (id: number) => {
  const secret = generateSecret();
  return db.webhook.update({
    where: { id },
    data: { secret },
  });
};

export const getDeliveries = async (webhookId: number, limit = 50) => {
  return db.webhookDelivery.findMany({
    where: { webhookId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
};

export const validateWebhookAccess = async (
  organizationId: number
): Promise<{ allowed: boolean; limit: number | null }> => {
  if (!features.billingEnabled) {
    return { allowed: true, limit: null };
  }
  const subscription = await db.subscription.findUnique({
    where: { organizationId },
  });
  const plan = getPlan(subscription?.plan);
  const webhookLimit = plan.features.webhooks;

  if (webhookLimit === 0) {
    return { allowed: false, limit: 0 };
  }

  return { allowed: true, limit: webhookLimit };
};

export const countByOrganization = async (organizationId: number): Promise<number> => {
  return db.webhook.count({ where: { organizationId } });
};

export const dispatchEvent = async (
  organizationId: number,
  event: WebhookEvent,
  payload: Record<string, any>
) => {
  const webhooks = await db.webhook.findMany({
    where: {
      organizationId,
      active: true,
      events: { has: event },
    },
  });

  for (const webhook of webhooks) {
    await createDelivery(webhook.id, event, payload, webhook.secret, webhook.url);
  }
};

const createDelivery = async (
  webhookId: number,
  event: string,
  payload: Record<string, any>,
  secret: string,
  url: string
) => {
  const delivery = await db.webhookDelivery.create({
    data: {
      webhookId,
      event,
      payload,
      attempts: 0,
    },
  });

  deliverWebhook(delivery.id, url, payload, secret, event).catch(console.error);
};

const deliverWebhook = async (
  deliveryId: number,
  url: string,
  payload: Record<string, any>,
  secret: string,
  event: string
) => {
  const body = JSON.stringify(payload);
  const signature = signPayload(body, secret);

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Webhook-Event": event,
        "X-Webhook-Signature": signature,
      },
      body,
      signal: controller.signal,
    });

    clearTimeout(timeout);

    const responseBody = await response.text().catch(() => "");

    await db.webhookDelivery.update({
      where: { id: deliveryId },
      data: {
        responseStatus: response.status,
        responseBody: responseBody.substring(0, 1000),
        deliveredAt: new Date(),
        attempts: { increment: 1 },
        nextRetryAt: null,
      },
    });

    if (!response.ok) {
      await scheduleRetry(deliveryId);
    }
  } catch (error: any) {
    await db.webhookDelivery.update({
      where: { id: deliveryId },
      data: {
        responseStatus: 0,
        responseBody: error.message?.substring(0, 1000) ?? "Unknown error",
        attempts: { increment: 1 },
      },
    });

    await scheduleRetry(deliveryId);
  }
};

const scheduleRetry = async (deliveryId: number) => {
  const delivery = await db.webhookDelivery.findUnique({
    where: { id: deliveryId },
  });

  if (!delivery || delivery.attempts >= MAX_RETRY_ATTEMPTS) {
    return;
  }

  const delay = RETRY_DELAYS[delivery.attempts - 1] || RETRY_DELAYS[RETRY_DELAYS.length - 1];
  const nextRetryAt = new Date(Date.now() + delay);

  await db.webhookDelivery.update({
    where: { id: deliveryId },
    data: { nextRetryAt },
  });
};

export const retryPendingDeliveries = async () => {
  const pendingDeliveries = await db.webhookDelivery.findMany({
    where: {
      nextRetryAt: { lte: new Date() },
      attempts: { lt: MAX_RETRY_ATTEMPTS },
    },
    include: {
      webhook: true,
    },
  });

  for (const delivery of pendingDeliveries) {
    if (!delivery.webhook.active) continue;

    deliverWebhook(
      delivery.id,
      delivery.webhook.url,
      delivery.payload as Record<string, any>,
      delivery.webhook.secret,
      delivery.event
    ).catch(console.error);
  }
};
