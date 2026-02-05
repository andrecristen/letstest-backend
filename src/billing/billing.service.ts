import { db } from "../utils/db.server";
import { features } from "../utils/features";
import { getPlan, MetricKey, PlanDefinition, PlanKey } from "./plans.config";
import { stripe, stripeConfig } from "./stripe.server";
import type Stripe from "stripe";

export class LimitExceededError extends Error {
  metric: MetricKey;
  current: number;
  limit: number;
  constructor(metric: MetricKey, current: number, limit: number) {
    super("LIMIT_EXCEEDED");
    this.metric = metric;
    this.current = current;
    this.limit = limit;
  }
}

const getOrCreateSubscription = async (organizationId: number) => {
  const existing = await db.subscription.findUnique({ where: { organizationId } });
  if (existing) return existing;
  return db.subscription.create({
    data: {
      organizationId,
      plan: "free",
      status: "active",
    },
  });
};

const getEffectivePlan = async (organizationId: number): Promise<PlanDefinition> => {
  if (!features.billingEnabled) {
    return getPlan("enterprise");
  }
  // Use Organization.plan as source of truth
  const organization = await db.organization.findUnique({
    where: { id: organizationId },
    select: { plan: true },
  });
  return getPlan(organization?.plan ?? "free");
};

const getMonthRange = () => {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0));
  return { start };
};

const getStorageUsage = async (subscriptionId: number) => {
  const aggregate = await db.usageRecord.aggregate({
    where: { subscriptionId, metric: "storage_bytes" },
    _sum: { quantity: true },
  });
  return aggregate._sum.quantity ?? 0;
};

const getTestExecutionUsage = async (organizationId: number) => {
  const { start } = getMonthRange();
  return db.testExecution.count({
    where: {
      reported: { gte: start },
      testCase: {
        project: {
          organizationId,
        },
      },
    },
  });
};

const getMetricUsage = async (
  metric: MetricKey,
  organizationId: number,
  projectId?: number
) => {
  switch (metric) {
    case "seats":
      return db.organizationMember.count({ where: { organizationId } });
    case "projects":
      return db.project.count({ where: { organizationId } });
    case "test_cases":
      if (!projectId) return 0;
      return db.testCase.count({ where: { projectId } });
    case "storage_bytes": {
      if (!features.billingEnabled) return 0;
      const subscription = await getOrCreateSubscription(organizationId);
      return getStorageUsage(subscription.id);
    }
    case "test_executions":
      return getTestExecutionUsage(organizationId);
    default:
      return 0;
  }
};

export const assertWithinLimit = async (
  metric: MetricKey,
  params: { organizationId: number; projectId?: number; increment?: number }
) => {
  if (!features.billingEnabled) return;
  const plan = await getEffectivePlan(params.organizationId);
  const limit = plan.limits[metric];
  if (limit === null) return;
  const current = await getMetricUsage(metric, params.organizationId, params.projectId);
  const next = current + (params.increment ?? 1);
  if (next > limit) {
    throw new LimitExceededError(metric, current, limit);
  }
};

export const recordUsage = async (
  organizationId: number,
  metric: MetricKey,
  quantity: number
) => {
  if (!features.billingEnabled) return;
  const subscription = await getOrCreateSubscription(organizationId);
  await db.usageRecord.create({
    data: {
      subscriptionId: subscription.id,
      metric,
      quantity,
    },
  });
};

export const getSubscriptionSummary = async (organizationId: number) => {
  const subscription = await getOrCreateSubscription(organizationId);
  const plan = await getEffectivePlan(organizationId);
  return {
    subscription,
    plan,
  };
};

export const getUsageSummary = async (organizationId: number) => {
  const { plan } = await getSubscriptionSummary(organizationId);
  const subscription = await getOrCreateSubscription(organizationId);
  const seats = await getMetricUsage("seats", organizationId);
  const projects = await getMetricUsage("projects", organizationId);
  const testCasesTotal = await db.testCase.count({
    where: { project: { organizationId } },
  });
  const testExecutions = await getMetricUsage("test_executions", organizationId);
  const storageBytes = features.billingEnabled ? await getStorageUsage(subscription.id) : 0;

  return {
    plan: plan.key,
    limits: plan.limits,
    usage: {
      seats,
      projects,
      test_cases: testCasesTotal,
      storage_bytes: storageBytes,
      test_executions: testExecutions,
    },
  };
};

