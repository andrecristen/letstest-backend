import { db } from "../utils/db.server";

export type File = {
    id: number;
    name: string;
    bucket: string;
};

export const create = async (file: Omit<File, "id">): Promise<File> => {
    return db.file.create({
        data: file,
    });
};