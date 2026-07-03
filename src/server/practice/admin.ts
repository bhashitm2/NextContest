import type { PrismaClient } from "@/generated/prisma/client";

/** Problem review/publishing is gated on a single admin account, identified
 * by email (`ADMIN_EMAIL` env). No admin table, no roles — one owner. */
export async function isAdmin(db: PrismaClient, userId: string | null): Promise<boolean> {
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail || !userId) return false;
  const user = await db.user.findUnique({ where: { id: userId }, select: { email: true } });
  return !!user?.email && user.email.toLowerCase() === adminEmail.toLowerCase();
}
