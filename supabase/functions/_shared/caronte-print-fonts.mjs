export const FONT_ASSETS = Object.freeze({
  regular: {file: 'CrimsonText-Regular.ttf', sha256: '48e6c5d5ad1d01599d374ecb817e15890d1feb3b8a3a88e527d44c90389e1f06'},
  bold: {file: 'CrimsonText-Bold.ttf', sha256: 'a3a0765fc5e8d0b49b540a23aefe0184887dd79f06a0bdf4db7035cea6befa93'},
  italic: {file: 'CrimsonText-Italic.ttf', sha256: '4ed1699ac7c64e8b3d33f6bb8323c3d7206b0d7bacb9ee2d65c697e6014d29de'}
});

export async function loadPrintFonts(readFile) {
  return Object.fromEntries(await Promise.all(Object.entries(FONT_ASSETS).map(async ([name, asset]) => {
    const bytes = await readFile(new URL(`../future-book-session/fonts/${asset.file}`, import.meta.url));
    const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)),
      byte => byte.toString(16).padStart(2, '0')).join('');
    if (hash !== asset.sha256) throw new Error('print_font_asset_mismatch');
    return [name, bytes];
  })));
}
