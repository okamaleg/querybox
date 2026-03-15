import { NextResponse } from "next/server";
import {
  getConnections,
  createConnection,
} from "@/lib/db/app-db";
import { createConnectionSchema } from "@/lib/schemas";

export async function GET() {
  const connections = getConnections();
  // Strip encrypted config from list response
  const safe = connections.map(({ config_encrypted, ...rest }) => rest);
  return NextResponse.json(safe);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = createConnectionSchema.parse(body);
    const connection = createConnection(parsed.name, parsed.config);
    const { config_encrypted, ...safe } = connection;
    return NextResponse.json(safe, { status: 201 });
  } catch (e) {
    if (e instanceof Error && e.name === "ZodError") {
      return NextResponse.json(
        { error: "Invalid input", details: e },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Failed to create connection" },
      { status: 500 }
    );
  }
}
