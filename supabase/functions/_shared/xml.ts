import { cleanText } from './tenders.ts';

export function decodeXmlEntities(value: string) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)));
}

function tagPattern(localName: string) {
  return String.raw`(?:[A-Za-z0-9_.-]+:)?${localName}`;
}

export function stripXmlTags(value: string) {
  return decodeXmlEntities(value.replace(/<[^>]+>/g, ' '));
}

export function xmlElementBlocks(xml: string, localName: string) {
  const pattern = new RegExp(
    String.raw`<${tagPattern(localName)}(?:\s[^>]*)?>([\s\S]*?)<\/${tagPattern(localName)}>`,
    'gi'
  );
  const blocks: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(xml)) !== null) {
    blocks.push(match[1]);
  }
  return blocks;
}

export function firstXmlText(xml: string, localNames: string[]) {
  for (const localName of localNames) {
    const block = xmlElementBlocks(xml, localName)[0];
    const text = cleanText(stripXmlTags(block || ''));
    if (text) return text;
  }
  return '';
}

export function xmlTexts(xml: string, localNames: string[]) {
  const out = new Set<string>();
  for (const localName of localNames) {
    for (const block of xmlElementBlocks(xml, localName)) {
      const text = cleanText(stripXmlTags(block));
      if (text) out.add(text);
    }
  }
  return [...out];
}

export function xmlAttributeValues(xml: string, localName: string, attributeName: string) {
  const pattern = new RegExp(
    String.raw`<${tagPattern(localName)}\b[^>]*\s${attributeName}=(["'])(.*?)\1`,
    'gi'
  );
  const values: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(xml)) !== null) {
    const value = cleanText(decodeXmlEntities(match[2]));
    if (value) values.push(value);
  }
  return values;
}

export function xmlRecord(xml: string) {
  const record: Record<string, unknown> = {};
  const pattern = /<([A-Za-z0-9_.-]+:)?([A-Za-z0-9_.-]+)(?:\s[^>]*)?>([\s\S]*?)<\/(?:[A-Za-z0-9_.-]+:)?\2>/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(xml)) !== null) {
    const key = match[2];
    const text = cleanText(stripXmlTags(match[3]));
    if (text && !record[key]) record[key] = text;
  }
  return record;
}
