import Link from "next/link";

import { auth, signIn, signOut } from "@/auth";
import { UserMenu } from "@/components/user-menu";
import { prisma } from "@/lib/db";

export async function SiteHeader() {
  const session = await auth();
  const user = session?.user;
  const initial = (user?.name ?? user?.email ?? "?").charAt(0).toUpperCase();
  const pendingRequests = user?.id
    ? await prisma.friendship.count({ where: { addresseeId: user.id, status: "PENDING" } })
    : 0;

  return (
    <header
      className="sticky top-0 z-50 border-b border-cp-line backdrop-blur-[14px]"
      style={{ background: "color-mix(in srgb, var(--cp-bg) 74%, transparent)" }}
    >
      <div className="mx-auto flex h-16 max-w-[1240px] items-center justify-between gap-4 px-4 sm:px-[22px]">
        <Link href="/" className="flex items-center gap-[11px] text-cp-text">
          <span
            className="grid size-[34px] place-items-center rounded-[9px] text-cp-accent-ink"
            style={{
              background: "var(--cp-accent)",
              boxShadow: "0 0 18px color-mix(in srgb, var(--cp-accent) 55%, transparent)",
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 7l-5 5 5 5" />
              <path d="M16 7l5 5-5 5" />
            </svg>
          </span>
          <span className="hidden whitespace-nowrap font-display text-[17px] font-bold tracking-tight min-[360px]:inline">
            NextContest
          </span>
        </Link>

        <nav className="flex items-center gap-1.5 sm:gap-2.5">
          <Link
            href="/"
            className="hidden rounded-lg px-3 py-2 text-sm text-cp-dim transition-colors hover:text-cp-text sm:block"
          >
            Home
          </Link>
          <Link
            href="/contests"
            className="hidden rounded-lg px-3 py-2 text-sm text-cp-dim transition-colors hover:text-cp-text sm:block"
          >
            Contests
          </Link>
          {user ? (
            <>
              <Link
                href="/profile"
                className="hidden rounded-lg px-3 py-2 text-sm text-cp-dim transition-colors hover:text-cp-text sm:block"
              >
                Profile
              </Link>
              <div className="relative hidden sm:block">
                <Link
                  href="/friends"
                  className="block rounded-lg px-3 py-2 text-sm text-cp-dim transition-colors hover:text-cp-text"
                >
                  Friends
                </Link>
                {pendingRequests > 0 ? (
                  <Link
                    href="/friends/requests"
                    title="Friend requests"
                    className="absolute right-0.5 top-1 grid min-w-[16px] place-items-center rounded-full bg-cp-accent px-1 text-[10px] font-bold leading-4 text-cp-accent-ink"
                  >
                    {pendingRequests}
                  </Link>
                ) : null}
              </div>
            </>
          ) : null}

          {user ? (
            <UserMenu
              name={user.name ?? user.email ?? "Account"}
              initial={initial}
              signOutAction={async () => {
                "use server";
                await signOut({ redirectTo: "/" });
              }}
            />
          ) : (
            <div className="flex items-center gap-2">
              <form
                action={async () => {
                  "use server";
                  await signIn("github", { redirectTo: "/contests" });
                }}
              >
                <button
                  type="submit"
                  className="inline-flex h-9 items-center gap-[7px] rounded-[9px] border border-cp-line-strong bg-cp-surface px-3.5 text-[13px] font-semibold text-cp-text transition-colors hover:border-cp-accent"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C6.48 2 2 6.58 2 12.25c0 4.53 2.87 8.37 6.84 9.73.5.1.68-.22.68-.49v-1.7c-2.78.62-3.37-1.37-3.37-1.37-.45-1.18-1.11-1.5-1.11-1.5-.91-.64.07-.62.07-.62 1 .07 1.53 1.06 1.53 1.06.9 1.57 2.36 1.12 2.94.86.09-.67.35-1.12.64-1.38-2.22-.26-4.55-1.14-4.55-5.07 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.3.1-2.71 0 0 .84-.28 2.75 1.05a9.3 9.3 0 015 0c1.91-1.33 2.75-1.05 2.75-1.05.55 1.41.2 2.45.1 2.71.64.72 1.03 1.63 1.03 2.75 0 3.94-2.34 4.81-4.57 5.06.36.32.68.94.68 1.91v2.83c0 .27.18.6.69.49A10.26 10.26 0 0022 12.25C22 6.58 17.52 2 12 2z" />
                  </svg>
                  <span className="hidden sm:inline">Sign in with GitHub</span>
                  <span className="sm:hidden">Sign in</span>
                </button>
              </form>
              <form
                action={async () => {
                  "use server";
                  await signIn("google", { redirectTo: "/contests" });
                }}
              >
                <button
                  type="submit"
                  className="hidden h-9 items-center rounded-[9px] border border-cp-line bg-cp-surface px-3.5 text-[13px] font-semibold text-cp-dim transition-colors hover:text-cp-text sm:inline-flex"
                >
                  Google
                </button>
              </form>
            </div>
          )}
        </nav>
      </div>
    </header>
  );
}
