import express from "express";
import type { Request, Response } from "express";
import { body, validationResult } from "express-validator";
import { token } from "../utils/token.server";
import { buildPaginatedResponse, getPaginationParams } from "../utils/pagination";
import * as NotificationService from "./notification.service";
import { db } from "../utils/db.server";

export const notificationRouter = express.Router();

const CRON_SECRET = process.env.CRON_SECRET;

const allowCronOrAuth = (request: Request, response: Response, next: () => void) => {
  const secret = request.query.secret || request.headers["x-cron-secret"];
  if (CRON_SECRET && secret === CRON_SECRET) {
    return next();
  }
  return token.authMiddleware(request, response, next);
};

notificationRouter.get("/", token.authMiddleware, async (request: Request, response: Response) => {
  try {
    const userId = request.user?.id;
    if (!userId) return response.status(401).json({ error: "Usuario nao autenticado" });
    const pagination = getPaginationParams(request.query);

    const [total, data] = await Promise.all([
      db.notificationRecipient.count({ where: { userId } }),
      db.notificationRecipient.findMany({
        where: { userId },
        orderBy: { id: "desc" },
        skip: pagination.skip,
        take: pagination.take,
        include: {
          notification: true,
        },
      }),
    ]);

    return response.status(200).json(buildPaginatedResponse(data, total, pagination.page, pagination.limit));
  } catch (error: any) {
    return response.status(500).json(error.message);
  }
});

notificationRouter.get("/unread-count", token.authMiddleware, async (request: Request, response: Response) => {
  try {
    const userId = request.user?.id;
    if (!userId) return response.status(401).json({ error: "Usuario nao autenticado" });
    const count = await db.notificationRecipient.count({ where: { userId, readAt: null } });
    return response.status(200).json({ count });
  } catch (error: any) {
    return response.status(500).json(error.message);
  }
});

notificationRouter.put("/read/:notificationId", token.authMiddleware, async (request: Request, response: Response) => {
  try {
    const userId = request.user?.id;
    if (!userId) return response.status(401).json({ error: "Usuario nao autenticado" });
    const notificationId = parseInt(request.params.notificationId, 10);
    if (!notificationId) return response.status(400).json({ error: "Notificacao invalida" });

    await db.notificationRecipient.updateMany({
      where: { userId, notificationId },
      data: { readAt: new Date() },
    });
    return response.status(200).json({ ok: true });
  } catch (error: any) {
    return response.status(500).json(error.message);
  }
});

notificationRouter.put("/read-all", token.authMiddleware, async (request: Request, response: Response) => {
  try {
    const userId = request.user?.id;
    if (!userId) return response.status(401).json({ error: "Usuario nao autenticado" });
    await db.notificationRecipient.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    return response.status(200).json({ ok: true });
  } catch (error: any) {
    return response.status(500).json(error.message);
  }
});

notificationRouter.post(
  "/deadline",
  token.authMiddleware,
  body("projectId").isNumeric(),
  body("dueDate").isString(),
  async (request: Request, response: Response) => {
    const errors = validationResult(request);
    if (!errors.isEmpty()) {
      return response.status(400).json({ errors: errors.array() });
    }
    try {
      const projectId = parseInt(request.body.projectId, 10);
      const dueDate = String(request.body.dueDate);
      const userId = request.user?.id;
      const notification = await NotificationService.notifyDeadlineExceeded(projectId, dueDate, userId);
      return response.status(201).json(notification);
    } catch (error: any) {
      return response.status(500).json(error.message);
    }
  }
);

notificationRouter.post("/deadline/run", allowCronOrAuth, async (_request: Request, response: Response) => {
  try {
    const result = await NotificationService.runDeadlineChecks();
    return response.status(200).json(result);
  } catch (error: any) {
    return response.status(500).json(error.message);
  }
});
