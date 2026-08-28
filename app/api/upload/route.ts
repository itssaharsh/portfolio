import { NextResponse, type NextRequest } from "next/server";
import { signedIn } from "@/lib/auth";
import { getStore } from "@/lib/store";

export const runtime = "nodejs";
/* Vercel Functions cap the request body at 4.5MB, so the ceiling is theirs, not ours.
   Refusing at 4MB gives a clear message instead of an opaque platform error. */
const MAX = 4 * 1024 * 1024;

/**
 * Images go through the server so the browser never holds a write token.
 * Whichever store is selected decides where they land.
 */
export async function POST(request: NextRequest) {
  if (!(await signedIn())) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "That was not a file upload." }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "No file." }, { status: 400 });
  if (!file.type.startsWith("image/")) return NextResponse.json({ error: "Images only." }, { status: 415 });
  if (file.size > MAX) return NextResponse.json({ error: "That image is over 4MB. Resize it and try again." }, { status: 413 });

  const ext = (file.name.split(".").pop() || "png").toLowerCase().replace(/[^a-z0-9]/g, "");
  const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  try {
    const url = await getStore().putImage(name, await file.arrayBuffer(), file.type);
    return NextResponse.json({ url });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Upload failed." }, { status: 500 });
  }
}
