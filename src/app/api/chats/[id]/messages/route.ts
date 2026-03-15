import { NextResponse } from "next/server";
import { getMessages, getChat } from "@/lib/db/app-db";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const chat = getChat(id);

  if (!chat) {
    return NextResponse.json({ error: "Chat not found" }, { status: 404 });
  }

  const messages = getMessages(id);
  return NextResponse.json(messages);
}
