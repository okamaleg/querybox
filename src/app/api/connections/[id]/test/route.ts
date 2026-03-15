import { NextResponse } from "next/server";
import { getConnectionConfig } from "@/lib/db/app-db";
import { createDriver } from "@/lib/db/drivers";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const config = getConnectionConfig(id);

  if (!config) {
    return NextResponse.json({ error: "Connection not found" }, { status: 404 });
  }

  const driver = createDriver(config);
  const result = await driver.testConnection();

  return NextResponse.json(result);
}
