import JSZip from 'jszip';

export interface VulnImageItem {
  id: string;
  dataUrl: string; // base64 data url (data:image/png;base64,...)
  caption: string;
  width?: number;
  height?: number;
}

export interface VulnerabilityItem {
  id: string;
  name: string;
  path: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  owasp: string;
  status: 'OPEN' | 'RESOLVED' | 'IN_PROGRESS';
  techDescription?: string;
  pocNarrative?: string;
  impact?: string;
  recommendations?: string[];
  images?: VulnImageItem[];
}

export interface VulnReportData {
  appName: string;
  targetUrl: string;
  docNumber: string;
  date: string;
  tlp: string;
  instansi: string;
  signerName: string;
  signerPosition: string;
  executiveSummary: string;
  overallImpact: string;
  conclusion: string;
  vulnerabilities: VulnerabilityItem[];
}

function escapeXml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Creates standard justified paragraph
 * Supports markdown **bold** syntax to create bold text runs within the paragraph.
 * Configured with line spacing 1.5 lines (360 dxa) and Before: 0pt, After: 0pt as shown in Gambar 4.
 * Ruler starts flush at position 0 (no indentation) as shown in Gambar 3.
 */
function createPara(text: string, options?: { bold?: boolean; align?: 'left' | 'center' | 'both' | 'right'; size?: number; color?: string; spacingBefore?: number; spacingAfter?: number; line?: number; indent?: number }): string {
  const align = options?.align || 'both';
  const size = options?.size || 22; // 11pt
  const spacingBefore = options?.spacingBefore ?? 0; // 0 pt as in Gambar 4
  const spacingAfter = options?.spacingAfter ?? 0;   // 0 pt as in Gambar 4
  const line = options?.line ?? 360;                 // 1.5 lines as in Gambar 4
  const defaultBold = !!options?.bold;
  const colorTag = options?.color ? `<w:color w:val="${options.color}"/>` : '';
  const indTag = options?.indent !== undefined ? `<w:ind w:left="${options.indent}"/>` : '';

  // Parse text for **bold** markdown tokens if present
  let runsXml = '';
  if (text.includes('**')) {
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    for (const part of parts) {
      if (!part) continue;
      const isBold = part.startsWith('**') && part.endsWith('**');
      const cleanText = isBold ? part.slice(2, -2) : part;
      const bTag = (isBold || defaultBold) ? '<w:b/><w:bCs/>' : '';
      runsXml += `<w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/>${bTag}${colorTag}<w:sz w:val="${size}"/><w:szCs w:val="${size}"/></w:rPr><w:t xml:space="preserve">${escapeXml(cleanText)}</w:t></w:r>`;
    }
  } else {
    const boldTag = defaultBold ? '<w:b/><w:bCs/>' : '';
    runsXml = `<w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/>${boldTag}${colorTag}<w:sz w:val="${size}"/><w:szCs w:val="${size}"/></w:rPr><w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r>`;
  }

  return `<w:p><w:pPr><w:spacing w:before="${spacingBefore}" w:after="${spacingAfter}" w:line="${line}" w:lineRule="auto"/>${indTag}<w:jc w:val="${align}"/><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="${size}"/><w:szCs w:val="${size}"/></w:rPr></w:pPr>${runsXml}</w:p>`;
}

/**
 * Creates the official Kemenkes CSIRT ribbon header (Grey background #B2B2B2 with bold white text)
 * Configured with ruler at position 0 (flush left margin, identical to body paragraphs) without numPr/ListParagraph list indentation.
 */
function createRibbonHeader(title: string, bookmarkId?: number, ilvl: number = 0, sectionNumber?: string): string {
  const bmStart = bookmarkId ? `<w:bookmarkStart w:id="${bookmarkId}" w:name="_Toc${bookmarkId}"/>` : '';
  const bmEnd = bookmarkId ? `<w:bookmarkEnd w:id="${bookmarkId}"/>` : '';
  const outlineLvl = ilvl === 0 ? 1 : 2;

  let displayTitle = title;
  if (sectionNumber && !displayTitle.startsWith(sectionNumber)) {
    displayTitle = `${sectionNumber} ${displayTitle}`;
  }

  return `<w:p><w:pPr><w:shd w:val="clear" w:color="auto" w:fill="B2B2B2"/><w:spacing w:before="120" w:after="120" w:line="360" w:lineRule="auto"/><w:ind w:left="0" w:firstLine="0" w:hanging="0"/><w:jc w:val="left"/><w:outlineLvl w:val="${outlineLvl}"/><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:b/><w:bCs/><w:color w:val="FFFFFF" w:themeColor="background1"/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr></w:pPr>${bmStart}<w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:b/><w:bCs/><w:color w:val="FFFFFF" w:themeColor="background1"/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr><w:t xml:space="preserve">${escapeXml(displayTitle)}</w:t></w:r>${bmEnd}</w:p>`;
}

/**
 * Creates an official recommendation list item (indented at 720 dxa with list numbering and 1.5 line spacing)
 */
function createRecommendationItem(text: string): string {
  return `<w:p><w:pPr><w:pStyle w:val="ListParagraph"/><w:numPr><w:ilvl w:val="0"/><w:numId w:val="39"/></w:numPr><w:spacing w:before="0" w:after="0" w:line="360" w:lineRule="auto"/><w:ind w:left="720"/><w:jc w:val="both"/><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr><w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r></w:p>`;
}

/**
 * Creates the official CSIRT right-aligned signer block (indented at 5670 dxa)
 */
