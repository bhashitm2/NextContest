import { signIn } from "@/auth";

/** Centered "sign in with GitHub" gate for authed-only pages. */
export function SignInPrompt({
  redirectTo,
  title,
  subtitle,
}: {
  redirectTo: string;
  title: string;
  subtitle: string;
}) {
  return (
    <main className="mx-auto flex w-full max-w-[1240px] flex-col items-center px-4 py-20 text-center sm:px-[22px]">
      <h1 className="font-display text-[clamp(1.7rem,3.4vw,2.4rem)] font-bold tracking-[-0.02em]">
        {title}
      </h1>
      <p className="mt-2 max-w-md text-[15px] text-cp-dim">{subtitle}</p>
      <form
        className="mt-6"
        action={async () => {
          "use server";
          await signIn("github", { redirectTo });
        }}
      >
        <button
          type="submit"
          className="inline-flex h-10 items-center gap-2 rounded-[10px] border border-cp-line-strong bg-cp-surface px-4 text-sm font-semibold text-cp-text transition-colors hover:border-cp-accent"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.58 2 12.25c0 4.53 2.87 8.37 6.84 9.73.5.1.68-.22.68-.49v-1.7c-2.78.62-3.37-1.37-3.37-1.37-.45-1.18-1.11-1.5-1.11-1.5-.91-.64.07-.62.07-.62 1 .07 1.53 1.06 1.53 1.06.9 1.57 2.36 1.12 2.94.86.09-.67.35-1.12.64-1.38-2.22-.26-4.55-1.14-4.55-5.07 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.3.1-2.71 0 0 .84-.28 2.75 1.05a9.3 9.3 0 015 0c1.91-1.33 2.75-1.05 2.75-1.05.55 1.41.2 2.45.1 2.71.64.72 1.03 1.63 1.03 2.75 0 3.94-2.34 4.81-4.57 5.06.36.32.68.94.68 1.91v2.83c0 .27.18.6.69.49A10.26 10.26 0 0022 12.25C22 6.58 17.52 2 12 2z" />
          </svg>
          Sign in with GitHub
        </button>
      </form>
    </main>
  );
}
