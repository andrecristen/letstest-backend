import * as dotenv from "dotenv";
import express from "express";
import cors from "cors";

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

dotenv.config();

const PORT = process.env.PORT ?? 4000

const app = express();

app.use(cors());
app.use(express.json());
app.use("/api/users", userRouter);
app.use("/api/projects", projectRouter);
app.use("/api/test-case", testCaseRouter);
app.use("/api/environment", environmentRouter);
app.use("/api/involvement", involvementRouter);
app.use("/api/template", templateRouter);
app.use("/api/file", fileRouter);
app.use("/api/test-execution", testExecutionRouter);
app.use("/api/hability", habilityRouter);
app.use("/api/device", deviceRouter);
app.use("/api/report", reportRouter);
app.use("/api/tag", tagRouter);

app.listen(PORT, () => {
  console.log(`Listening on port ${PORT}`);
});

export default app;