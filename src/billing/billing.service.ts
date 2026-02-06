import { db } from "../utils/db.server";
import { features } from "../utils/features";
import { getPlan, MetricKey, PlanDefinition, PlanKey, PlanLimits, plans } from "./plans.config";
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

const parseNullableNumber = (value?: string | number | null): number | null | undefined => {
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

const parseBoolean = (value?: string | boolean | null): boolean | undefined => {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "boolean") return value;
  const normalized = String(value).trim().toLowerCase();
  if (normalized === "true" || normalized === "1") return true;
  if (normalized === "false" || normalized === "0") return false;
  return undefined;
};

const normalizePlanKey = (value?: string | null): PlanKey | null => {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === "free" || normalized === "pro" || normalized === "enterprise") {
    return normalized as PlanKey;
  }
  if (normalized.includes("enterprise")) return "enterprise";
  if (normalized.includes("pro")) return "pro";
  if (normalized.includes("free")) return "free";
  return null;
};

const limitKeys: MetricKey[] = ["seats", "projects", "test_cases", "storage_bytes", "test_executions"];
const featureKeys: Array<keyof PlanDefinition["features"]> = [
  "apiAccess",
  "webhooks",
  "auditLogsDays",
];

const normalizeDbPlanKey = (value?: string | null): string | null => {
  if (!value) return null;
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return normalized || null;
};

const parseLimitsFromMetadata = (
  metadata: Stripe.Metadata
): Partial<PlanLimits> => {
  const limits: Partial<PlanLimits> = {};
  const rawJson = metadata.limits;
  if (rawJson) {
    try {
      const parsed = JSON.parse(rawJson) as Record<string, unknown>;
      Object.entries(parsed).forEach(([key, value]) => {
        const parsedValue = parseNullableNumber(value as string | number | null);
        if (parsedValue !== undefined) {
          limits[key as MetricKey] = parsedValue;
        }
      });
    } catch {
      // Ignore malformed JSON and fall back to per-field metadata.
    }
  }

  limitKeys.forEach((metric) => {
    const raw = metadata[`limits_${metric}`];
    const parsed = parseNullableNumber(raw ?? undefined);
    if (parsed !== undefined) {
      limits[metric] = parsed;
    }
  });

  return limits;
};

const parseFeaturesFromMetadata = (
  metadata: Stripe.Metadata
): Partial<PlanDefinition["features"]> => {
  const features: Partial<PlanDefinition["features"]> = {};
  const rawJson = metadata.features;
  if (rawJson) {
    try {
      const parsed = JSON.parse(rawJson) as Record<string, unknown>;
      if (parsed.apiAccess !== undefined) {
        const apiAccess = parseBoolean(parsed.apiAccess as string | boolean | null);
        if (apiAccess !== undefined) features.apiAccess = apiAccess;
      }
      if (parsed.webhooks !== undefined) {
        const webhooks = parseNullableNumber(parsed.webhooks as string | number | null);
        if (webhooks !== undefined) features.webhooks = webhooks;
      }
      if (parsed.auditLogsDays !== undefined) {
        const auditLogsDays = parseNullableNumber(parsed.auditLogsDays as string | number | null);
        if (auditLogsDays !== undefined) features.auditLogsDays = auditLogsDays;
      }
    } catch {
      // Ignore malformed JSON and fall back to per-field metadata.
    }
  }

  const apiAccess = parseBoolean(metadata.features_apiAccess);
  if (apiAccess !== undefined) features.apiAccess = apiAccess;
  const webhooks = parseNullableNumber(metadata.features_webhooks);
  if (webhooks !== undefined) features.webhooks = webhooks;
  const auditLogsDays = parseNullableNumber(metadata.features_auditLogsDays);
  if (auditLogsDays !== undefined) features.auditLogsDays = auditLogsDays;

  return features;
};

const hasAllKeys = (value: Record<string, unknown>, keys: string[]) =>
  keys.every((key) => Object.prototype.hasOwnProperty.call(value, key));

