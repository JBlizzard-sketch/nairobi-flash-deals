import { type Request, type Response, type NextFunction } from "express";
import { verifyToken, type TokenPayload } from "../lib/jwt";

declare global {
  namespace Express {
    interface Request {
      auth?: TokenPayload;
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ message: "Missing or invalid Authorization header" });
    return;
  }
  const token = header.slice(7);
  try {
    req.auth = await verifyToken(token);
    next();
  } catch {
    res.status(401).json({ message: "Token expired or invalid" });
  }
}

export async function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) {
    try {
      req.auth = await verifyToken(header.slice(7));
    } catch {
      // ignore invalid tokens for optional auth
    }
  }
  next();
}
