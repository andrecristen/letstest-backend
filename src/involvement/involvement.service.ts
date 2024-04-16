import { db } from "../utils/db.server";

export type Involvement = {
    id: number;
    situation: number;
    type: number;
    userId: number;
    projectId: number;
};

export enum InvolvementSituation {
    applied = 1,
    invited = 2,
    rejected = 3,
    accepted = 4,
}

export enum InvolvementType {
    tester = 1,
    manager = 2,
}

export const create = async (involvement: Omit<Involvement, "id">): Promise<Involvement> => {
    return db.involvement.create({
        data: involvement,
    });
};


export const update = async (id: number, involvement: Partial<Involvement>): Promise<Involvement> => {
    return db.involvement.update({
        where: { id },
        data: involvement,
    });
};

export const remove = async (id: number): Promise<Involvement> => {
    return db.involvement.delete({
        where: { id }
    });
};

export const find = async (id: number): Promise<Involvement | null> => {
    return db.involvement.findUnique({
        where: {
            id: id,
        },
    });
};

export const findOneBy = async (params: any): Promise<Involvement | null> => {
    return db.involvement.findUnique({
        where: params,
    });
};

export const findBy = async (params: any): Promise<Involvement[] | null> => {
    return db.involvement.findMany({
        where: params,
    });
};
