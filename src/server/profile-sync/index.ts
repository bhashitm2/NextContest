import type { Platform } from "@/generated/prisma/client";

import {
  fetchCodeforcesStats,
  fetchCodeforcesVerificationField,
  validateCodeforces,
} from "./codeforces";
import {
  fetchLeetCodeStats,
  fetchLeetCodeVerificationField,
  validateLeetCode,
} from "./leetcode";
import {
  fetchAtCoderStats,
  fetchAtCoderVerificationField,
  validateAtCoder,
} from "./atcoder";
import {
  fetchCodeChefStats,
  fetchCodeChefVerificationField,
  validateCodeChef,
} from "./codechef";
import { type ProfilePlatform, type ProfileStats } from "./types";

type PlatformFns = {
  validate: (handle: string) => Promise<string>;
  verificationField: (handle: string) => Promise<string>;
  stats: (handle: string) => Promise<ProfileStats>;
};

const FNS: Record<ProfilePlatform, PlatformFns> = {
  CODEFORCES: {
    validate: validateCodeforces,
    verificationField: fetchCodeforcesVerificationField,
    stats: fetchCodeforcesStats,
  },
  LEETCODE: {
    validate: validateLeetCode,
    verificationField: fetchLeetCodeVerificationField,
    stats: fetchLeetCodeStats,
  },
  ATCODER: {
    validate: validateAtCoder,
    verificationField: fetchAtCoderVerificationField,
    stats: fetchAtCoderStats,
  },
  CODECHEF: {
    validate: validateCodeChef,
    verificationField: fetchCodeChefVerificationField,
    stats: fetchCodeChefStats,
  },
};

/** Platforms the profile feature supports (HackerRank reserved). */
export const PROFILE_PLATFORMS: ProfilePlatform[] = [
  "CODEFORCES",
  "LEETCODE",
  "ATCODER",
  "CODECHEF",
];

export function isProfilePlatform(p: Platform): p is ProfilePlatform {
  return (PROFILE_PLATFORMS as Platform[]).includes(p);
}

/** Confirm a handle exists on the platform; returns the canonical handle. */
export function validateHandle(platform: ProfilePlatform, handle: string): Promise<string> {
  return FNS[platform].validate(handle);
}

/** Fetch the profile-field text where the verification token would live. */
export function fetchVerificationField(
  platform: ProfilePlatform,
  handle: string,
): Promise<string> {
  return FNS[platform].verificationField(handle);
}

/** Fetch normalized stats for a handle. */
export function fetchStats(platform: ProfilePlatform, handle: string): Promise<ProfileStats> {
  return FNS[platform].stats(handle);
}

/** Map normalized stats to a PlatformHandle update payload (sets lastSynced). */
export function statsToHandleData(stats: ProfileStats) {
  return {
    rating: stats.rating,
    maxRating: stats.maxRating,
    rank: stats.rank,
    problemsSolved: stats.problemsSolved,
    stats: stats.extra as object,
    lastSynced: new Date(),
  };
}

export { VERIFICATION_FIELD } from "./types";
export type { ProfileStats, ProfilePlatform } from "./types";
