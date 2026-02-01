import { db } from "../utils/db.server";

export type NotificationSettingsInput = {
  enableExecutionRejected?: boolean;
  enableInviteAccepted?: boolean;
  enableInviteReceived?: boolean;
  enableDeadlineExceeded?: boolean;
  enableDeadlineWarning?: boolean;
  deadlineWarningDays?: number;
  notifyEmail?: boolean;
  notifyInApp?: boolean;
};

export const getOrCreateByProject = async (projectId: number) => {
  const existing = await db.notificationSettings.findUnique({ where: { projectId } });
  if (existing) return existing;

  return db.notificationSettings.create({
    data: { projectId },
  });
};

export const updateByProject = async (projectId: number, data: NotificationSettingsInput) => {
  return db.notificationSettings.update({
    where: { projectId },
    data,
  });
};
