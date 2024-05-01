import { db } from "../utils/db.server";

export type Project = {
    id: number;
    name: string;
    description: string;
    visibility: number;
    situation: number;
    creatorId: number;
};

export enum ProjectVisibilityEnum {
    public = 1,
    private = 2,
}

export enum ProjectSituationEnum {
    testing = 1,
    finalized = 2,
    canceled = 3,
}

export const create = async (project: Omit<Project, "id">): Promise<Project> => {
    return db.project.create({
        data: project,
    });
};

export const update = async (id: number, data: Partial<Project>): Promise<Project> => {
    return db.project.update({
        where: { id },
        data,
    });
};

export const find = async (id: number): Promise<Project | null> => {
    return db.project.findUnique({
        where: {
            id:id,
        },
    });
};

export const findOneBy = async (params: any): Promise<Project | null> => {
    return db.project.findUnique({
        where: params,
    });
};

export const findBy = async (params: any): Promise<Project[] | null> => {
    return db.project.findMany({
        where: params,
    });
};
