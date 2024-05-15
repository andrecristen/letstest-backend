import express from "express";
import type { Request, Response } from "express";
import multer from "multer";
import { token } from "../utils/token.server";
import {uploadToS3, getBucketName} from "../utils/s3.server";

import * as FileService from "./file.service";

export const fileRouter = express.Router();

const storage = multer.memoryStorage()
const upload = multer({ storage: storage })

fileRouter.post('/upload', token.authMiddleware, upload.single('file'), async (request: Request, response: Response) => {
    if (!request.file) {
        return response.status(400).send('Nenhum arquivo carregado');
    }
    const currentDate = new Date();
    const name = currentDate.getFullYear() + "/" + currentDate.getUTCMonth() + "/" + currentDate.getTime() + "-" + request.file.originalname;
    const uploaded = await uploadToS3(name, request.file.buffer, request.file.mimetype);
    if (uploaded) {
        const newFile = await FileService.create({name, bucket: getBucketName()});
        return response.status(201).json(newFile);
    } else {
        return response.status(404).json("Erro ao realizar upload do arquivo");
    }
});