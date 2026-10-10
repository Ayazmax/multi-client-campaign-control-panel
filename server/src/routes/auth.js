import { Router } from "express";
import { prisma } from "../db.js";
import { toAuthUser } from "../access.js";
import { verifyPassword } from "../passwords.js";
import {
  clearSessionCookie,
  createSessionToken,
  hashToken,
  readSessionToken,
  sessionExpiry,
  setSessionCookie,
} from "../session.js";

export const authRouter = Router();

authRouter.post("/login", async (req, res, next) => {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "");
    if (!email || !password) {
      res.status(400).json({ error: "Enter your email and password." });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        memberships: { include: { workspace: true } },
        clientGrants: true,
      },
    });
    const valid = user ? await verifyPassword(password, user.passwordHash) : false;
    if (!user || !valid) {
      res.status(401).json({ error: "Email or password is incorrect." });
      return;
    }

    const { token, tokenHash } = createSessionToken();
    await prisma.session.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt: sessionExpiry(),
      },
    });
    setSessionCookie(res, token);
    res.json({ user: toAuthUser(user) });
  } catch (error) {
    next(error);
  }
});

authRouter.post("/logout", async (req, res, next) => {
  try {
    const token = readSessionToken(req);
    if (token) {
      await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
    }
    clearSessionCookie(res);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

authRouter.get("/me", (req, res) => {
  if (!req.user) {
    res.status(401).json({ error: "Sign in required." });
    return;
  }
  res.json({ user: toAuthUser(req.user) });
});
