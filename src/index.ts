import * as dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { createServer } from "http";
import { Server } from "socket.io";
import swaggerUi from "swagger-ui-express";
import swaggerDocument from "./swagger/swagger-output.json";

import { userRouter } from "./user/user.router";
import { projectRouter } from "./project/project.router";
import { testCaseRouter } from "./testCase/testCase.router";
import { environmentRouter } from "./environment/environment.router";
import { involvementRouter } from "./involvement/involvement.router";
import { templateRouter } from "./template/template.router";
import { fileRouter } from "./file/file.router";
import { testExecutionRouter } from "./testExecution/testExecution.router";
import { habilityRouter } from "./hability/hability.router";
import { deviceRouter } from "./device/device.router";
import { reportRouter } from "./report/report.router";
import { tagRouter } from "./tag/tag.router";
import { testScenarioRouter } from "./testScenario/testScenario.router";
import { notificationRouter } from "./notification/notification.router";
import { notificationSettingsRouter } from "./notification/notificationSettings.router";
import { organizationRouter } from "./organization/organization.router";
import { configRouter } from "./config/config.router";
import { billingRouter } from "./billing/billing.router";
import { apiKeyRouter } from "./apiKey/apiKey.router";
import { webhookRouter } from "./webhook/webhook.router";
import { publicProjectRouter } from "./publicApi/v1/projects.router";
import { publicTestCaseRouter } from "./publicApi/v1/testCases.router";
import { publicTestExecutionRouter } from "./publicApi/v1/testExecutions.router";
import { setSocketServer } from "./utils/socket.server";
import { token } from "./utils/token.server";

const PORT = process.env.PORT ?? 4000;

const allowedOrigins = (process.env.CORS_ORIGINS || "http://localhost:3000").split(",");

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins,
    credentials: true,
  },
});

setSocketServer(io);

io.on("connection", (socket) => {
  const rawToken = socket.handshake.auth?.token;
  let userId: number | null = null;
  if (rawToken) {
    try {
      const decoded: any = token.verify(rawToken);
      if (decoded?.id) {
        userId = decoded.id;
        socket.join(`user:${decoded.id}`);
      }
    } catch {
      console.warn(`[socket] invalid token for socket ${socket.id}`);
    }
  }
  console.info(`[socket] connected ${socket.id}${userId ? ` user:${userId}` : ""}`);
  socket.on("disconnect", (reason) => {
    console.info(`[socket] disconnected ${socket.id}${userId ? ` user:${userId}` : ""} (${reason})`);
  });
});

// Rate limiters
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
});

const publicApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
}));
app.use(express.json({
  verify: (req: any, _res, buf) => {
    if (req.originalUrl === "/api/billing/webhook") {
      req.rawBody = buf;
    }
  },
}));
app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));
app.use("/api/", generalLimiter);
app.use("/api/users/auth", authLimiter);
app.use("/api/users/register", authLimiter);
app.use("/api/users", userRouter);
app.use("/api/organizations", organizationRouter);
app.use("/api/projects", projectRouter);
app.use("/api/test-case", testCaseRouter);
app.use("/api/test-scenario", testScenarioRouter);
app.use("/api/environment", environmentRouter);
app.use("/api/involvement", involvementRouter);
app.use("/api/template", templateRouter);
app.use("/api/file", fileRouter);
app.use("/api/test-execution", testExecutionRouter);
app.use("/api/hability", habilityRouter);
app.use("/api/device", deviceRouter);
app.use("/api/report", reportRouter);
app.use("/api/tag", tagRouter);
app.use("/api/notifications", notificationRouter);
app.use("/api/notification-settings", notificationSettingsRouter);
app.use("/api/billing", billingRouter);
app.use("/api/config", configRouter);
app.use("/api/api-keys", apiKeyRouter);
app.use("/api/webhooks", webhookRouter);

// Public API v1 (API key authentication)
app.use("/api/v1", publicApiLimiter);
app.use("/api/v1/projects", publicProjectRouter);
app.use("/api/v1/test-cases", publicTestCaseRouter);
app.use("/api/v1/test-executions", publicTestExecutionRouter);

httpServer.listen(PORT, () => {
  console.log(`Listening on port ${PORT}`);
});

export default app;