function createSignerBlock(role: string, placeholder: string, name: string): string {
  let xml = '';
  xml += `<w:p><w:pPr><w:spacing w:line="276" w:lineRule="auto"/><w:ind w:left="5670"/><w:jc w:val="both"/><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr><w:t xml:space="preserve">${escapeXml(role)}</w:t></w:r></w:p>`;
  xml += `<w:p><w:pPr><w:spacing w:line="276" w:lineRule="auto"/><w:ind w:left="5670"/><w:jc w:val="both"/></w:pPr></w:p>`;
  xml += `<w:p><w:pPr><w:spacing w:line="276" w:lineRule="auto"/><w:ind w:left="5670"/><w:jc w:val="both"/></w:pPr></w:p>`;
  xml += `<w:p><w:pPr><w:spacing w:line="276" w:lineRule="auto"/><w:ind w:left="5670"/><w:jc w:val="both"/><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:color w:val="595959"/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:color w:val="595959"/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr><w:t xml:space="preserve">${escapeXml(placeholder)}</w:t></w:r></w:p>`;
  xml += `<w:p><w:pPr><w:spacing w:line="276" w:lineRule="auto"/><w:ind w:left="5670"/><w:jc w:val="both"/></w:pPr></w:p>`;
  xml += `<w:p><w:pPr><w:spacing w:line="276" w:lineRule="auto"/><w:ind w:left="5670"/><w:jc w:val="both"/></w:pPr></w:p>`;
  xml += `<w:p><w:pPr><w:spacing w:line="276" w:lineRule="auto"/><w:ind w:left="5670"/><w:jc w:val="both"/><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:b/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:b/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr><w:t xml:space="preserve">${escapeXml(name)}</w:t></w:r></w:p>`;
  return xml;
}

/**
 * Creates table matching Section 2 of Kemenkes CSIRT template
 */
function createVulnTable(vulnerabilities: VulnerabilityItem[]): string {
  const colWidths = [567, 1701, 2694, 1417, 1212, 889]; // Total: 8480 dxa

  // Table header row
  const headerCells = [
    { title: 'No', width: colWidths[0] },
    { title: 'Kerentanan', width: colWidths[1] },
    { title: 'Path/Endpoint', width: colWidths[2] },
    { title: 'Risiko', width: colWidths[3] },
    { title: 'OWASP', width: colWidths[4] },
    { title: 'Status', width: colWidths[5] }
  ];

  let headerXml = '<w:tr><w:trPr><w:tblHeader/><w:trHeight w:val="280"/></w:trPr>';
  for (const h of headerCells) {
    headerXml += `<w:tc><w:tcPr><w:tcW w:w="${h.width}" w:type="dxa"/><w:shd w:val="clear" w:color="auto" w:fill="AEAAAA" w:themeFill="background2" w:themeFillShade="BF"/><w:vAlign w:val="center"/></w:tcPr><w:p><w:pPr><w:spacing w:line="276" w:lineRule="auto"/><w:jc w:val="center"/><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:b/><w:bCs/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:b/><w:bCs/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr><w:t>${escapeXml(h.title)}</w:t></w:r></w:p></w:tc>`;
  }
  headerXml += '</w:tr>';

  // Data rows
  let rowsXml = '';
  vulnerabilities.forEach((v, idx) => {
    const sevColor = v.severity === 'CRITICAL' ? 'DC2626' : v.severity === 'HIGH' ? 'EA580C' : v.severity === 'MEDIUM' ? 'CA8A04' : '2563EB';

    rowsXml += `<w:tr><w:trPr><w:trHeight w:val="240"/></w:trPr>`;

    // Col 1: No
    rowsXml += `<w:tc><w:tcPr><w:tcW w:w="${colWidths[0]}" w:type="dxa"/><w:vAlign w:val="center"/></w:tcPr><w:p><w:pPr><w:spacing w:line="276" w:lineRule="auto"/><w:jc w:val="center"/><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr><w:t>${idx + 1}.</w:t></w:r></w:p></w:tc>`;

    // Col 2: Kerentanan
    rowsXml += `<w:tc><w:tcPr><w:tcW w:w="${colWidths[1]}" w:type="dxa"/><w:vAlign w:val="center"/></w:tcPr><w:p><w:pPr><w:spacing w:line="276" w:lineRule="auto"/><w:jc w:val="left"/><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr><w:t>${escapeXml(v.name)}</w:t></w:r></w:p></w:tc>`;

    // Col 3: Path/Endpoint (Center aligned as requested)
    rowsXml += `<w:tc><w:tcPr><w:tcW w:w="${colWidths[2]}" w:type="dxa"/><w:vAlign w:val="center"/></w:tcPr><w:p><w:pPr><w:spacing w:line="276" w:lineRule="auto"/><w:jc w:val="center"/><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr><w:t>${escapeXml(v.path || '/')}</w:t></w:r></w:p></w:tc>`;

    // Col 4: Risiko (Black Bold only, no color, as requested)
    rowsXml += `<w:tc><w:tcPr><w:tcW w:w="${colWidths[3]}" w:type="dxa"/><w:vAlign w:val="center"/></w:tcPr><w:p><w:pPr><w:spacing w:line="276" w:lineRule="auto"/><w:jc w:val="center"/><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:b/><w:bCs/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:b/><w:bCs/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr><w:t>${escapeXml(v.severity)}</w:t></w:r></w:p></w:tc>`;

    // Col 5: OWASP
    rowsXml += `<w:tc><w:tcPr><w:tcW w:w="${colWidths[4]}" w:type="dxa"/><w:vAlign w:val="center"/></w:tcPr><w:p><w:pPr><w:spacing w:line="276" w:lineRule="auto"/><w:jc w:val="center"/><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr><w:t>${escapeXml(v.owasp || 'A00:2025')}</w:t></w:r></w:p></w:tc>`;

    // Col 6: Status
    rowsXml += `<w:tc><w:tcPr><w:tcW w:w="${colWidths[5]}" w:type="dxa"/><w:vAlign w:val="center"/></w:tcPr><w:p><w:pPr><w:spacing w:line="276" w:lineRule="auto"/><w:jc w:val="center"/><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:b/><w:bCs/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:b/><w:bCs/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr><w:t>${escapeXml(v.status || 'OPEN')}</w:t></w:r></w:p></w:tc>`;

    rowsXml += `</w:tr>`;
  });

  return `<w:tbl><w:tblPr><w:tblW w:w="8480" w:type="dxa"/><w:jc w:val="center"/><w:tblBorders><w:top w:val="single" w:sz="4" w:space="0" w:color="auto"/><w:left w:val="single" w:sz="4" w:space="0" w:color="auto"/><w:bottom w:val="single" w:sz="4" w:space="0" w:color="auto"/><w:right w:val="single" w:sz="4" w:space="0" w:color="auto"/><w:insideH w:val="single" w:sz="4" w:space="0" w:color="auto"/><w:insideV w:val="single" w:sz="4" w:space="0" w:color="auto"/></w:tblBorders><w:tblLayout w:type="fixed"/><w:tblCellMar><w:top w:w="80" w:type="dxa"/><w:left w:w="120" w:type="dxa"/><w:bottom w:w="80" w:type="dxa"/><w:right w:w="120" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid><w:gridCol w:w="${colWidths[0]}"/><w:gridCol w:w="${colWidths[1]}"/><w:gridCol w:w="${colWidths[2]}"/><w:gridCol w:w="${colWidths[3]}"/><w:gridCol w:w="${colWidths[4]}"/><w:gridCol w:w="${colWidths[5]}"/></w:tblGrid>${headerXml}${rowsXml}</w:tbl>`;
}

