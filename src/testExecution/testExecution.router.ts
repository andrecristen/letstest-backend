import express from "express";
import type { Request, Response } from "express";
import { body, validationResult } from "express-validator";
import { token } from "../utils/token.server";

import * as TestExecutionService from "./testExecution.service";

export const testExecutionRouter = express.Router();