export const isPlanConfigured = (params: {
  stripePriceId?: string | null;
  limits?: Record<string, unknown> | null;
  features?: Record<string, unknown> | null;
}) => {
  if (!params.stripePriceId) return false;
  if (!params.limits || !params.features) return false;
  const limitsOk = hasAllKeys(params.limits, limitKeys);
  const featuresOk = hasAllKeys(params.features, featureKeys as string[]);
  return limitsOk && featuresOk;
};

const buildPlanDefinition = (
  planKey: PlanKey,
  overrides: Partial<PlanDefinition>
): PlanDefinition => {
  const base = getPlan(planKey);
  return {
    ...base,
    ...overrides,
    limits: { ...base.limits, ...(overrides.limits ?? {}) },
    features: { ...base.features, ...(overrides.features ?? {}) },
  };
};

const mapDbPlanToDefinition = (plan: {
  key: string;
  name: string;
  priceMonthlyCents: number | null;
  limits: PlanLimits;
  features: PlanDefinition["features"];
}): PlanDefinition | null => {
  const planKey = normalizePlanKey(plan.key);
  if (!planKey) return null;
  return buildPlanDefinition(planKey, {
    name: plan.name,
    priceMonthlyCents: plan.priceMonthlyCents,
    limits: plan.limits,
    features: plan.features,
  });
};

export const getBillingPlans = async (): Promise<PlanDefinition[]> => {
  if (!features.billingEnabled) {
    return Object.values(plans);
  }

  let storedPlans = await db.billingPlan.findMany({
    where: { active: true, configured: true },
    select: {
      key: true,
      name: true,
      priceMonthlyCents: true,
      limits: true,
      features: true,
    },
  });

  if (storedPlans.length === 0) {
    await syncPlansFromStripe({ allowEmpty: true });
    storedPlans = await db.billingPlan.findMany({
      where: { active: true, configured: true },
      select: {
        key: true,
        name: true,
        priceMonthlyCents: true,
        limits: true,
        features: true,
      },
    });
  }

  const mapped = storedPlans
    .map((plan) => mapDbPlanToDefinition(plan as any))
    .filter((plan): plan is PlanDefinition => !!plan);

  const existingKeys = new Set(mapped.map((plan) => plan.key));
  Object.values(plans).forEach((plan) => {
    if (!existingKeys.has(plan.key)) {
      mapped.push(plan);
    }
  });

  return mapped.sort((a, b) => {
    const aPrice = a.priceMonthlyCents ?? Number.MAX_SAFE_INTEGER;
    const bPrice = b.priceMonthlyCents ?? Number.MAX_SAFE_INTEGER;
    return aPrice - bPrice;
  });
};

