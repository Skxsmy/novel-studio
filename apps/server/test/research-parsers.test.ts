import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { parseResearchFile } from "../src/researchParsers.js";

function upload(bytes: Buffer, fileName: string, mediaType: Parameters<typeof parseResearchFile>[0]["mediaType"]) {
  return parseResearchFile({
    contentBase64: bytes.toString("base64"),
    fileName,
    mediaType,
    sizeBytes: bytes.byteLength,
  });
}

async function docxBytes(options: { external?: boolean; hyperlink?: boolean } = {}): Promise<Buffer> {
  const zip = new JSZip();
  zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8"?>
    <Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
      <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
      <Default Extension="xml" ContentType="application/xml"/>
      <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
    </Types>`);
  zip.file("_rels/.rels", `<?xml version="1.0" encoding="UTF-8"?>
    <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
      <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
    </Relationships>`);
  zip.file("word/document.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
    <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
      <w:body>
        <w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>港湾史料</w:t></w:r></w:p>
        <w:p><w:r><w:t>潮声 crossed the harbor at midnight.</w:t></w:r></w:p>
        <w:sectPr/>
      </w:body>
    </w:document>`);
  zip.file("word/styles.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
    <w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
      <w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/></w:style>
    </w:styles>`);
  if (options.external || options.hyperlink) {
    const relationshipType = options.hyperlink ? "hyperlink" : "image";
    const target = options.hyperlink ? "https://example.com/reference" : "file:///private/image.png";
    zip.file("word/_rels/document.xml.rels", `<?xml version="1.0" encoding="UTF-8"?>
      <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
        <Relationship Id="rId9" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/${relationshipType}" Target="${target}" TargetMode="External"/>
      </Relationships>`);
  }
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE", platform: "UNIX" });
}

function pdfBytes(text?: string): Buffer {
  const stream = text ? `BT /F1 18 Tf 72 720 Td (${text.replace(/[()\\]/gu, "\\$&")}) Tj ET` : "q Q";
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let body = "%PDF-1.4\n";
  const offsets = [0];
  for (const [index, object] of objects.entries()) {
    offsets.push(Buffer.byteLength(body));
    body += `${index + 1} 0 obj\n${object}\nendobj\n`;
  }
  const xrefOffset = Buffer.byteLength(body);
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1)) body += `${String(offset).padStart(10, "0")} 00000 n \n`;
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(body, "binary");
}

async function epubBytes(): Promise<Buffer> {
  const zip = new JSZip();
  zip.file("mimetype", "application/epub+zip", { compression: "STORE" });
  zip.file("META-INF/container.xml", `<?xml version="1.0"?>
    <container><rootfiles><rootfile full-path="OPS/package.opf"/></rootfiles></container>`);
  zip.file("OPS/package.opf", `<?xml version="1.0"?>
    <package><manifest>
      <item id="chapter-one" href="chapter1.xhtml" media-type="application/xhtml+xml"/>
      <item id="chapter-two" href="chapter2.xhtml" media-type="application/xhtml+xml"/>
    </manifest><spine><itemref idref="chapter-one"/><itemref idref="chapter-two"/></spine></package>`);
  zip.file("OPS/chapter1.xhtml", "<html><head><title>Sea Book</title></head><body><h1>第一章</h1><p>港を出た船。</p></body></html>");
  zip.file("OPS/chapter2.xhtml", "<html><body><h1>Chapter Two</h1><p>The vessel crossed the northern sea.</p></body></html>");
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE", platform: "UNIX" });
}

describe("Research format parsers", () => {
  it("parses text encodings and Markdown structure with stable line locations", async () => {
    const text = Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from("第一章\n\n潮声。", "utf16le")]);
    const parsedText = await upload(text, "notes.txt", "text/plain");
    expect(parsedText.parsed.warnings).toContain("Text decoded as UTF-16 LE.");
    expect(parsedText.parsed.blocks[0]?.location).toMatchObject({ kind: "text", startLine: 1 });

    const markdown = await upload(Buffer.from("# 航路\n\n- harbor log\n\n> 夜の潮", "utf8"), "route.md", "text/markdown");
    expect(markdown.parsed.sections.map((section) => section.title)).toEqual(["航路"]);
    expect(markdown.parsed.blocks.map((block) => block.kind)).toEqual(["heading", "list-item", "quote"]);
  });

  it("bounds multi-megabyte single-line and many-paragraph text in one linear scan", async () => {
    const singleLine = Buffer.from("harbor evidence ".repeat(196_608), "utf8");
    const parsedSingleLine = await upload(singleLine, "large-single-line.txt", "text/plain");
    expect(parsedSingleLine.parsed.blocks.length).toBeGreaterThan(1);
    expect(Math.max(...parsedSingleLine.parsed.blocks.map((block) => block.text.length))).toBeLessThanOrEqual(16_000);
    expect(parsedSingleLine.parsed.blocks.at(-1)?.location).toMatchObject({
      kind: "text",
      endOffset: singleLine.byteLength,
    });

    const unicodeBoundary = `${"A".repeat(15_999)}😀tail`;
    const parsedUnicode = await upload(Buffer.from(unicodeBoundary, "utf8"), "unicode-boundary.txt", "text/plain");
    expect(parsedUnicode.parsed.blocks.map((block) => block.text).join("")).toBe(unicodeBoundary);
    expect(parsedUnicode.parsed.blocks.every((block) => Array.from(block.text).every((character) => (
      character.length > 1
      || character.charCodeAt(0) < 0xd800
      || character.charCodeAt(0) > 0xdfff
    )))).toBe(true);

    const paragraph = "Harbor ledger entry for the northern route.";
    const manyParagraphs = Buffer.from(`${paragraph}\n\n`.repeat(70_000), "utf8");
    const parsedMany = await upload(manyParagraphs, "large-paragraphs.txt", "text/plain");
    expect(parsedMany.parsed.blocks.length).toBeLessThan(500);
    expect(Math.max(...parsedMany.parsed.blocks.map((block) => block.text.length))).toBeLessThanOrEqual(16_000);
    expect(parsedMany.parsed.blocks[0]?.text).toContain("\n\n");
  }, 30_000);

  it("parses a real DOCX ZIP, permits hyperlinks, and rejects external files", async () => {
    const parsed = await upload(
      await docxBytes(),
      "harbor.docx",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
    expect(parsed.parsed.kind).toBe("docx");
    expect(parsed.parsed.blocks.map((block) => block.text).join(" ")).toContain("harbor at midnight");
    expect(parsed.parsed.blocks[0]?.location).toMatchObject({ kind: "docx" });

    await expect(upload(
      await docxBytes({ hyperlink: true }),
      "hyperlink.docx",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    )).resolves.toMatchObject({ parsed: { kind: "docx" } });

    await expect(upload(
      await docxBytes({ external: true }),
      "external.docx",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    )).rejects.toThrow("external file relationship");
  });

  it("keeps PDF page locations and honestly rejects image-only PDFs", async () => {
    const parsed = await upload(pdfBytes("Harbor archive page one"), "archive.pdf", "application/pdf");
    expect(parsed.parsed.blocks[0]).toMatchObject({
      text: "Harbor archive page one",
      location: { kind: "pdf", page: 1, paragraph: 1 },
    });
    await expect(upload(pdfBytes(), "scan.pdf", "application/pdf")).rejects.toThrow("OCR is required");
  });

  it("follows EPUB package spine order and rejects unsafe ZIP entries", async () => {
    const parsed = await upload(await epubBytes(), "voyage.epub", "application/epub+zip");
    expect(parsed.parsed.blocks.map((block) => block.text)).toEqual([
      "第一章",
      "港を出た船。",
      "Chapter Two",
      "The vessel crossed the northern sea.",
    ]);
    expect(parsed.parsed.blocks[2]?.location).toMatchObject({ kind: "epub", spineIndex: 1 });

    const unsafe = new JSZip();
    unsafe.file("mimetype", "application/epub+zip");
    unsafe.file("../outside.xhtml", "<p>escape</p>");
    await expect(upload(
      await unsafe.generateAsync({ type: "nodebuffer", platform: "UNIX" }),
      "unsafe.epub",
      "application/epub+zip",
    )).rejects.toThrow("unsafe path");
  });

  it("sanitizes HTML active content without losing visible evidence or DOM locations", async () => {
    const parsed = await upload(Buffer.from(`<!doctype html><html><head><title>Archive</title><script>steal()</script></head>
      <body onload="steal()"><h1>Primary source</h1><p style="color:red">灯台守の記録: Visible <a href="javascript:steal()">harbor</a> text.</p><iframe src="https://example.com"></iframe></body></html>`, "utf8"), "page.html", "text/html");
    expect(parsed.parsed.blocks.map((block) => block.text)).toEqual(["Primary source", "灯台守の記録: Visible harbor text."]);
    expect(parsed.parsed.warnings).toEqual([]);
    expect(parsed.parsed.blocks[1]?.location).toMatchObject({ kind: "html" });
    const snapshot = parsed.parsed.sanitizedSnapshot?.toString("utf8") ?? "";
    expect(snapshot).not.toMatch(/script|iframe|onload|javascript:/iu);
  });

  it("rejects extension/media mismatches, disguised binary text, and expansion bombs", async () => {
    await expect(upload(Buffer.from("plain"), "plain.pdf", "text/plain")).rejects.toThrow("do not match");
    await expect(upload(Buffer.from([0, 1, 2, 3, 0, 4]), "binary.txt", "text/plain")).rejects.toThrow();

    const bomb = new JSZip();
    bomb.file("mimetype", "application/epub+zip");
    bomb.file("META-INF/container.xml", "A".repeat(2 * 1024 * 1024));
    await expect(upload(
      await bomb.generateAsync({ type: "nodebuffer", compression: "DEFLATE", compressionOptions: { level: 9 } }),
      "bomb.epub",
      "application/epub+zip",
    )).rejects.toThrow("expansion limits");
  });
});
