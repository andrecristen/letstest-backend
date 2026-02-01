import { db } from "../utils/db.server";
import { sendEmail } from "../utils/email.server";
import * as InvolvementService from "../involvement/involvement.service";
import { ReportType } from "../report/report.service";
import * as NotificationSettingsService from "./notificationSettings.service";
import { getSocketServer } from "../utils/socket.server";

export enum NotificationType {
  ExecutionRejected = 1,
  InviteAccepted = 2,
  DeadlineExceeded = 3,
  DeadlineWarning = 4,
  InviteReceived = 5,
}

type CreateNotificationParams = {
  type: NotificationType;
  title: string;
  message: string;
  userIds: number[];
  projectId?: number;
  metadata?: any;
  sendEmail?: boolean;
  sendInApp?: boolean;
};

export const createNotification = async ({
  type,
  title,
  message,
  userIds,
  projectId,
  metadata,
  sendEmail: sendEmailFlag = true,
  sendInApp = true,
}: CreateNotificationParams) => {
  if (!userIds.length) return null;

  if (!sendInApp) {
    if (!sendEmailFlag) return null;
    const users = await db.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, email: true, name: true },
    });
    await Promise.all(
      users.map(async (user) => {
        if (!user.email) return;
        await sendEmail(user.email, title, message);
      })
    );
    return null;
  }

  const notification = await db.notification.create({
    data: {
      type,
      title,
      message,
      projectId,
      metadata,
      recipients: {
        createMany: {
          data: userIds.map((userId) => ({ userId })),
        },
      },
    },
  });

  const io = getSocketServer();
  if (io) {
    userIds.forEach((userId) => {
      io.to(`user:${userId}`).emit("notification:new", { userId });
    });
    console.info(`[notification] emitted notification:new to ${userIds.length} users`, {
      type,
      projectId,
      userIds,
    });
  } else {
    console.warn("[notification] socket server not available; skipping realtime emit");
  }

  if (sendEmailFlag) {
    const users = await db.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, email: true, name: true },
    });

    await Promise.all(
      users.map(async (user) => {
        if (!user.email) return;
        try {
          await sendEmail(user.email, title, message);
          await db.notificationRecipient.updateMany({
            where: { userId: user.id, notificationId: notification.id },
            data: { emailSentAt: new Date(), emailError: null },
          });
        } catch (error: any) {
          await db.notificationRecipient.updateMany({
            where: { userId: user.id, notificationId: notification.id },
            data: { emailError: String(error?.message ?? "Email send failed") },
          });
        }
      })
    );
  }

  return notification;
};

const uniqueIds = (ids: number[]) => Array.from(new Set(ids)).filter(Boolean);

export const notifyExecutionRejected = async (testExecutionId: number, reportId: number) => {
  const testExecution = await db.testExecution.findUnique({
    where: { id: testExecutionId },
    include: {
      user: { select: { id: true, name: true } },
      testCase: {
        select: {
          id: true,
          name: true,
          projectId: true,
          project: { select: { creatorId: true } },
        },
      },
    },
  });

  if (!testExecution?.testCase?.projectId) return null;

  const projectId = testExecution.testCase.projectId;
  const settings = await NotificationSettingsService.getOrCreateByProject(projectId);
  if (!settings.enableExecutionRejected) return null;
  const managers = await db.involvement.findMany({
    where: {
      projectId,
      type: InvolvementService.InvolvementType.manager,
      situation: InvolvementService.InvolvementSituation.accepted,
    },
    select: { userId: true },
  });

  const recipients = uniqueIds([
    testExecution.user?.id ?? 0,
    testExecution.testCase.project?.creatorId ?? 0,
    ...managers.map((manager) => manager.userId),
  ]);

  const testerName = testExecution.user?.name ?? "Testador";
  const title = "Execucao reprovada";
  const message = `A execucao do caso de teste "${testExecution.testCase.name}" foi reprovada por ${testerName}.`;

  return createNotification({
    type: NotificationType.ExecutionRejected,
    title,
    message,
    userIds: recipients,
    projectId,
    metadata: { testExecutionId, reportId, testCaseId: testExecution.testCase.id },
    sendEmail: settings.notifyEmail,
    sendInApp: settings.notifyInApp,
  });
};

