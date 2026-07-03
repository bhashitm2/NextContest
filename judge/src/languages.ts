import type { JudgeLanguage } from "./types.js";

/** Per-language execution config. Images are official multi-arch (arm64 on the
 * Oracle VM, amd64 on a dev machine — same tags). Interpreted/JIT languages get
 * a wall-clock multiplier over the problem's nominal (C++-calibrated) limit. */
export type LanguageConfig = {
  image: string;
  sourceFile: string;
  /** null = no compile step */
  compileArgv: string[] | null;
  compileTimeoutMs: number;
  runArgv: (memoryMb: number) => string[];
  timeMultiplier: number;
  /** Extra container memory beyond the problem limit (JVM/runtime overhead). */
  memoryOverheadMb: number;
};

export const LANGUAGES: Record<JudgeLanguage, LanguageConfig> = {
  CPP: {
    image: "gcc:14",
    sourceFile: "main.cpp",
    compileArgv: ["g++", "-O2", "-std=c++17", "-o", "main", "main.cpp"],
    compileTimeoutMs: 20_000,
    runArgv: () => ["./main"],
    timeMultiplier: 1,
    memoryOverheadMb: 16,
  },
  JAVA: {
    image: "eclipse-temurin:21",
    sourceFile: "Main.java",
    compileArgv: ["javac", "Main.java"],
    compileTimeoutMs: 30_000,
    // Heap capped below the container limit so the JVM OOMs as a Java error
    // (RE with a stack trace) rather than a hard container kill when possible.
    runArgv: (memoryMb) => ["java", `-Xmx${Math.max(memoryMb - 32, 32)}m`, "-Xss64m", "Main"],
    timeMultiplier: 2,
    memoryOverheadMb: 128,
  },
  PYTHON: {
    image: "python:3.12-slim",
    sourceFile: "main.py",
    compileArgv: null,
    compileTimeoutMs: 0,
    runArgv: () => ["python3", "main.py"],
    timeMultiplier: 3,
    memoryOverheadMb: 32,
  },
};
