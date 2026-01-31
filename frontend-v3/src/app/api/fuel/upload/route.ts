import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:3001";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    
    const res = await fetch(`${BACKEND_URL}/fuel/upload`, {
      method: "POST",
      body: formData
    });

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ success: false, message: "Upload failed" }, { status: 500 });
  }
}
