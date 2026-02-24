import { NextResponse } from "next/server";

export async function GET() {
  const steps: string[] = [];
  try {
    steps.push("1. importing pdfkit");
    const PDFDocument = (await import("pdfkit")).default;
    steps.push("2. pdfkit imported OK");

    steps.push("3. creating doc");
    const doc = new PDFDocument({ size: [540, 720], margin: 0, autoFirstPage: false });
    steps.push("4. doc created");

    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));

    doc.addPage();
    steps.push("5. page added");

    doc.text("Hello PDF test");
    steps.push("6. text added");

    doc.end();
    steps.push("7. doc.end() called");

    const buffer = await new Promise<Buffer>((resolve, reject) => {
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);
    });
    steps.push(`8. PDF generated: ${buffer.length} bytes`);

    return NextResponse.json({ success: true, steps, size: buffer.length });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const stack = e instanceof Error ? e.stack : undefined;
    return NextResponse.json({ success: false, steps, error: msg, stack }, { status: 500 });
  }
}
