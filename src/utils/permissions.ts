import type { Request, Response } from "express";
import { db } from "./db.server";
import { ProjectVisibilityEnum } from "../project/project.service";
import { InvolvementType } from "../involvement/involvement.service";

export type OrganizationRole = "owner" | "admin" | "member";
export type ProjectRole = "owner" | "manager" | "tester" | "none";

const resolveProjectRole = (
  creatorId: number,
  userId: number,
  involvementType?: number | null
): ProjectRole => {
  if (creatorId === userId) return "owner";
  if (involvementType === InvolvementType.manager) return "manager";
  if (involvementType === InvolvementType.tester) return "tester";
  return "none";
};

export const requireOrgRole = (
  req: Request,
  res: Response,
  allowed: OrganizationRole[]
): boolean => {
  const role = req.organizationRole as OrganizationRole | undefined;
  if (!role || !allowed.includes(role)) {
    res.status(403).json({ error: "Permissão insuficiente" });
    return false;
  }
  return true;
};

export const getProjectAccess = async (params: {
  projectId: number;
  userId: number;
  organizationId: number;
}) => {
  const { projectId, userId, organizationId } = params;

  const [project, involvement] = await Promise.all([
    db.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        creatorId: true,
        organizationId: true,
        visibility: true,
        approvalEnabled: true,
        approvalScenarioEnabled: true,
        approvalTestCaseEnabled: true,
      },
    }),
    db.involvement.findFirst({
      where: { projectId, userId },
      select: { type: true },
    }),
  ]);

  if (!project || project.organizationId !== organizationId) {
    return null;
  }

  const role = resolveProjectRole(project.creatorId, userId, involvement?.type ?? null);
  return { project, role };
};

export const ensureProjectAccess = async (
  req: Request,
  res: Response,
  projectId: number,
  options: {
    allowRoles: ProjectRole[];
    allowPublic?: boolean;
  }
) => {
  const userId = req.user?.id;
  const organizationId = req.organizationId;

  if (!userId || !organizationId) {
    res.status(401).json({ error: "Usuário ou organização não identificados" });
    return null;
  }

  const access = await getProjectAccess({ projectId, userId, organizationId });
  if (!access) {
    res.status(404).json({ error: "Projeto não encontrado" });
    return null;
  }

  const { project, role } = access;
  const isAllowedRole = options.allowRoles.includes(role);
  const isPublic = options.allowPublic && project.visibility === ProjectVisibilityEnum.public;

  if (!isAllowedRole && !isPublic) {
    res.status(403).json({ error: "Permissão insuficiente" });
    return null;
  }

  return access;
};

export const getProjectIdByTestCase = async (testCaseId: number) => {
  const testCase = await db.testCase.findUnique({
    where: { id: testCaseId },
    select: { projectId: true },
  });
  return testCase?.projectId ?? null;
};

export const getProjectIdByTestScenario = async (testScenarioId: number) => {
  const scenario = await db.testScenario.findUnique({
    where: { id: testScenarioId },
    select: { projectId: true },
  });
  return scenario?.projectId ?? null;
};

export const getProjectIdByEnvironment = async (environmentId: number) => {
  const environment = await db.environment.findUnique({
    where: { id: environmentId },
    select: { projectId: true },
  });
  return environment?.projectId ?? null;
};

export const getProjectIdByTestExecution = async (testExecutionId: number) => {
  const execution = await db.testExecution.findUnique({
    where: { id: testExecutionId },
    select: { testCase: { select: { projectId: true } } },
  });
  return execution?.testCase?.projectId ?? null;
};

export const getProjectIdByReport = async (reportId: number) => {
  const report = await db.report.findUnique({
    where: { id: reportId },
    select: { testExecution: { select: { testCase: { select: { projectId: true } } } } },
  });
  return report?.testExecution?.testCase?.projectId ?? null;
};
