import express from "express";
import type { Request, Response } from "express";
import multer from "multer";
import { token } from "../utils/token.server";
import { tenantMiddleware } from "../utils/tenant.middleware";
import {uploadToS3, getBucketName} from "../utils/s3.server";
import { assertWithinLimit, recordUsage, LimitExceededError } from "../billing/billing.service";
import { requireSystemAccess, USER_ACCESS_LEVEL } from "../utils/permissions";

import * as FileService from "./file.service";

export const fileRouter = express.Router();

const storage = multer.memoryStorage()
const upload = multer({ storage: storage })

fileRouter.post('/upload', token.authMiddleware, tenantMiddleware, upload.single('file'), async (request: Request, response: Response) => {
    // #swagger.tags = ['Files']
    // #swagger.description = 'Faz upload de arquivo e registra no sistema.'
    if (!requireSystemAccess(request, response, USER_ACCESS_LEVEL)) return;
    if (!request.file) {
        return response.status(400).send('Nenhum arquivo carregado');
    }
    try {
        const organizationId = request.organizationId!;
        await assertWithinLimit("storage_bytes", { organizationId, increment: request.file.size });
    } catch (error: any) {
        if (error instanceof LimitExceededError) {
            return response.status(402).json({
                code: "LIMIT_EXCEEDED",
                metric: error.metric,
                current: error.current,
                limit: error.limit,
            });
        }
        return response.status(500).json(error.message);
    }
    const currentDate = new Date();
    const name = currentDate.getFullYear() + "/" + currentDate.getUTCMonth() + "/" + currentDate.getTime() + "-" + request.file.originalname;
    const uploaded = await uploadToS3(name, request.file.buffer, request.file.mimetype);
    if (uploaded) {
        const newFile = await FileService.create({name, bucket: getBucketName(), organizationId: request.organizationId});
        await recordUsage(request.organizationId!, "storage_bytes", request.file.size);
        return response.status(201).json(newFile);
    } else {
        return response.status(404).json("Erro ao realizar upload do arquivo");
    }
});