const getStripePriceId = (plan: PlanKey) => {
  if (plan === "pro") return stripeConfig.pricePro;
  if (plan === "enterprise") return stripeConfig.priceEnterprise;
  return "";
};

export const createCheckoutSession = async (organizationId: number, planKey: PlanKey) => {
  if (!features.billingEnabled) {
    throw new Error("Billing disabled");
  }
  const subscription = await getOrCreateSubscription(organizationId);
  const priceId = getStripePriceId(planKey);
  if (!priceId) {
    throw new Error("Missing price id");
  }

  let customerId = subscription.stripeCustomerId;
  if (!customerId) {
    const organization = await db.organization.findUnique({ where: { id: organizationId } });
    const customer = await stripe.customers.create({
      name: organization?.name ?? `Organization ${organizationId}`,
      metadata: { organizationId: String(organizationId) },
    });
    customerId = customer.id;
    await db.subscription.update({
      where: { id: subscription.id },
      data: { stripeCustomerId: customerId },
    });
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${stripeConfig.successUrl}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: stripeConfig.cancelUrl,
    allow_promotion_codes: true,
    metadata: {
      organizationId: String(organizationId),
      plan: planKey,
    },
  });

  return session;
};

export const createPortalSession = async (organizationId: number) => {
  if (!features.billingEnabled) {
    throw new Error("Billing disabled");
  }
  const subscription = await getOrCreateSubscription(organizationId);
  if (!subscription.stripeCustomerId) {
    throw new Error("Customer not found");
  }
  return stripe.billingPortal.sessions.create({
    customer: subscription.stripeCustomerId,
    return_url: stripeConfig.portalReturnUrl,
  });
};

export const handleStripeWebhook = async (event: Stripe.Event) => {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const organizationId = Number(session.metadata?.organizationId);
      const stripeSubscriptionId = session.subscription as string | null;
      const stripeCustomerId = session.customer as string | null;
      const newPlan = (session.metadata?.plan as PlanKey) ?? "pro";
      if (organizationId && stripeSubscriptionId) {
        await db.subscription.upsert({
          where: { organizationId },
          create: {
            organizationId,
            stripeCustomerId: stripeCustomerId ?? undefined,
            stripeSubscriptionId,
            plan: newPlan,
            status: "active",
          },
          update: {
            stripeCustomerId: stripeCustomerId ?? undefined,
            stripeSubscriptionId,
            plan: newPlan,
            status: "active",
          },
        });
        // Sync Organization.plan with subscription plan
        await db.organization.update({
          where: { id: organizationId },
          data: { plan: newPlan },
        });
      }
      break;
    }
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const stripeSubscriptionId = subscription.id;
      const isCanceled = subscription.status === "canceled" || event.type === "customer.subscription.deleted";
      const status = isCanceled ? "canceled" : subscription.status;
      const currentPeriodStart = subscription.current_period_start
        ? new Date(subscription.current_period_start * 1000)
        : null;
      const currentPeriodEnd = subscription.current_period_end
        ? new Date(subscription.current_period_end * 1000)
        : null;
      const cancelAtPeriodEnd = subscription.cancel_at_period_end ?? false;

      const existingSub = await db.subscription.findFirst({
        where: { stripeSubscriptionId },
        select: { organizationId: true },
      });

      await db.subscription.updateMany({
        where: { stripeSubscriptionId },
        data: {
          status,
          currentPeriodStart,
          currentPeriodEnd,
          cancelAtPeriodEnd,
          ...(isCanceled ? { plan: "free" } : {}),
        },
      });

      // Revert Organization.plan to "free" if subscription is canceled
      if (isCanceled && existingSub?.organizationId) {
        await db.organization.update({
          where: { id: existingSub.organizationId },
          data: { plan: "free" },
        });
      }
      break;
    }
    default:
      break;
  }
};