/**
 * Helper to retrieve image bytes from base64 dataUrl, local filesystem, or fetch
 */
async function getImageBytes(urlOrData: string): Promise<Uint8Array | null> {
  if (!urlOrData) return null;
  if (urlOrData.startsWith('data:')) {
    const base64Data = urlOrData.replace(/^data:image\/[a-zA-Z]+;base64,/, '');
    const binaryStr = typeof atob === 'function' ? atob(base64Data) : Buffer.from(base64Data, 'base64').toString('binary');
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }
    return bytes;
  }
  // If in Node.js environment
  if (typeof process !== 'undefined' && process.cwd) {
    try {
      const fs = await import('fs');
      const path = await import('path');
      const cleanRel = urlOrData.replace(/^\//, '');
      const candidatePaths = [
        path.resolve(process.cwd(), 'public', cleanRel),
        path.resolve(process.cwd(), 'dist', cleanRel),
        path.resolve(process.cwd(), cleanRel)
      ];
      for (const p of candidatePaths) {
        if (fs.existsSync(p)) {
          const buf = fs.readFileSync(p);
          return new Uint8Array(buf);
        }
      }
    } catch {
      // ignore
    }
  }
  // If in browser or fetch available
  if (typeof fetch === 'function') {
    try {
      const resp = await fetch(urlOrData);
      if (resp.ok) {
        const ab = await resp.arrayBuffer();
        return new Uint8Array(ab);
      }
    } catch {
      // ignore
    }
  }
  return null;
}

/**
 * Creates inline drawing for screenshot with caption
 */
function createScreenshotDrawing(rId: string, docPrId: number, caption: string, widthPx: number = 540, heightPx: number = 280): string {
  // 1 pixel = 9525 EMU
  const widthEmu = Math.round(widthPx * 9525);
  const heightEmu = Math.round(heightPx * 9525);

  const drawingXml = `<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:before="140" w:after="80"/></w:pPr><w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${widthEmu}" cy="${heightEmu}"/><wp:effectExtent l="0" t="0" r="8255" b="8255"/><wp:docPr id="${docPrId}" name="Screenshot ${docPrId}"/><wp:cNvGraphicFramePr><a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/></wp:cNvGraphicFramePr><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="${docPrId}" name=""/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${rId}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${widthEmu}" cy="${heightEmu}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`;

  const captionXml = `<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:after="160"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:i/><w:sz w:val="20"/><w:szCs w:val="20"/><w:color w:val="595959"/></w:rPr><w:t xml:space="preserve">${escapeXml(caption)}</w:t></w:r></w:p>`;

  return drawingXml + captionXml;
}

/**
 * Builds dynamic Table of Contents entries XML
 */
