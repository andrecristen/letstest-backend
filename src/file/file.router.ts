import express from "express";
import type { Request, Response } from "express";
import path from 'path';
import multer from "multer";
import { body, validationResult } from "express-validator";
import { token } from "../utils/token.server";
import uploadToS3 from "../utils/s3.server";

//import * as FileService from "./file.service";

export const fileRouter = express.Router();

const storage = multer.memoryStorage()
const upload = multer({ storage: storage })

fileRouter.post('/upload', upload.single('file'), async (request: any, response: Response) => {
    if (!request.file) {
        return response.status(400).send('Nenhum arquivo carregado');
    }
    const uploaded = await uploadToS3(request.file.originalname, request.file.buffer);
    if (uploaded) {
        return response.status(201).json("Upload do arquivo realizado com sucesso");
    } else {
        return response.status(404).json("Erro ao realizar upload do arquivo");
    }
});