export const syncPlansFromStripe = async (
  options: { allowEmpty?: boolean } = {}
) => {
  if (!features.billingEnabled) {
    throw new Error("Billing disabled");
  }

  const products = await stripe.products.list({ active: true, limit: 100 });
  const prices = await stripe.prices.list({
    active: true,
    limit: 100,
    type: "recurring",
  });

  const pricesByProduct = new Map<string, Stripe.Price>();
  prices.data.forEach((price) => {
    if (!price.product || typeof price.product !== "string") return;
    const isMonthly = price.recurring?.interval === "month";
    if (!isMonthly) return;
    if (!pricesByProduct.has(price.product)) {
      pricesByProduct.set(price.product, price);
    }
  });

  const productKeys = products.data
    .map((product) =>
      normalizeDbPlanKey(
        product.metadata.plan_key ?? product.metadata.key ?? product.metadata.plan ?? product.name
      ) ?? product.id
    )
    .filter((key): key is string => !!key);

  const existingPlans = await db.billingPlan.findMany({
    where: { key: { in: productKeys } },
    select: {
      id: true,
      key: true,
      name: true,
      priceMonthlyCents: true,
      limits: true,
      features: true,
      configured: true,
      stripePriceId: true,
    },
  });

  const existingByKey = new Map(existingPlans.map((plan) => [plan.key, plan]));
  const syncedPlans: PlanDefinition[] = [];

  for (const product of products.data) {
    const rawKey =
      product.metadata.plan_key ?? product.metadata.key ?? product.metadata.plan ?? product.name;
    const dbKey = normalizeDbPlanKey(rawKey) ?? product.id;
    if (!dbKey) continue;

    const price = pricesByProduct.get(product.id);
    const parsedLimits = parseLimitsFromMetadata(product.metadata);
    const parsedFeatures = parseFeaturesFromMetadata(product.metadata);
    const priceMonthlyCents = price?.unit_amount ?? null;

    const existing = existingByKey.get(dbKey);
    const limits = existing?.configured ? (existing.limits as PlanLimits) : parsedLimits;
    const features = existing?.configured
      ? (existing.features as PlanDefinition["features"])
      : parsedFeatures;
    const name = existing?.configured ? existing.name : product.name;
    const effectivePrice = existing?.configured ? existing.priceMonthlyCents : priceMonthlyCents;
    const configured =
      existing?.configured ||
      isPlanConfigured({
        stripePriceId: price?.id ?? existing?.stripePriceId ?? null,
        limits: limits as Record<string, unknown>,
        features: features as Record<string, unknown>,
      });

    await db.billingPlan.upsert({
      where: { key: dbKey },
      create: {
        key: dbKey,
        name,
        stripeProductId: product.id,
        stripePriceId: price?.id,
        priceMonthlyCents: effectivePrice,
        limits,
        features,
        configured,
        active: product.active ?? true,
      },
      update: {
        name,
        stripeProductId: product.id,
        stripePriceId: price?.id,
        priceMonthlyCents: effectivePrice,
        limits,
        features,
        configured,
        active: product.active ?? true,
      },
    });

    const normalizedPlanKey = normalizePlanKey(dbKey);
    if (normalizedPlanKey) {
      const planDefinition = buildPlanDefinition(normalizedPlanKey, {
        name,
        priceMonthlyCents: effectivePrice,
        limits: (limits as PlanLimits) ?? getPlan(normalizedPlanKey).limits,
        features: (features as PlanDefinition["features"]) ?? getPlan(normalizedPlanKey).features,
      });
      syncedPlans.push(planDefinition);
    }
  }

  if (!options.allowEmpty && syncedPlans.length === 0) {
    throw new Error("No Stripe plans found to sync");
  }

  return syncedPlans;
};

const getPlanDefinitionByKey = async (planKey: PlanKey): Promise<PlanDefinition> => {
  const storedPlan = await db.billingPlan.findUnique({
    where: { key: planKey },
    select: {
      key: true,
      name: true,
      priceMonthlyCents: true,
      limits: true,
      features: true,
    },
  });

  if (storedPlan) {
    const mapped = mapDbPlanToDefinition(storedPlan as any);
    if (mapped) return mapped;
  }

  return getPlan(planKey);
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
  return getPlanDefinitionByKey((organization?.plan ?? "free") as PlanKey);
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

export const assertSeatInviteWithinLimit = async (
  organizationId: number,
  increment: number = 1
) => {
  if (!features.billingEnabled) return;
  const plan = await getEffectivePlan(organizationId);
  const limit = plan.limits.seats;
  if (limit === null) return;

  const [members, pendingInvites] = await Promise.all([
    db.organizationMember.count({ where: { organizationId } }),
    db.organizationInvite.count({
      where: {
        organizationId,
        acceptedAt: null,
        expiresAt: { gt: new Date() },
      },
    }),
  ]);

  const current = members + pendingInvites;
  const next = current + increment;
  if (next > limit) {
    throw new LimitExceededError("seats", current, limit);
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

const getStripePriceId = async (plan: PlanKey) => {
  const storedPlan = await db.billingPlan.findUnique({
    where: { key: plan },
    select: { stripePriceId: true },
  });
  if (storedPlan?.stripePriceId) return storedPlan.stripePriceId;
  if (plan === "pro") return stripeConfig.pricePro;
  if (plan === "enterprise") return stripeConfig.priceEnterprise;
  return "";
};

export const createCheckoutSession = async (organizationId: number, planKey: PlanKey) => {
  if (!features.billingEnabled) {
    throw new Error("Billing disabled");
  }
  const subscription = await getOrCreateSubscription(organizationId);
  const priceId = await getStripePriceId(planKey);
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
