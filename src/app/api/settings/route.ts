import { NextResponse } from "next/server";
import {
  getAppSettings,
  setSetting,
  setApiKey,
  getApiKey,
} from "@/lib/db/app-db";
import { updateSettingsSchema } from "@/lib/schemas";

export async function GET() {
  const settings = getAppSettings();
  return NextResponse.json({
    has_api_key: !!settings.api_key_encrypted,
    safety_mode: settings.safety_mode,
    theme: settings.theme,
  });
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const parsed = updateSettingsSchema.parse(body);

    if (parsed.api_key !== undefined) {
      if (parsed.api_key === "") {
        setSetting("api_key", "");
      } else {
        setApiKey(parsed.api_key);
      }
    }

    if (parsed.safety_mode !== undefined) {
      setSetting("safety_mode", String(parsed.safety_mode));
    }

    if (parsed.theme !== undefined) {
      setSetting("theme", parsed.theme);
    }

    const settings = getAppSettings();
    return NextResponse.json({
      has_api_key: !!settings.api_key_encrypted,
      safety_mode: settings.safety_mode,
      theme: settings.theme,
    });
  } catch (e) {
    if (e instanceof Error && e.name === "ZodError") {
      return NextResponse.json(
        { error: "Invalid input", details: e },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Failed to update settings" },
      { status: 500 }
    );
  }
}
