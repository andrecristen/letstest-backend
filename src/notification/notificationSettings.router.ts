import express from "express";
import type { Request, Response } from "express";
import { body, validationResult } from "express-validator";
import { token } from "../utils/token.server";
import * as NotificationSettingsService from "./notificationSettings.service";

export const notificationSettingsRouter = express.Router();

// #swagger.tags = ['NotificationSettings']
// #swagger.description = 'Obtem configuracoes de notificacao de um projeto.'
notificationSettingsRouter.get("/:projectId", token.authMiddleware, async (request: Request, response: Response) => {
  try {
    const projectId = parseInt(request.params.projectId, 10);
    if (!projectId) return response.status(400).json({ error: "Projeto invalido" });
    const settings = await NotificationSettingsService.getOrCreateByProject(projectId);
    return response.status(200).json(settings);
  } catch (error: any) {
    return response.status(500).json(error.message);
  }
});

notificationSettingsRouter.put(
  "/:projectId",
  token.authMiddleware,
  body("enableExecutionRejected").optional().isBoolean(),
  body("enableInviteAccepted").optional().isBoolean(),
  body("enableInviteReceived").optional().isBoolean(),
  body("enableDeadlineExceeded").optional().isBoolean(),
  body("enableDeadlineWarning").optional().isBoolean(),
  body("deadlineWarningDays").optional().isNumeric(),
  body("notifyEmail").optional().isBoolean(),
  body("notifyInApp").optional().isBoolean(),
  async (request: Request, response: Response) => {
    // #swagger.tags = ['NotificationSettings']
    // #swagger.description = 'Atualiza configuracoes de notificacao do projeto.'
    const errors = validationResult(request);
    if (!errors.isEmpty()) {
      return response.status(400).json({ errors: errors.array() });
    }
    try {
      const projectId = parseInt(request.params.projectId, 10);
      if (!projectId) return response.status(400).json({ error: "Projeto invalido" });
      const settings = await NotificationSettingsService.updateByProject(projectId, request.body);
      return response.status(200).json(settings);
    } catch (error: any) {
      return response.status(500).json(error.message);
    }
  }
);
