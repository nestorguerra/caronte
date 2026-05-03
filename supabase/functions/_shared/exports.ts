type ZipFile = {
  path: string;
  content: string | Uint8Array;
};

const crcTable = new Uint32Array(256).map((_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  return value >>> 0;
});

function bytes(value: string | Uint8Array) {
  return value instanceof Uint8Array ? value : new TextEncoder().encode(value);
}

function dosDateTime(date = new Date()) {
  const year = Math.max(1980, date.getUTCFullYear());
  const dosTime = (date.getUTCHours() << 11) | (date.getUTCMinutes() << 5) | Math.floor(date.getUTCSeconds() / 2);
  const dosDate = ((year - 1980) << 9) | ((date.getUTCMonth() + 1) << 5) | date.getUTCDate();
  return { dosTime, dosDate };
}

function writeU16(out: number[], value: number) {
  out.push(value & 0xff, (value >>> 8) & 0xff);
}

function writeU32(out: number[], value: number) {
  out.push(value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff);
}

function crc32(data: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of data) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function b64(data: Uint8Array) {
  let binary = '';
  const chunk = 0x8000;
  for (let index = 0; index < data.length; index += chunk) {
    binary += String.fromCharCode(...data.subarray(index, index + chunk));
  }
  return btoa(binary);
}

function escapeXml(value: unknown) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function createZipBase64(files: ZipFile[]) {
  const local: number[] = [];
  const central: number[] = [];
  const { dosTime, dosDate } = dosDateTime();
  let offset = 0;

  for (const file of files) {
    const name = bytes(file.path);
    const data = bytes(file.content);
    const crc = crc32(data);

    writeU32(local, 0x04034b50);
    writeU16(local, 20);
    writeU16(local, 0);
    writeU16(local, 0);
    writeU16(local, dosTime);
    writeU16(local, dosDate);
    writeU32(local, crc);
    writeU32(local, data.length);
    writeU32(local, data.length);
    writeU16(local, name.length);
    writeU16(local, 0);
    local.push(...name, ...data);

    writeU32(central, 0x02014b50);
    writeU16(central, 20);
    writeU16(central, 20);
    writeU16(central, 0);
    writeU16(central, 0);
    writeU16(central, dosTime);
    writeU16(central, dosDate);
    writeU32(central, crc);
    writeU32(central, data.length);
    writeU32(central, data.length);
    writeU16(central, name.length);
    writeU16(central, 0);
    writeU16(central, 0);
    writeU16(central, 0);
    writeU16(central, 0);
    writeU32(central, 0);
    writeU32(central, offset);
    central.push(...name);

    offset = local.length;
  }

  const end: number[] = [];
  writeU32(end, 0x06054b50);
  writeU16(end, 0);
  writeU16(end, 0);
  writeU16(end, files.length);
  writeU16(end, files.length);
  writeU32(end, central.length);
  writeU32(end, local.length);
  writeU16(end, 0);

  return b64(new Uint8Array([...local, ...central, ...end]));
}

type ParagraphTone = 'title' | 'meta' | 'heading1' | 'heading2' | 'bullet' | 'table' | 'body';

function paragraph(text: string, tone: ParagraphTone = 'body') {
  const toneMap: Record<ParagraphTone, { color: string; size: number; bold: boolean; spacing: number; indent?: number; font?: string }> = {
    title: { color: '074B93', size: 34, bold: true, spacing: 260 },
    meta: { color: '5D6B7F', size: 20, bold: false, spacing: 220 },
    heading1: { color: '074B93', size: 28, bold: true, spacing: 240 },
    heading2: { color: '17243A', size: 24, bold: true, spacing: 180 },
    bullet: { color: '23324A', size: 21, bold: false, spacing: 120, indent: 360 },
    table: { color: '23324A', size: 18, bold: false, spacing: 80, font: 'Aptos Mono' },
    body: { color: '23324A', size: 21, bold: false, spacing: 140 }
  };
  const style = toneMap[tone];
  const indent = style.indent ? `<w:ind w:left="${style.indent}" w:hanging="160"/>` : '';
  const font = style.font ? `<w:rFonts w:ascii="${style.font}" w:hAnsi="${style.font}"/>` : '';
  return `<w:p>
    <w:pPr><w:spacing w:after="${style.spacing}"/>${indent}</w:pPr>
    <w:r>
      <w:rPr>${font}${style.bold ? '<w:b/>' : ''}<w:color w:val="${style.color}"/><w:sz w:val="${style.size}"/></w:rPr>
      <w:t xml:space="preserve">${escapeXml(text)}</w:t>
    </w:r>
  </w:p>`;
}

function markdownBlocks(markdown: string) {
  return markdown
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => {
      const raw = line.trimEnd().replace(/\*\*/g, '');
      if (/^#\s+/.test(raw)) return { tone: 'heading1' as ParagraphTone, text: raw.replace(/^#\s+/, '') };
      if (/^##\s+/.test(raw)) return { tone: 'heading1' as ParagraphTone, text: raw.replace(/^##\s+/, '') };
      if (/^###\s+/.test(raw)) return { tone: 'heading2' as ParagraphTone, text: raw.replace(/^###\s+/, '') };
      if (/^-\s+/.test(raw)) return { tone: 'bullet' as ParagraphTone, text: `- ${raw.replace(/^-\s+/, '')}` };
      if (/^\|.*\|$/.test(raw)) return { tone: 'table' as ParagraphTone, text: raw };
      return { tone: 'body' as ParagraphTone, text: raw };
    });
}

export function createDocxBase64(input: {
  title: string;
  markdown: string;
}) {
  const blocks = markdownBlocks(input.markdown);
  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${paragraph(input.title, 'title')}
    ${paragraph(`Version exportada: ${new Date().toISOString()}`, 'meta')}
    ${blocks.map((block) => paragraph(block.text || ' ', block.tone)).join('\n')}
    <w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr>
  </w:body>
</w:document>`;

  return createZipBase64([
    {
      path: '[Content_Types].xml',
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`
    },
    {
      path: '_rels/.rels',
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`
    },
    {
      path: 'word/document.xml',
      content: documentXml
    }
  ]);
}

export function csvEscape(value: unknown) {
  const text = String(value ?? '');
  return /[",\n;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function rowsToCsv(rows: Array<Record<string, unknown>>, headers: string[]) {
  return [
    headers.join(';'),
    ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(';'))
  ].join('\n');
}
