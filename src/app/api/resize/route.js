import sharp from "sharp";
import { NextResponse } from "next/server";

const TARGET_SIZE = 640;

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const resized = await sharp(buffer)
      .resize(TARGET_SIZE, TARGET_SIZE, { fit: "cover" })
      .jpeg({ quality: 92 })
      .toBuffer();

    return new NextResponse(resized, {
      headers: { "Content-Type": "image/jpeg" },
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