function buildTocEntriesXml(vulnerabilities: VulnerabilityItem[]): string {
  // Standard TOC headers in CSIRT template:
  // Notifikasi Kerentanan
  // 1. Ringkasan Eksekutif
  // 2. Kerentanan
  // 3. PoC
  //   3.1 ...
  //   3.2 ...
  // 4. Dampak
  // 5. Simpulan
  // 6. Rekomendasi

  let xml = '';

  // Item: Notifikasi Kerentanan (includes TOC field instruction start)
  xml += `<w:p><w:pPr><w:pStyle w:val="TOC1"/><w:tabs><w:tab w:val="right" w:leader="dot" w:pos="9062"/></w:tabs><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:b/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/></w:rPr><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/></w:rPr><w:instrText xml:space="preserve"> TOC \\o "1-3" \\h \\z \\u </w:instrText></w:r><w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/></w:rPr><w:fldChar w:fldCharType="separate"/></w:r><w:hyperlink w:anchor="_Toc1" w:history="1"><w:r><w:rPr><w:rStyle w:val="Hyperlink"/><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:b/></w:rPr><w:t>Notifikasi Kerentanan</w:t></w:r><w:r><w:tab/><w:fldChar w:fldCharType="begin"/><w:instrText xml:space="preserve"> PAGEREF _Toc1 \\h </w:instrText><w:fldChar w:fldCharType="separate"/><w:t>2</w:t><w:fldChar w:fldCharType="end"/></w:r></w:hyperlink></w:p>`;

  // 1. Ringkasan Eksekutif
  xml += `<w:p><w:pPr><w:pStyle w:val="TOC2"/><w:tabs><w:tab w:val="left" w:pos="960"/><w:tab w:val="right" w:leader="dot" w:pos="9062"/></w:tabs><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:b/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr></w:pPr><w:hyperlink w:anchor="_Toc2" w:history="1"><w:r><w:rPr><w:rStyle w:val="Hyperlink"/><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:b/></w:rPr><w:t>1.</w:t></w:r><w:r><w:tab/></w:r><w:r><w:rPr><w:rStyle w:val="Hyperlink"/><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:b/></w:rPr><w:t>Ringkasan Eksekutif</w:t></w:r><w:r><w:tab/><w:fldChar w:fldCharType="begin"/><w:instrText xml:space="preserve"> PAGEREF _Toc2 \\h </w:instrText><w:fldChar w:fldCharType="separate"/><w:t>2</w:t><w:fldChar w:fldCharType="end"/></w:r></w:hyperlink></w:p>`;

  // 2. Kerentanan
  xml += `<w:p><w:pPr><w:pStyle w:val="TOC2"/><w:tabs><w:tab w:val="left" w:pos="960"/><w:tab w:val="right" w:leader="dot" w:pos="9062"/></w:tabs><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:b/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr></w:pPr><w:hyperlink w:anchor="_Toc3" w:history="1"><w:r><w:rPr><w:rStyle w:val="Hyperlink"/><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:b/></w:rPr><w:t>2.</w:t></w:r><w:r><w:tab/></w:r><w:r><w:rPr><w:rStyle w:val="Hyperlink"/><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:b/></w:rPr><w:t>Kerentanan</w:t></w:r><w:r><w:tab/><w:fldChar w:fldCharType="begin"/><w:instrText xml:space="preserve"> PAGEREF _Toc3 \\h </w:instrText><w:fldChar w:fldCharType="separate"/><w:t>2</w:t><w:fldChar w:fldCharType="end"/></w:r></w:hyperlink></w:p>`;

  // 3. PoC
  xml += `<w:p><w:pPr><w:pStyle w:val="TOC2"/><w:tabs><w:tab w:val="left" w:pos="960"/><w:tab w:val="right" w:leader="dot" w:pos="9062"/></w:tabs><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:b/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr></w:pPr><w:hyperlink w:anchor="_Toc4" w:history="1"><w:r><w:rPr><w:rStyle w:val="Hyperlink"/><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:b/></w:rPr><w:t>3.</w:t></w:r><w:r><w:tab/></w:r><w:r><w:rPr><w:rStyle w:val="Hyperlink"/><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:b/></w:rPr><w:t>PoC</w:t></w:r><w:r><w:tab/><w:fldChar w:fldCharType="begin"/><w:instrText xml:space="preserve"> PAGEREF _Toc4 \\h </w:instrText><w:fldChar w:fldCharType="separate"/><w:t>2</w:t><w:fldChar w:fldCharType="end"/></w:r></w:hyperlink></w:p>`;

  // 3.1, 3.2 ... Sub-items (Bolded as requested in Gambar 1)
  vulnerabilities.forEach((v, idx) => {
    const subNum = `3.${idx + 1}`;
    const bmId = 40 + idx;
    xml += `<w:p><w:pPr><w:pStyle w:val="TOC3"/><w:tabs><w:tab w:val="left" w:pos="1440"/><w:tab w:val="right" w:leader="dot" w:pos="9062"/></w:tabs><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:b/><w:bCs/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr></w:pPr><w:hyperlink w:anchor="_Toc${bmId}" w:history="1"><w:r><w:rPr><w:rStyle w:val="Hyperlink"/><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:b/><w:bCs/></w:rPr><w:t>${subNum}</w:t></w:r><w:r><w:rPr><w:b/><w:bCs/></w:rPr><w:tab/></w:r><w:r><w:rPr><w:rStyle w:val="Hyperlink"/><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:b/><w:bCs/></w:rPr><w:t>${escapeXml(v.name)}</w:t></w:r><w:r><w:tab/><w:fldChar w:fldCharType="begin"/><w:instrText xml:space="preserve"> PAGEREF _Toc${bmId} \\h </w:instrText><w:fldChar w:fldCharType="separate"/><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:b/><w:bCs/></w:rPr><w:t>3</w:t><w:fldChar w:fldCharType="end"/></w:r></w:hyperlink></w:p>`;
  });

  // 4. Dampak
  xml += `<w:p><w:pPr><w:pStyle w:val="TOC2"/><w:tabs><w:tab w:val="left" w:pos="960"/><w:tab w:val="right" w:leader="dot" w:pos="9062"/></w:tabs><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:b/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr></w:pPr><w:hyperlink w:anchor="_Toc5" w:history="1"><w:r><w:rPr><w:rStyle w:val="Hyperlink"/><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:b/></w:rPr><w:t>4.</w:t></w:r><w:r><w:tab/></w:r><w:r><w:rPr><w:rStyle w:val="Hyperlink"/><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:b/></w:rPr><w:t>Dampak</w:t></w:r><w:r><w:tab/><w:fldChar w:fldCharType="begin"/><w:instrText xml:space="preserve"> PAGEREF _Toc5 \\h </w:instrText><w:fldChar w:fldCharType="separate"/><w:t>4</w:t><w:fldChar w:fldCharType="end"/></w:r></w:hyperlink></w:p>`;

  // 5. Simpulan
  xml += `<w:p><w:pPr><w:pStyle w:val="TOC2"/><w:tabs><w:tab w:val="left" w:pos="960"/><w:tab w:val="right" w:leader="dot" w:pos="9062"/></w:tabs><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:b/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr></w:pPr><w:hyperlink w:anchor="_Toc6" w:history="1"><w:r><w:rPr><w:rStyle w:val="Hyperlink"/><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:b/></w:rPr><w:t>5.</w:t></w:r><w:r><w:tab/></w:r><w:r><w:rPr><w:rStyle w:val="Hyperlink"/><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:b/></w:rPr><w:t>Simpulan</w:t></w:r><w:r><w:tab/><w:fldChar w:fldCharType="begin"/><w:instrText xml:space="preserve"> PAGEREF _Toc6 \\h </w:instrText><w:fldChar w:fldCharType="separate"/><w:t>5</w:t><w:fldChar w:fldCharType="end"/></w:r></w:hyperlink></w:p>`;

  // 6. Rekomendasi
  xml += `<w:p><w:pPr><w:pStyle w:val="TOC2"/><w:tabs><w:tab w:val="left" w:pos="960"/><w:tab w:val="right" w:leader="dot" w:pos="9062"/></w:tabs><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:b/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr></w:pPr><w:hyperlink w:anchor="_Toc7" w:history="1"><w:r><w:rPr><w:rStyle w:val="Hyperlink"/><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:b/></w:rPr><w:t>6.</w:t></w:r><w:r><w:tab/></w:r><w:r><w:rPr><w:rStyle w:val="Hyperlink"/><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:b/></w:rPr><w:t>Rekomendasi</w:t></w:r><w:r><w:tab/><w:fldChar w:fldCharType="begin"/><w:instrText xml:space="preserve"> PAGEREF _Toc7 \\h </w:instrText><w:fldChar w:fldCharType="separate"/><w:t>5</w:t><w:fldChar w:fldCharType="end"/></w:r></w:hyperlink></w:p>`;

  // Closing field instruction tag for the TOC field
  xml += `<w:p><w:pPr><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/></w:rPr></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:b/><w:bCs/></w:rPr><w:fldChar w:fldCharType="end"/></w:r></w:p>`;

  return xml;
}