export const notifyInviteAccepted = async (
  involvementId: number,
  previousSituation?: InvolvementService.InvolvementSituation
) => {
  const involvement = await db.involvement.findUnique({
    where: { id: involvementId },
    include: {
      user: { select: { id: true, name: true } },
      project: { select: { id: true, name: true, creatorId: true } },
    },
  });

  if (!involvement?.projectId || !involvement.user?.id) return null;

  const settings = await NotificationSettingsService.getOrCreateByProject(involvement.projectId);
  if (!settings.enableInviteAccepted) return null;

  const userName = involvement.user?.name ?? "Usuario";
  const isApproval = previousSituation === InvolvementService.InvolvementSituation.applied;

  let recipients: number[] = [];
  let title = "Convite aceito";
  let message = `${userName} aceitou o convite para o projeto "${involvement.project?.name ?? ""}".`;

  if (isApproval) {
    recipients = [involvement.user.id];
    title = "Solicitacao aceita";
    message = `Sua solicitacao para participar do projeto "${involvement.project?.name ?? ""}" foi aceita.`;
  } else {
    const managers = await db.involvement.findMany({
      where: {
        projectId: involvement.projectId,
        type: InvolvementService.InvolvementType.manager,
        situation: InvolvementService.InvolvementSituation.accepted,
      },
      select: { userId: true },
    });

    recipients = uniqueIds([
      involvement.project?.creatorId ?? 0,
      ...managers.map((manager) => manager.userId),
    ]).filter((userId) => userId !== involvement.user?.id);
  }

  return createNotification({
    type: NotificationType.InviteAccepted,
    title,
    message,
    userIds: recipients,
    projectId: involvement.projectId,
    metadata: { involvementId, projectId: involvement.projectId, userId: involvement.user?.id },
    sendEmail: settings.notifyEmail,
    sendInApp: settings.notifyInApp,
  });
};

export const notifyInviteReceived = async (involvementId: number) => {
  const involvement = await db.involvement.findUnique({
    where: { id: involvementId },
    include: {
      user: { select: { id: true, name: true } },
      project: { select: { id: true, name: true } },
    },
  });

  if (!involvement?.projectId || !involvement.user?.id) return null;

  const settings = await NotificationSettingsService.getOrCreateByProject(involvement.projectId);
  if (!settings.enableInviteReceived) return null;

  const title = "Novo convite";
  const message = `Voce recebeu um convite para participar do projeto "${involvement.project?.name ?? ""}".`;

  return createNotification({
    type: NotificationType.InviteReceived,
    title,
    message,
    userIds: [involvement.user.id],
    projectId: involvement.projectId,
    metadata: { involvementId, projectId: involvement.projectId, userId: involvement.user.id },
    sendEmail: settings.notifyEmail,
    sendInApp: settings.notifyInApp,
  });
};

const hasExistingDeadlineNotification = async (
  projectId: number,
  testCaseId?: number,
  type?: NotificationType
) => {
  const where: any = {
    type: type ?? NotificationType.DeadlineExceeded,
    projectId,
  };
  if (testCaseId) {
    where.metadata = { path: ["testCaseId"], equals: testCaseId };
  }
  const existing = await db.notification.findFirst({ where });
  return Boolean(existing);
};

export const notifyDeadlineExceeded = async (
  projectId: number,
  dueDate: string,
  triggeredBy?: number,
  testCaseId?: number,
  testCaseName?: string
) => {
  const project = await db.project.findUnique({
    where: { id: projectId },
    select: { id: true, name: true, creatorId: true },
  });

  if (!project) return null;

  const settings = await NotificationSettingsService.getOrCreateByProject(projectId);
  if (!settings.enableDeadlineExceeded) return null;
  if (await hasExistingDeadlineNotification(projectId, testCaseId, NotificationType.DeadlineExceeded)) {
    return null;
  }

  const managers = await db.involvement.findMany({
    where: {
      projectId,
      type: InvolvementService.InvolvementType.manager,
      situation: InvolvementService.InvolvementSituation.accepted,
    },
    select: { userId: true },
  });

  const recipients = uniqueIds([
    project.creatorId,
    ...managers.map((manager) => manager.userId),
  ]);

  const title = "Prazo estourado";
  const targetLabel = testCaseId ? `do caso de teste "${testCaseName ?? ""}"` : `do projeto "${project.name}"`;
  const message = `O prazo ${targetLabel} foi estourado (vencimento em ${dueDate}).`;

  return createNotification({
    type: NotificationType.DeadlineExceeded,
    title,
    message,
    userIds: recipients,
    projectId,
    metadata: { projectId, dueDate, triggeredBy, testCaseId },
    sendEmail: settings.notifyEmail,
    sendInApp: settings.notifyInApp,
  });
};

