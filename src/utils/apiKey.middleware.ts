import type { Request, Response, NextFunction } from "express";
import * as ApiKeyService from "../apiKey/apiKey.service";

declare global {
  namespace Express {
    interface Request {
      apiKey?: {
        id: number;
        organizationId: number;
        scopes: string[];
      };
    }
  }
}

export const apiKeyMiddleware = async (
  request: Request,
  response: Response,
  next: NextFunction
) => {
  const authHeader = request.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return response.status(401).json({ error: "Missing or invalid authorization header" });
  }

  const key = authHeader.substring(7);

  if (!key.startsWith("lt_")) {
    return response.status(401).json({ error: "Invalid API key format" });
  }

  try {
    const apiKey = await ApiKeyService.findByKey(key);

    if (!apiKey) {
      return response.status(401).json({ error: "Invalid API key" });
    }

    if (apiKey.expiresAt && new Date(apiKey.expiresAt) < new Date()) {
      return response.status(401).json({ error: "API key has expired" });
    }

    const access = await ApiKeyService.validateApiAccess(apiKey.organizationId);
    if (!access.allowed) {
      const orgLabel = access.organization?.name ?? `org ${apiKey.organizationId}`;
      return response.status(403).json({
        error: `API access not available on your plan (plan: ${access.planKey}, organization: ${orgLabel})`,
      });
    }

    ApiKeyService.updateLastUsed(apiKey.id).catch(() => {});

    request.apiKey = {
      id: apiKey.id,
      organizationId: apiKey.organizationId,
      scopes: apiKey.scopes,
    };
    request.organizationId = apiKey.organizationId;

    next();
  } catch (error: any) {
    return response.status(500).json({ error: error.message });
  }
};

export const requireScope = (...requiredScopes: string[]) => {
  return (request: Request, response: Response, next: NextFunction) => {
    if (!request.apiKey) {
      return response.status(401).json({ error: "API key not authenticated" });
    }

    const hasScope = requiredScopes.some(
      (scope) =>
        request.apiKey!.scopes.includes(scope) ||
        request.apiKey!.scopes.includes("write")
    );

    if (!hasScope) {
      return response.status(403).json({
        error: "Insufficient permissions",
        required: requiredScopes,
        provided: request.apiKey.scopes,
      });
    }

    next();
  };
};
