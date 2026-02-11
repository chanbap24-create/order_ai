import { NextResponse } from "next/server";
import { db } from "@/app/lib/db";
import path from "path";
import fs from "fs";

export const runtime = "nodejs";

export async function GET() {
  try {
    const cwd = process.cwd();
    const originalPath = path.join(cwd, "data.sqlite3");
    const tmpPath = "/tmp/data.sqlite3";

    const info: Record<string, unknown> = {
      cwd,
      originalExists: fs.existsSync(originalPath),
      tmpExists: fs.existsSync(tmpPath),
      env: process.env.VERCEL ? "vercel" : "local",
    };

    if (fs.existsSync(originalPath)) {
      const stat = fs.statSync(originalPath);
      info.originalSize = stat.size;
      info.originalMtime = stat.mtime.toISOString();
    }
    if (fs.existsSync(tmpPath)) {
      const stat = fs.statSync(tmpPath);
      info.tmpSize = stat.size;
      info.tmpMtime = stat.mtime.toISOString();
    }

    // Check tables
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all() as { name: string }[];
    info.tables = tables.map(t => t.name);

    // Check wines count
    try {
      const wineCount = (db.prepare("SELECT COUNT(*) as c FROM wines").get() as { c: number }).c;
      info.winesCount = wineCount;

      const sample = db.prepare("SELECT item_code, item_name_en, ai_researched FROM wines WHERE item_code = '2421031'").get();
      info.wine2421031 = sample || "NOT FOUND";

      const first5 = db.prepare("SELECT item_code, item_name_kr FROM wines LIMIT 5").all();
      info.winesSample = first5;
    } catch (e) {
      info.winesError = e instanceof Error ? e.message : String(e);
    }

    return NextResponse.json(info, { status: 200 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
