import { requireAdmin } from "@/lib/admin-api";
import { databaseErrorResponse, getDatabase } from "@/lib/mongodb";
import type { SiteSettings } from "@/lib/types";

export async function PUT(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  let settings: SiteSettings;
  try {
    settings = (await request.json()) as SiteSettings;
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  if (
    !Number.isInteger(settings.secondsPerQuestion) ||
    settings.secondsPerQuestion < 15 ||
    settings.secondsPerQuestion > 300 ||
    !Number.isInteger(settings.warningLimit) ||
    settings.warningLimit < 1 ||
    settings.warningLimit > 10 ||
    typeof settings.autoSubmitOnWarnings !== "boolean" ||
    typeof settings.fullscreenRequired !== "boolean" ||
    typeof settings.shuffleOptions !== "boolean" ||
    typeof settings.showSolutions !== "boolean"
  ) {
    return Response.json({ error: "One or more settings are outside the allowed range." }, { status: 400 });
  }

  try {
    const db = await getDatabase();
    await db.collection("settings").updateOne(
      { key: "site" },
      { $set: { ...settings, key: "site" } },
      { upsert: true },
    );
    return Response.json({ settings });
  } catch (error) {
    return databaseErrorResponse(error);
  }
}
