import { NextResponse } from "next/server";
import {
  getConnection,
  updateConnection,
  deleteConnection,
} from "@/lib/db/app-db";
import { createConnectionSchema } from "@/lib/schemas";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const conn = getConnection(id);
  if (!conn) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const { config_encrypted, ...safe } = conn;
  return NextResponse.json(safe);
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const body = await request.json();
    const parsed = createConnectionSchema.parse(body);
    const updated = updateConnection(id, parsed.name, parsed.config);
    if (!updated) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const { config_encrypted, ...safe } = updated;
    return NextResponse.json(safe);
  } catch (e) {
    if (e instanceof Error && e.name === "ZodError") {
      return NextResponse.json(
        { error: "Invalid input", details: e },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Failed to update connection" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const deleted = deleteConnection(id);
  if (!deleted) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}