export const notifyDeadlineWarning = async (
  projectId: number,
  dueDate: string,
  warningDays: number,
  triggeredBy?: number,
  testCaseId?: number,
  testCaseName?: string
) => {
  const project = await db.project.findUnique({
    where: { id: projectId },
    select: { id: true, name: true, creatorId: true },
  });

  if (!project) return null;

  const settings = await NotificationSettingsService.getOrCreateByProject(projectId);
  if (!settings.enableDeadlineWarning || warningDays <= 0) return null;
  if (await hasExistingDeadlineNotification(projectId, testCaseId, NotificationType.DeadlineWarning)) {
    return null;
  }

  const managers = await db.involvement.findMany({
    where: {
      projectId,
      type: InvolvementService.InvolvementType.manager,
      situation: InvolvementService.InvolvementSituation.accepted,
    },
    select: { userId: true },
  });

  const recipients = uniqueIds([
    project.creatorId,
    ...managers.map((manager) => manager.userId),
  ]);

  const title = "Prazo se aproximando";
  const targetLabel = testCaseId ? `do caso de teste "${testCaseName ?? ""}"` : `do projeto "${project.name}"`;
  const message = `O prazo ${targetLabel} vence em ${warningDays} dia(s) (${dueDate}).`;

  return createNotification({
    type: NotificationType.DeadlineWarning,
    title,
    message,
    userIds: recipients,
    projectId,
    metadata: { projectId, dueDate, triggeredBy, testCaseId },
    sendEmail: settings.notifyEmail,
    sendInApp: settings.notifyInApp,
  });
};

const diffInDays = (from: Date, to: Date) => {
  const ms = to.getTime() - from.getTime();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
};

export const runDeadlineChecks = async () => {
  const now = new Date();

  const projects = await db.project.findMany({
    where: { dueDate: { not: null } },
    select: { id: true, name: true, dueDate: true },
  });

  for (const project of projects) {
    if (!project.dueDate) continue;
    const settings = await NotificationSettingsService.getOrCreateByProject(project.id);
    const daysLeft = diffInDays(now, project.dueDate);
    const dueDateLabel = project.dueDate.toISOString().split("T")[0];

    if (settings.enableDeadlineExceeded && project.dueDate < now) {
      await notifyDeadlineExceeded(project.id, dueDateLabel);
      continue;
    }

    if (settings.enableDeadlineWarning && settings.deadlineWarningDays > 0) {
      if (daysLeft >= 0 && daysLeft <= settings.deadlineWarningDays) {
        await notifyDeadlineWarning(project.id, dueDateLabel, settings.deadlineWarningDays);
      }
    }
  }

  const testCases = await db.testCase.findMany({
    where: { dueDate: { not: null } },
    select: { id: true, name: true, dueDate: true, projectId: true },
  });

  for (const testCase of testCases) {
    if (!testCase.dueDate || !testCase.projectId) continue;
    const settings = await NotificationSettingsService.getOrCreateByProject(testCase.projectId);
    const daysLeft = diffInDays(now, testCase.dueDate);
    const dueDateLabel = testCase.dueDate.toISOString().split("T")[0];

    if (settings.enableDeadlineExceeded && testCase.dueDate < now) {
      await notifyDeadlineExceeded(testCase.projectId, dueDateLabel, undefined, testCase.id, testCase.name);
      continue;
    }

    if (settings.enableDeadlineWarning && settings.deadlineWarningDays > 0) {
      if (daysLeft >= 0 && daysLeft <= settings.deadlineWarningDays) {
        await notifyDeadlineWarning(
          testCase.projectId,
          dueDateLabel,
          settings.deadlineWarningDays,
          undefined,
          testCase.id,
          testCase.name
        );
      }
    }
  }

  return { ok: true };
};
