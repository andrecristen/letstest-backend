export type PaginationParams = {
  page: number;
  limit: number;
  skip: number;
  take: number;
};

export type PaginatedResponse<T> = {
  data: T[];
  page: number;
  limit: number;
  total: number;
  hasNext: boolean;
};

export const getPaginationParams = (
  query: Record<string, unknown>,
  defaultLimit = 20,
  maxLimit = 100
): PaginationParams => {
  const pageValue = parseInt(String(query.page ?? ""), 10);
  const limitValue = parseInt(String(query.limit ?? ""), 10);
  const page = Number.isFinite(pageValue) && pageValue > 0 ? pageValue : 1;
  const limit = Number.isFinite(limitValue) && limitValue > 0 ? limitValue : defaultLimit;
  const safeLimit = Math.min(limit, maxLimit);
  const skip = (page - 1) * safeLimit;
  return { page, limit: safeLimit, skip, take: safeLimit };
};

export const buildPaginatedResponse = <T>(
  data: T[],
  total: number,
  page: number,
  limit: number
): PaginatedResponse<T> => {
  return {
    data,
    page,
    limit,
    total,
    hasNext: page * limit < total,
  };
};
