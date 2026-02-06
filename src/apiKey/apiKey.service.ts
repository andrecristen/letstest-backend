import crypto from "crypto";
import { db } from "../utils/db.server";
import { getPlan } from "../billing/plans.config";
import { features } from "../utils/features";

export type ApiKeyScope = "read" | "write" | "test_executions" | "projects" | "test_cases";

const API_KEY_PREFIX = "lt_";

export const generateApiKey = (): { key: string; hash: string; prefix: string } => {
  const randomBytes = crypto.randomBytes(32).toString("hex");
  const key = `${API_KEY_PREFIX}${randomBytes}`;
  const hash = crypto.createHash("sha256").update(key).digest("hex");
  const prefix = key.substring(0, 12);
  return { key, hash, prefix };
};

export const hashApiKey = (key: string): string => {
  return crypto.createHash("sha256").update(key).digest("hex");
};

export const create = async (data: {
  organizationId: number;
  name: string;
  scopes: ApiKeyScope[];
  expiresAt?: Date | null;
  createdById: number;
}) => {
  const { key, hash, prefix } = generateApiKey();

  const apiKey = await db.apiKey.create({
    data: {
      organizationId: data.organizationId,
      name: data.name,
      keyHash: hash,
      keyPrefix: prefix,
      scopes: data.scopes,
      expiresAt: data.expiresAt ?? null,
      createdById: data.createdById,
    },
  });

  return {
    ...apiKey,
    key,
  };
};

export const findByOrganization = async (organizationId: number) => {
  return db.apiKey.findMany({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      keyPrefix: true,
      scopes: true,
      lastUsedAt: true,
      expiresAt: true,
      createdAt: true,
      createdById: true,
    },
  });
};

export const findById = async (id: number) => {
  return db.apiKey.findUnique({
    where: { id },
    select: {
      id: true,
      organizationId: true,
      name: true,
      keyPrefix: true,
      scopes: true,
      lastUsedAt: true,
      expiresAt: true,
      createdAt: true,
      createdById: true,
    },
  });
};

export const findByKey = async (key: string) => {
  const hash = hashApiKey(key);
  return db.apiKey.findUnique({
    where: { keyHash: hash },
    include: {
      organization: {
        select: {
          id: true,
          name: true,
          slug: true,
          plan: true,
        },
      },
    },
  });
};

export const updateLastUsed = async (id: number) => {
  return db.apiKey.update({
    where: { id },
    data: { lastUsedAt: new Date() },
  });
};

export const remove = async (id: number) => {
  return db.apiKey.delete({
    where: { id },
  });
};

export const update = async (
  id: number,
  data: { name?: string; scopes?: ApiKeyScope[]; expiresAt?: Date | null }
) => {
  return db.apiKey.update({
    where: { id },
    data,
  });
};

export const validateApiAccess = async (
  organizationId: number
): Promise<{ allowed: boolean; planKey: string; organization: { id: number; name: string; slug: string } | null }> => {
  const organization = await db.organization.findUnique({
    where: { id: organizationId },
    select: { id: true, name: true, slug: true, plan: true },
  });

  if (!features.billingEnabled) {
    return {
      allowed: true,
      planKey: organization?.plan ?? "free",
      organization: organization ? { id: organization.id, name: organization.name, slug: organization.slug } : null,
    };
  }

  // Keep consistent with billing.service: Organization.plan is the source of truth.
  const planKey = organization?.plan ?? "free";
  const plan = getPlan(planKey);
  return {
    allowed: plan.features.apiAccess,
    planKey,
    organization: organization ? { id: organization.id, name: organization.name, slug: organization.slug } : null,
  };
};

export const countByOrganization = async (organizationId: number): Promise<number> => {
  return db.apiKey.count({ where: { organizationId } });
};
