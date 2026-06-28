import Link from "next/link";

import { auth, signIn, signOut } from "@/auth";
import { MainNav } from "@/components/main-nav";
import { MobileNav } from "@/components/mobile-nav";
import { UserMenu } from "@/components/user-menu";
import { prisma } from "@/lib/db";

export async function SiteHeader() {
  const session = await auth();
  const user = session?.user;
  const initial = (user?.name ?? user?.email ?? "?").charAt(0).toUpperCase();
  const pendingRequests = user?.id
    ? await prisma.friendship.count({ where: { addresseeId: user.id, status: "PENDING" } })
    : 0;

  const signOutAction = async () => {
    "use server";
    await signOut({ redirectTo: "/" });
  };

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
          <MainNav isAuthed={Boolean(user)} pendingRequests={pendingRequests} />

          {user ? (
            <div className="hidden sm:block">
              <UserMenu
                name={user.name ?? user.email ?? "Account"}
                initial={initial}
                signOutAction={signOutAction}
              />
            </div>
          ) : (
            <div className="flex items-center gap-2.5">
              <span className="text-[13px] font-semibold text-cp-dim">Sign in</span>
              <div className="flex items-center gap-2">
                {/* Google — primary provider */}
                <form
                  action={async () => {
                    "use server";
                    await signIn("google", { redirectTo: "/contests" });
                  }}
                >
                  <button
                    type="submit"
                    aria-label="Sign in with Google"
                    title="Sign in with Google"
                    className="grid size-9 place-items-center rounded-[9px] border border-cp-accent bg-cp-surface transition-colors hover:bg-cp-bg"
                    style={{ boxShadow: "0 0 14px color-mix(in srgb, var(--cp-accent) 30%, transparent)" }}
                  >
                    <svg width="17" height="17" viewBox="0 0 24 24" aria-hidden>
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                    </svg>
                  </button>
                </form>
                {/* GitHub — secondary provider */}
                <form
                  action={async () => {
                    "use server";
                    await signIn("github", { redirectTo: "/contests" });
                  }}
                >
                  <button
                    type="submit"
                    aria-label="Sign in with GitHub"
                    title="Sign in with GitHub"
                    className="grid size-9 place-items-center rounded-[9px] border border-cp-line-strong bg-cp-surface text-cp-text transition-colors hover:border-cp-accent"
                  >
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                      <path d="M12 2C6.48 2 2 6.58 2 12.25c0 4.53 2.87 8.37 6.84 9.73.5.1.68-.22.68-.49v-1.7c-2.78.62-3.37-1.37-3.37-1.37-.45-1.18-1.11-1.5-1.11-1.5-.91-.64.07-.62.07-.62 1 .07 1.53 1.06 1.53 1.06.9 1.57 2.36 1.12 2.94.86.09-.67.35-1.12.64-1.38-2.22-.26-4.55-1.14-4.55-5.07 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.3.1-2.71 0 0 .84-.28 2.75 1.05a9.3 9.3 0 015 0c1.91-1.33 2.75-1.05 2.75-1.05.55 1.41.2 2.45.1 2.71.64.72 1.03 1.63 1.03 2.75 0 3.94-2.34 4.81-4.57 5.06.36.32.68.94.68 1.91v2.83c0 .27.18.6.69.49A10.26 10.26 0 0022 12.25C22 6.58 17.52 2 12 2z" />
                    </svg>
                  </button>
                </form>
              </div>
            </div>
          )}

          <MobileNav
            isAuthed={Boolean(user)}
            pendingRequests={pendingRequests}
            signOutAction={user ? signOutAction : undefined}
          />
        </nav>
      </div>
    </header>
  );
}
