import { db } from "../utils/db.server";

export type File = {
    id: number;
    name: string;
    bucket: string;
    organizationId?: number | null;
};

export const create = async (file: Omit<File, "id">): Promise<File> => {
    return db.file.create({
        data: file,
    });
};