import { db } from "../utils/db.server";

export type User = {
    id: number;
    email: string;
    name: string;
    bio?: string|null;
    password: string;
    access: number;
};

export const create = async (user: Omit<User, "id">): Promise<User> => {
    let { email, name, password, access = 1} = user;
    return db.user.create({
        data: {
            email,
            name,
            password,
            access
        },
        select: {
            id: true,
            email: true,
            name: true,
            password: true,
            access: true,
        },
    });
};

export const update = async (id: number, data: Partial<User>): Promise<User> => {
    return db.user.update({
        where: { id },
        data,
    });
};


export const list = async (): Promise<Omit<User, "password">[]> => {
    return db.user.findMany({
        select: {
            id: true,
            email: true,
            name: true,
            access: true,
        },
    });
};


export const find = async (id: number): Promise<Omit<User, "password"> | null> => {
    return db.user.findUnique({
        select: {
            id: true,
            email: true,
            name: true,
            bio: true,
            access: true,
        },
        where: {
            id,
        },
    });
};

export const findOneBy = async (params: any): Promise<User | null> => {
    return db.user.findUnique({
        where: params,
    });
};