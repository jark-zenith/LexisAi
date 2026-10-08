import { Request, Response, NextFunction } from "express";
import { resolveUserFromToken, UserRecord, sanitizeUser } from "./authService";

// Extend Express Request interface
declare global {
  namespace Express {
    interface Request {
      user?: UserRecord | null;
      userId?: string | null;
    }
  }
}

/**
 * Extracts session token from Bearer Authorization header, custom header, or cookie
 */
export function extractTokenFromRequest(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
    const token = authHeader.substring(7).trim();
    if (token) return token;
  }

  const customHeader = req.headers["x-auth-token"];
  if (typeof customHeader === "string" && customHeader.trim()) {
    return customHeader.trim();
  }

  // Cookie fallback if present
  const cookieHeader = req.headers.cookie;
  if (cookieHeader) {
    const match = cookieHeader.match(/lexis_session=([^;]+)/);
    if (match && match[1]) {
      return decodeURIComponent(match[1].trim());
    }
  }

  return null;
}

/**
 * Enforces mandatory authentication on protected endpoints.
 * Never trusts client-supplied user IDs without validating session token.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = extractTokenFromRequest(req);

  if (!token) {
    return res.status(401).json({
      success: false,
      error: "Authentication required. Please sign in to access this resource.",
      code: "UNAUTHORIZED",
    });
  }

  const user = resolveUserFromToken(token);

  if (!user) {
    return res.status(401).json({
      success: false,
      error: "Your session has expired or is invalid. Please sign in again.",
      code: "SESSION_EXPIRED",
    });
  }

  req.user = user;
  req.userId = user.id;
  next();
}

/**
 * Optional authentication middleware for public endpoints with personalized perks.
 * Populates req.user if a valid token is provided.
 */
export function optionalAuth(req: Request, res: Response, next: NextFunction) {
  const token = extractTokenFromRequest(req);

  if (token) {
    const user = resolveUserFromToken(token);
    if (user) {
      req.user = user;
      req.userId = user.id;
    } else {
      req.user = null;
      req.userId = null;
    }
  } else {
    req.user = null;
    req.userId = null;
  }

  next();
}

/**
 * Resolves authoritative user ID from request.
 * If user is authenticated, returns user.id.
 * If not authenticated, returns guest identifier for public guest playground.
 */
export function resolveAuthoritativeUserId(req: Request): string {
  if (req.user && req.user.id) {
    return req.user.id;
  }

  // For unauthenticated public playground queries only (not workspaces or user data)
  const forwarded = req.headers["x-forwarded-for"];
  const ip = typeof forwarded === "string" ? forwarded.split(",")[0].trim() : req.socket?.remoteAddress;
  return ip ? `guest_${Buffer.from(ip).toString("hex").slice(0, 10)}` : "guest_user";
}
