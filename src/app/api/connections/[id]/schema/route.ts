import { NextResponse } from "next/server";
import { getConnectionConfig } from "@/lib/db/app-db";
import { createDriver } from "@/lib/db/drivers";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const config = getConnectionConfig(id);

  if (!config) {
    return NextResponse.json({ error: "Connection not found" }, { status: 404 });
  }

  try {
    const driver = createDriver(config);
    await driver.connect();
    const schema = await driver.introspect();
    await driver.disconnect();

    return NextResponse.json(schema);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to introspect schema" },
      { status: 500 }
    );
  }
}
