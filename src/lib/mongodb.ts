import { MongoClient, type Db } from "mongodb";

import { seedQuestions } from "@/lib/questions";
import type { SiteSettings } from "@/lib/types";

const defaultSettings: SiteSettings = {
  secondsPerQuestion: 72,
  warningLimit: 3,
  autoSubmitOnWarnings: true,
  fullscreenRequired: true,
  shuffleOptions: true,
  showSolutions: true,
};

let clientPromise: Promise<MongoClient> | undefined;

export async function getDatabase(): Promise<Db> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MongoDB is not configured. Add MONGODB_URI to your environment.");
  }

  if (!clientPromise) {
    clientPromise = new MongoClient(uri).connect().catch((error: unknown) => {
      clientPromise = undefined;
      throw error;
    });
  }

  const client = await clientPromise;
  return client.db(process.env.MONGODB_DB || "mathsmock");
}

export async function initializeDatabase(db: Db): Promise<void> {
  const questions = db.collection("questions");
  await questions.createIndex({ id: 1 }, { unique: true });
  await Promise.all(
    seedQuestions.map((question) =>
      questions.updateOne({ id: question.id }, { $setOnInsert: question }, { upsert: true }),
    ),
  );
  await db.collection("settings").updateOne(
    { key: "site" },
    { $setOnInsert: { key: "site", ...defaultSettings } },
    { upsert: true },
  );
  await db.collection("attempts").createIndex({ studentName: 1, createdAt: -1 });
  await db.collection("attempts").createIndex({ studentId: 1, createdAt: -1 });
  await db.collection("messages").createIndex({ studentId: 1, createdAt: 1 });
  await db.collection("studentSessions").createIndex({ id: 1 }, { unique: true });
  await db.collection("studentSessions").createIndex({ tokenHash: 1 }, { unique: true });
}

export function databaseErrorResponse(error: unknown): Response {
  console.error("MongoDB request failed:", error);
  const message =
    error instanceof Error && error.message.startsWith("MongoDB is not configured")
      ? error.message
      : "MongoDB request failed. Check the server logs and database configuration.";
  return Response.json({ error: message }, { status: 503 });
}

export const initialSiteSettings = defaultSettings;
