export type PlanKey = string;
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
