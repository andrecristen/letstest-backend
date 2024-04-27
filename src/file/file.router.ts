import express from "express";
import type { Request, Response } from "express";
import path from 'path';
import multer from "multer";
import { body, validationResult } from "express-validator";
import { token } from "../utils/token.server";
import uploadToS3 from "../utils/s3.server";

//import * as FileService from "./file.service";

export const fileRouter = express.Router();

const storage = multer.diskStorage({
    destination: (request, file, cb) => {
        cb(null, './uploads'); // You may need to create the 'uploads' directory manually
    },
    filename: (request, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        const ext = path.extname(file.originalname);
        const fileName = file.fieldname + '-' + uniqueSuffix + ext;
        cb(null, fileName);
    },
});

const upload = multer({ storage });

fileRouter.post('/upload', upload.single('file'), async (request: Request, response: Response) => {
    if (!request.file) {
        return response.status(400).send('Nenhum arquivo carregado');
    }
    const uploaded = await uploadToS3(request.file.filename, request.file.stream);
    if (uploaded) {
        return response.status(201).json("Upload do arquivo realizado com sucesso");
    } else {
        return response.status(404).json("Erro ao realizar upload do arquivo");
    }
});