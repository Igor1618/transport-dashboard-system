import { NextRequest, NextResponse } from "next/server";
const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:3001";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams.toString();
  try {
    const res = await fetch(`${BACKEND_URL}/cards/list?${params}`);
    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ cards: [] }, { status: 500 });
  }
}
