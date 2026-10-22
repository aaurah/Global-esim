import { clerkClient, getAuth } from "@clerk/express";
import type { NextFunction, Request, Response } from "express";

export function requireSignedIn(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const auth = getAuth(req);
  if (!auth.userId) {
    res.status(401).json({ error: "Sign-in required" });
    return;
  }
  next();
}

export async function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const auth = getAuth(req);
  if (!auth.userId) {
    res.status(401).json({ error: "Sign-in required" });
    return;
  }
  try {
    const user = await clerkClient.users.getUser(auth.userId);
    if (user.publicMetadata.role === "admin") {
      next();
      return;
    }
  } catch {
    res.status(503).json({ error: "Could not verify administrator role" });
    return;
  }
  {
    res.status(403).json({
      error: "Administrator role required",
      detail:
        "Run the documented one-time administrator setup for the trusted account before using operator controls.",
    });
  }
}

export function requireSameOrigin(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const origin = req.get("origin");
  const forwardedHost = req.get("x-forwarded-host")?.split(",")[0]?.trim();
  const expectedHost = forwardedHost || req.get("host");
  if (!origin || !expectedHost) {
    res.status(403).json({ error: "Same-origin request required" });
    return;
  }
  try {
    if (new URL(origin).host !== expectedHost) {
      res.status(403).json({ error: "Same-origin request required" });
      return;
    }
  } catch {
    res.status(403).json({ error: "Invalid request origin" });
    return;
  }
  next();
}