/**
 * Main generator: transforms template.docx into a complete official Kemenkes CSIRT report
 */
export async function generateOfficialDocxFromTemplate(
  baseTemplateBuffer: ArrayBuffer | Uint8Array,
  data: VulnReportData
): Promise<Uint8Array> {
  const zip = await JSZip.loadAsync(baseTemplateBuffer);

  let docXml = await zip.file('word/document.xml')!.async('text');
  let relsXml = await zip.file('word/_rels/document.xml.rels')!.async('text');
  let headerXml = zip.file('word/header1.xml') ? await zip.file('word/header1.xml')!.async('text') : '';

  // 1. UPDATE COVER PAGE:
  // The template has 4 text boxes in the cover: Date, DocNum, AppName, TLP
  const rawData: any = data || {};
  const metaObj = rawData.meta || {};
  const appName = rawData.appName || metaObj.appName || 'Aplikasi Target';
  const appDisplayName = appName.startsWith('Aplikasi ') ? appName : `Aplikasi ${appName}`;
  const targetDate = rawData.date || metaObj.reportDate || metaObj.date || '24 September 2026';
  const targetDocNum = rawData.docNumber || metaObj.docNumber || '62A.NR.092026';
  const targetTlp = rawData.tlp || metaObj.tlp || 'TLP : AMBER';

  // Replace textboxes in cover:
  let txbxCount = 0;
  docXml = docXml.replace(/<wps:txbx>[\s\S]*?<\/wps:txbx>/g, (match) => {
    txbxCount++;
    if (txbxCount === 1) { // Date
      return `<wps:txbx><w:txbxContent><w:p><w:pPr><w:spacing w:line="360" w:lineRule="auto"/><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/><w:bCs/><w:color w:val="4472C4" w:themeColor="accent1"/><w:sz w:val="48"/><w:szCs w:val="48"/><w14:shadow w14:blurRad="38100" w14:dist="19050" w14:dir="2700000" w14:sx="100000" w14:sy="100000" w14:kx="0" w14:ky="0" w14:algn="tl"><w14:schemeClr w14:val="dk1"><w14:alpha w14:val="60000"/></w14:schemeClr></w14:shadow><w14:textOutline w14:w="0" w14:cap="flat" w14:cmpd="sng" w14:algn="ctr"><w14:noFill/><w14:prstDash w14:val="solid"/><w14:round/></w14:textOutline></w:rPr></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/><w:bCs/><w:color w:val="4472C4" w:themeColor="accent1"/><w:sz w:val="48"/><w:szCs w:val="48"/><w14:shadow w14:blurRad="38100" w14:dist="19050" w14:dir="2700000" w14:sx="100000" w14:sy="100000" w14:kx="0" w14:ky="0" w14:algn="tl"><w14:schemeClr w14:val="dk1"><w14:alpha w14:val="60000"/></w14:schemeClr></w14:shadow><w14:textOutline w14:w="0" w14:cap="flat" w14:cmpd="sng" w14:algn="ctr"><w14:noFill/><w14:prstDash w14:val="solid"/><w14:round/></w14:textOutline></w:rPr><w:t>${escapeXml(targetDate)}</w:t></w:r></w:p></w:txbxContent></wps:txbx>`;
    }
    if (txbxCount === 2) { // DocNum
      return `<wps:txbx><w:txbxContent><w:p><w:pPr><w:spacing w:line="360" w:lineRule="auto"/><w:jc w:val="left"/><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/><w:bCs/><w:color w:val="4472C4" w:themeColor="accent1"/><w:sz w:val="48"/><w:szCs w:val="48"/><w14:shadow w14:blurRad="38100" w14:dist="19050" w14:dir="2700000" w14:sx="100000" w14:sy="100000" w14:kx="0" w14:ky="0" w14:algn="tl"><w14:schemeClr w14:val="dk1"><w14:alpha w14:val="60000"/></w14:schemeClr></w14:shadow><w14:textOutline w14:w="0" w14:cap="flat" w14:cmpd="sng" w14:algn="ctr"><w14:noFill/><w14:prstDash w14:val="solid"/><w14:round/></w14:textOutline></w:rPr></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/><w:bCs/><w:color w:val="4472C4" w:themeColor="accent1"/><w:sz w:val="48"/><w:szCs w:val="48"/><w14:shadow w14:blurRad="38100" w14:dist="19050" w14:dir="2700000" w14:sx="100000" w14:sy="100000" w14:kx="0" w14:ky="0" w14:algn="tl"><w14:schemeClr w14:val="dk1"><w14:alpha w14:val="60000"/></w14:schemeClr></w14:shadow><w14:textOutline w14:w="0" w14:cap="flat" w14:cmpd="sng" w14:algn="ctr"><w14:noFill/><w14:prstDash w14:val="solid"/><w14:round/></w14:textOutline></w:rPr><w:t>${escapeXml(targetDocNum)}</w:t></w:r></w:p></w:txbxContent></wps:txbx>`;
    }
    if (txbxCount === 3) { // AppName
      return `<wps:txbx><w:txbxContent><w:p><w:pPr><w:spacing w:line="360" w:lineRule="auto"/><w:jc w:val="left"/><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/><w:bCs/><w:color w:val="4472C4" w:themeColor="accent1"/><w:sz w:val="48"/><w:szCs w:val="48"/><w14:shadow w14:blurRad="38100" w14:dist="19050" w14:dir="2700000" w14:sx="100000" w14:sy="100000" w14:kx="0" w14:ky="0" w14:algn="tl"><w14:schemeClr w14:val="dk1"><w14:alpha w14:val="60000"/></w14:schemeClr></w14:shadow><w14:textOutline w14:w="0" w14:cap="flat" w14:cmpd="sng" w14:algn="ctr"><w14:noFill/><w14:prstDash w14:val="solid"/><w14:round/></w14:textOutline></w:rPr></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/><w:bCs/><w:color w:val="4472C4" w:themeColor="accent1"/><w:sz w:val="48"/><w:szCs w:val="48"/><w14:shadow w14:blurRad="38100" w14:dist="19050" w14:dir="2700000" w14:sx="100000" w14:sy="100000" w14:kx="0" w14:ky="0" w14:algn="tl"><w14:schemeClr w14:val="dk1"><w14:alpha w14:val="60000"/></w14:schemeClr></w14:shadow><w14:textOutline w14:w="0" w14:cap="flat" w14:cmpd="sng" w14:algn="ctr"><w14:noFill/><w14:prstDash w14:val="solid"/><w14:round/></w14:textOutline></w:rPr><w:t>${escapeXml(appDisplayName)}</w:t></w:r></w:p></w:txbxContent></wps:txbx>`;
    }
    if (txbxCount === 4) { // TLP
      return `<wps:txbx><w:txbxContent><w:p><w:pPr><w:rPr><w:b/><w:color w:val="FFBF00"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:b/><w:color w:val="FFBF00"/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr><w:t>${escapeXml(targetTlp)}</w:t></w:r></w:p></w:txbxContent></wps:txbx>`;
    }
    return match;
  });

  // Also replace v:textbox fallbacks in cover
  let vCount = 0;
  docXml = docXml.replace(/<v:textbox[\s\S]*?<\/v:textbox>/g, (match) => {
    vCount++;
    if (vCount === 1) {
      return `<v:textbox><w:txbxContent><w:p><w:pPr><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:color w:val="4472C4"/><w:sz w:val="48"/><w:szCs w:val="48"/></w:rPr></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:color w:val="4472C4"/><w:sz w:val="48"/><w:szCs w:val="48"/></w:rPr><w:t>${escapeXml(targetDate)}</w:t></w:r></w:p></w:txbxContent></v:textbox>`;
    }
    if (vCount === 2) {
      return `<v:textbox><w:txbxContent><w:p><w:pPr><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:color w:val="4472C4"/><w:sz w:val="48"/><w:szCs w:val="48"/></w:rPr></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:color w:val="4472C4"/><w:sz w:val="48"/><w:szCs w:val="48"/></w:rPr><w:t>${escapeXml(targetDocNum)}</w:t></w:r></w:p></w:txbxContent></v:textbox>`;
    }
    if (vCount === 3) {
      return `<v:textbox><w:txbxContent><w:p><w:pPr><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:color w:val="4472C4"/><w:sz w:val="48"/><w:szCs w:val="48"/></w:rPr></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:color w:val="4472C4"/><w:sz w:val="48"/><w:szCs w:val="48"/></w:rPr><w:t>${escapeXml(appDisplayName)}</w:t></w:r></w:p></w:txbxContent></v:textbox>`;
    }
    if (vCount === 4) {
      return `<v:textbox><w:txbxContent><w:p><w:r><w:t>${escapeXml(targetTlp)}</w:t></w:r></w:p></w:txbxContent></v:textbox>`;
    }
    return match;
  });

  // Replace TLP in header
  if (headerXml) {
    headerXml = headerXml.replace(/TLP : AMBER/g, escapeXml(targetTlp));
    zip.file('word/header1.xml', headerXml);
  }

  // 2. LOCATE DOCUMENT SECTIONS
  // Cover ends at </w:sdt>
  const tocStart = docXml.indexOf('Daftar Isi');
  if (tocStart === -1) {
    throw new Error('Could not find "Daftar Isi" section in template');
  }

  // Page break after TOC
  const pageBreakAfterToc = docXml.indexOf('w:type="page"', tocStart);
  const endOfTocP = docXml.indexOf('</w:p>', pageBreakAfterToc) + 6;
  const sectPrIdx = docXml.lastIndexOf('<w:sectPr');

  if (endOfTocP === -1 || sectPrIdx === -1) {
    throw new Error('Could not locate body boundaries in template');
  }

  // 3. REGENERATE TABLE OF CONTENTS (DAFTAR ISI)
  // In OpenXML, the Table of Contents is inside a Structured Document Tag:
  // <w:sdt><w:sdtContent><w:p>...Daftar Isi...</w:p> ...TOC entries... </w:sdtContent></w:sdt>
  const tocHeadingP = docXml.lastIndexOf('<w:p', tocStart);
  const endOfTocHeadingP = docXml.indexOf('</w:p>', tocHeadingP) + 6;

  // The TOC entries end at </w:sdtContent>
  const sdtContentEnd = docXml.indexOf('</w:sdtContent>', endOfTocHeadingP);
  if (sdtContentEnd === -1) {
    throw new Error('Could not find </w:sdtContent> closing tag in template');
  }

  const beforeTocEntries = docXml.substring(0, endOfTocHeadingP);
  const afterTocEntries = docXml.substring(sdtContentEnd);

  const newTocXml = buildTocEntriesXml(data.vulnerabilities);
  docXml = beforeTocEntries + newTocXml + afterTocEntries;

  // Recalculate body start after TOC replacement
  const newPageBreakAfterToc = docXml.indexOf('w:type="page"', docXml.indexOf('Daftar Isi'));
  const newEndOfTocP = docXml.indexOf('</w:p>', newPageBreakAfterToc) + 6;
  const newSectPrIdx = docXml.lastIndexOf('<w:sectPr');

  // 4. PREPARE RELATIONSHIPS & SCREENSHOTS FOR SECTION 3 (PoC)
  let maxRId = 15;
  const rIdMatches = relsXml.match(/Id="rId(\d+)"/g) || [];
  for (const m of rIdMatches) {
    const num = parseInt(m.replace(/[^\d]/g, ''), 10);
    if (!isNaN(num) && num > maxRId) maxRId = num;
  }

  let nextDocPrId = 3000;
  const imageRelsToAdd: string[] = [];

  // 5. ASSEMBLE BODY XML
  let bodyXml = '';

  // Page 3 Document Header:
  // Heading 1: Notifikasi Kerentanan
  // Paragraph: [Nama Aplikasi]
  bodyXml += `<w:p><w:pPr><w:pStyle w:val="Heading1"/><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:b/><w:color w:val="auto"/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr></w:pPr><w:bookmarkStart w:id="1" w:name="_Toc1"/><w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:b/><w:color w:val="auto"/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr><w:lastRenderedPageBreak/><w:t>Notifikasi Kerentanan</w:t></w:r><w:bookmarkEnd w:id="1"/></w:p>`;
  bodyXml += `<w:p><w:pPr><w:spacing w:after="160"/><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:b/></w:rPr></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:b/></w:rPr><w:t xml:space="preserve">${escapeXml(appDisplayName)}</w:t></w:r></w:p>`;

  // 1. Ringkasan Eksekutif
  bodyXml += createRibbonHeader('Ringkasan Eksekutif', 2, 0, '1.');
  const execSummary = data.executiveSummary || `Terdeteksi adanya beberapa potensi kerentanan yaitu **${data.vulnerabilities.map(v => v.name).join(' dan ')}** pada aplikasi ${appDisplayName} (**${data.targetUrl || 'target.kemkes.go.id'}**). Temuan ini teridentifikasi selama pengujian keamanan sistem dan memerlukan penanganan serta mitigasi segera guna mencegah potensi kompromi akun, eskalasi serangan, atau pengungkapan data secara tidak sah.`;
  const vulnNames = data.vulnerabilities.map(v => v.name);
  execSummary.split('\n\n').forEach(p => {
    let pText = p.trim();
    if (!pText) return;
    // Auto bold vulnerability name and domain name in the introductory sentence if not already formatted with **
    if (pText.includes('Terdeteksi adanya beberapa potensi kerentanan') || pText.includes('potensi kerentanan yaitu')) {
      vulnNames.forEach(name => {
        if (name && !pText.includes(`**${name}**`)) {
          pText = pText.split(name).join(`**${name}**`);
        }
      });
      if (data.targetUrl) {
        const cleanUrl = data.targetUrl.replace(/[\(\)]/g, '').trim();
        if (cleanUrl && !pText.includes(`**${cleanUrl}**`)) {
          pText = pText.split(cleanUrl).join(`**${cleanUrl}**`);
        }
      }
    }
    bodyXml += createPara(pText);
  });

  // 2. Kerentanan
  bodyXml += createRibbonHeader('Kerentanan', 3, 0, '2.');
  const vulnListNames = data.vulnerabilities.map(v => v.name).join(' dan ');
  bodyXml += createPara(`Berikut endpoint atau path ${appDisplayName} yang rentan terhadap ${vulnListNames}.`);
  bodyXml += createVulnTable(data.vulnerabilities);
  bodyXml += createPara('', { spacingAfter: 120 }); // spacing

  // 3. PoC (Proof of Concept)
  bodyXml += createRibbonHeader('PoC', 4, 0, '3.');

  // Vulnerability subsections
  for (let vIdx = 0; vIdx < data.vulnerabilities.length; vIdx++) {
    const v = data.vulnerabilities[vIdx];
    const subNum = `3.${vIdx + 1}`;
    const bmId = 40 + vIdx;

    // Technical Description / intro before sub-ribbon (flush left at ruler 0)
    if (v.techDescription) {
      v.techDescription.split('\n\n').forEach(p => {
        if (p.trim()) bodyXml += createPara(p.trim());
      });
    }

    // Subheading ribbon with vulnerability name (e.g. 3.1 Directory Listing)
    bodyXml += createRibbonHeader(v.name, bmId, 1, subNum);

    // Embed Screenshot Images
    if (v.images && v.images.length > 0) {
      for (let imgIdx = 0; imgIdx < v.images.length; imgIdx++) {
        const img = v.images[imgIdx];
        try {
          const bytes = await getImageBytes(img.dataUrl);
          if (!bytes) {
            console.warn(`Could not resolve image bytes for: ${img.dataUrl}`);
            continue;
          }

          maxRId++;
          nextDocPrId++;
          const curRId = `rId${maxRId}`;
          const isJpg = img.dataUrl.includes('image/jpeg') || img.dataUrl.includes('image/jpg') || img.dataUrl.endsWith('.jpeg') || img.dataUrl.endsWith('.jpg');
          const ext = isJpg ? 'jpeg' : 'png';
          const filename = `image_poc_${vIdx + 1}_${imgIdx + 1}.${ext}`;

          // Save image into zip
          zip.file(`word/media/${filename}`, bytes);

          // Add relationship
          imageRelsToAdd.push(
            `<Relationship Id="${curRId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${filename}"/>`
          );

          // Drawing & Caption
          const defaultCaption = `Gambar ${subNum}.${imgIdx + 1} ${v.name} pada path ${v.path || '/'}`;
          const capText = img.caption && img.caption.trim() ? img.caption.trim() : defaultCaption;

          bodyXml += createScreenshotDrawing(curRId, nextDocPrId, capText, img.width || 540, img.height || 280);
        } catch (err) {
          console.warn('Failed to embed screenshot image:', err);
        }
      }
    }

    // PoC Narrative (flush left at ruler 0)
    if (v.pocNarrative) {
      v.pocNarrative.split('\n\n').forEach(p => {
        if (p.trim()) bodyXml += createPara(p.trim());
      });
    }

    bodyXml += createPara('', { spacingAfter: 120 });
  }

  // 4. Dampak
  bodyXml += createRibbonHeader('Dampak', 5, 0, '4.');
  const overallImpact = data.overallImpact || data.vulnerabilities.map(v => v.impact).filter(Boolean).join('\n\n') || `Kerentanan yang teridentifikasi berpotensi membuka celah terhadap kerahasiaan (Confidentiality) dan integritas (Integrity) data pada aplikasi ${appDisplayName}.`;
  overallImpact.split('\n\n').forEach(p => {
    if (p.trim()) bodyXml += createPara(p.trim());
  });

  // 5. Simpulan
  bodyXml += createRibbonHeader('Simpulan', 6, 0, '5.');
  const conclusionText = data.conclusion || `Berdasarkan hasil pengujian keamanan yang telah dilakukan terhadap aplikasi ${appDisplayName} (${data.targetUrl || 'target'}), teridentifikasi kerentanan ${vulnListNames}. Temuan ini memerlukan penanganan penutupan celah keamanan dan pembaruan konfigurasi sesuai rekomendasi yang diberikan.`;
  if (!conclusionText.trim().startsWith('Berikut kesimpulan')) {
    bodyXml += createPara('Berikut kesimpulan dari notif insiden kerentanan ini.');
  }
  conclusionText.split('\n\n').forEach(p => {
    if (p.trim()) bodyXml += createPara(p.trim());
  });

  // 6. Rekomendasi
  bodyXml += createRibbonHeader('Rekomendasi', 7, 0, '6.');
  bodyXml += createPara('Berikut ini adalah beberapa saran dan rekomendasi yang dapat kami berikan.');

  if (data.vulnerabilities.length === 1) {
    const v = data.vulnerabilities[0];
    const recs = v.recommendations && v.recommendations.length > 0
      ? v.recommendations
      : [
          'Mengatur hak akses agar membatasi akses ke file sensitif.',
          'Aktifkan pembatasan akses atau nonaktifkan pengindeksan direktori pada konfigurasi webserver.'
        ];
    recs.forEach(r => {
      const cleanR = r.replace(/^\d+[\.\)\-]\s*/, '');
      bodyXml += createRecommendationItem(cleanR);
    });
  } else {
    data.vulnerabilities.forEach(v => {
      bodyXml += createPara(`Rekomendasi ${v.name}`, { bold: true, spacingAfter: 80 });
      const recs = v.recommendations && v.recommendations.length > 0 ? v.recommendations : [];
      recs.forEach(r => {
        const cleanR = r.replace(/^\d+[\.\)\-]\s*/, '');
        bodyXml += createRecommendationItem(cleanR);
      });
      bodyXml += createPara('', { spacingAfter: 100 });
    });
  }

  // CSIRT Signer Block
  bodyXml += createPara('', { spacingAfter: 200 });
  bodyXml += createSignerBlock(
    data.signerPosition || 'Ketua Tim Kerja Penyelenggaraan Layanan Tim Tanggap Insiden Siber (CSIRT) dan Pelindungan Data Pribadi (PDP),',
    '${ttd_pengirim}',
    data.signerName || 'Istiqomah, SS, MKM'
  );

  // 6. INJECT RELATIONSHIPS
  if (imageRelsToAdd.length > 0) {
    const endRelsIdx = relsXml.lastIndexOf('</Relationships>');
    if (endRelsIdx !== -1) {
      relsXml = relsXml.substring(0, endRelsIdx) + imageRelsToAdd.join('') + '</Relationships>';
      zip.file('word/_rels/document.xml.rels', relsXml);
    }
  }

  // 7. INJECT BODY INTO DOCUMENT XML
  const finalDocXml = docXml.substring(0, newEndOfTocP) + bodyXml + docXml.substring(newSectPrIdx);
  zip.file('word/document.xml', finalDocXml);

  // 8. UPDATE AND SANITIZE METADATA (docProps/core.xml & docProps/app.xml)
  // Ensure institutional CSIRT metadata and eliminate any personal email artifact
  const officialCreator = data.instansi
    ? `Tim Tanggap Insiden Siber (CSIRT) - ${data.instansi}`
    : 'Tim CSIRT Kementerian Kesehatan';
  const officialModifiedBy = data.signerName || 'CSIRT Kementerian Kesehatan';
  const nowIso = new Date().toISOString();

  if (zip.file('docProps/core.xml')) {
    let coreXml = await zip.file('docProps/core.xml')!.async('text');
    coreXml = coreXml
      .replace(/<dc:creator>[\s\S]*?<\/dc:creator>/, `<dc:creator>${escapeXml(officialCreator)}</dc:creator>`)
      .replace(/<cp:lastModifiedBy>[\s\S]*?<\/cp:lastModifiedBy>/, `<cp:lastModifiedBy>${escapeXml(officialModifiedBy)}</cp:lastModifiedBy>`)
      .replace(/<dc:title>[\s\S]*?<\/dc:title>/, `<dc:title>${escapeXml(`Laporan Notifikasi Kerentanan - ${appDisplayName}`)}</dc:title>`)
      .replace(/<dc:subject>[\s\S]*?<\/dc:subject>/, `<dc:subject>${escapeXml(`Notifikasi Kerentanan ${appDisplayName}`)}</dc:subject>`)
      .replace(/<dcterms:modified[\s\S]*?<\/dcterms:modified>/, `<dcterms:modified xsi:type="dcterms:W3CDTF">${nowIso}</dcterms:modified>`)
      .replace(/dinaoktavia26@outlook\.com/gi, escapeXml(officialCreator));
    zip.file('docProps/core.xml', coreXml);
  }

  if (zip.file('docProps/app.xml')) {
    let appXml = await zip.file('docProps/app.xml')!.async('text');
    const officialCompany = data.instansi || 'Kementerian Kesehatan RI';
    appXml = appXml.replace(/<Company>[\s\S]*?<\/Company>/, `<Company>${escapeXml(officialCompany)}</Company>`);
    zip.file('docProps/app.xml', appXml);
  }

  // 9. GENERATE FINAL DOCX BINARY
  const outputBuffer = await zip.generateAsync({
    type: 'uint8array',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 }
  });

  return outputBuffer;
}

