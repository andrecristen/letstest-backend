export type PlanKey = "free" | "pro" | "enterprise";
export type MetricKey = "seats" | "projects" | "test_cases" | "storage_bytes" | "test_executions";

export type PlanLimits = Record<MetricKey, number | null>;

export type PlanDefinition = {
  key: PlanKey;
  name: string;
  priceMonthlyCents: number | null;
  limits: PlanLimits;
  features: {
    apiAccess: boolean;
    webhooks: number | null;
    auditLogsDays: number | null;
  };
};

const MB = 1024 * 1024;
const GB = 1024 * 1024 * 1024;

export const plans: Record<PlanKey, PlanDefinition> = {
  free: {
    key: "free",
    name: "Free",
    priceMonthlyCents: 0,
    limits: {
      seats: 3,
      projects: 2,
      test_cases: 50,
      storage_bytes: 500 * MB,
      test_executions: 200,
    },
    features: {
      apiAccess: false,
      webhooks: 0,
      auditLogsDays: 0,
    },
  },
  pro: {
    key: "pro",
    name: "Pro",
    priceMonthlyCents: 9900,
    limits: {
      seats: 15,
      projects: 20,
      test_cases: 500,
      storage_bytes: 10 * GB,
      test_executions: 5000,
    },
    features: {
      apiAccess: true,
      webhooks: 5,
      auditLogsDays: 30,
    },
  },
  enterprise: {
    key: "enterprise",
    name: "Enterprise",
    priceMonthlyCents: 29900,
    limits: {
      seats: null,
      projects: null,
      test_cases: null,
      storage_bytes: 100 * GB,
      test_executions: null,
    },
    features: {
      apiAccess: true,
      webhooks: null,
      auditLogsDays: 365,
    },
  },
};

export const getPlan = (plan: string | null | undefined): PlanDefinition => {
  const key = (plan || "free").toLowerCase() as PlanKey;
  return plans[key] ?? plans.free;
};
