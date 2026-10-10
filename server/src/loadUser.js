import { prisma } from "./db.js";
import { hashToken, readSessionToken } from "./session.js";

const userInclude = {
  memberships: { include: { workspace: true } },
  clientGrants: true,
};

export async function attachUser(req, _res, next) {
  try {
    req.user = await userFromRequest(req);
    next();
  } catch (error) {
    next(error);
  }
}

export async function userFromRequest(req) {
  const token = readSessionToken(req);
  if (!token) return null;
  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: { include: userInclude } },
  });
  if (!session || session.expiresAt <= new Date()) return null;
  return session.user;
}

export function requireUser(req, res, next) {
  if (!req.user) {
    res.status(401).json({ error: "Sign in required." });
    return;
  }
  next();
}