/**
 * Helper to trigger browser download of a Blob
 */
function triggerBlobDownload(blob: Blob, filename: string): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 200);
}

/**
 * Browser download helper: Generates docx using the official Google Drive template and triggers download
 */
export async function downloadOfficialDocx(data: VulnReportData): Promise<void> {
  const cleanAppName = (data.appName || 'Aplikasi').replace(/[^a-zA-Z0-9_\-\s]/g, '').trim().replace(/\s+/g, '_');
  const cleanDocNum = (data.docNumber || 'Notifikasi').replace(/[^a-zA-Z0-9_\-]/g, '_');
  const filename = `${cleanDocNum}_Notifikasi_Kerentanan_${cleanAppName}.docx`;

  try {
    // Attempt 1: Call server endpoint
    const response = await fetch('/api/generate-vuln-docx', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    if (response.ok) {
      const blob = await response.blob();
      triggerBlobDownload(blob, filename);
      return;
    }
  } catch (serverErr) {
    console.warn('Server docx generation failed, falling back to client generation:', serverErr);
  }

  // Attempt 2: Client-side generation using public template
  const templateResp = await fetch('/templates/template.docx');
  if (!templateResp.ok) {
    throw new Error('Template file not found at /templates/template.docx');
  }
  const arrayBuffer = await templateResp.arrayBuffer();
  const bytes = await generateOfficialDocxFromTemplate(arrayBuffer, data);
  const blob = new Blob([bytes as any], {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  });
  triggerBlobDownload(blob, filename);
}

