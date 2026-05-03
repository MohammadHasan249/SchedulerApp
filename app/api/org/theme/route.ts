import { NextResponse } from "next/server";

export async function PATCH() {
  return NextResponse.json(
    { error: "Theme customization is not yet available." },
    { status: 503 }
  );
}
