import { NotFoundGame } from "@/components/not-found-game";

/** Branded gamified 404 — shown for unmatched routes and any `notFound()` call
 * (including auth-gated pages reached while logged out). */
export default function NotFound() {
  return <NotFoundGame />;
}
