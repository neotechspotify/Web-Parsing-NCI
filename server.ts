import express from 'express';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import XLSX from 'xlsx-js-style';
import xml2js from 'xml2js';
import { createServer as createViteServer } from 'vite';

// Ensure required directories exist (skip on Vercel to avoid EROFS error on read-only system)
if (!process.env.VERCEL) {
  fs.mkdirSync('input', { recursive: true });
  fs.mkdirSync('outputs', { recursive: true });
  fs.mkdirSync('templates', { recursive: true });
  fs.mkdirSync('database', { recursive: true });
}

// Synchronous folder copy helper for Vercel /tmp environment
function copyFolderSync(from: string, to: string) {
  if (!fs.existsSync(from)) return;
  fs.mkdirSync(to, { recursive: true });
  const elements = fs.readdirSync(from);
  for (const element of elements) {
    const fromPath = path.join(from, element);
    const toPath = path.join(to, element);
    if (fs.statSync(fromPath).isDirectory()) {
      copyFolderSync(fromPath, toPath);
    } else {
      fs.copyFileSync(fromPath, toPath);
    }
  }
}

// Dynamically resolve templates and database folders to writable /tmp on Vercel
function getTemplatesDir(): string {
  if (process.env.VERCEL) {
    const tmpTemplates = '/tmp/templates';
    if (!fs.existsSync(tmpTemplates)) {
      copyFolderSync(path.join(process.cwd(), 'templates'), tmpTemplates);
    }
    return tmpTemplates;
  }
  return path.join(process.cwd(), 'templates');
}

function getDatabaseDir(): string {
  if (process.env.VERCEL) {
    const tmpDatabase = '/tmp/database';
    if (!fs.existsSync(tmpDatabase)) {
      copyFolderSync(path.join(process.cwd(), 'database'), tmpDatabase);
    }
    return tmpDatabase;
  }
  return path.join(process.cwd(), 'database');
}

// Helper to automatically fit column widths for a JSON worksheet
function autoFitJsonColumns(worksheet: XLSX.WorkSheet, data: any[]) {
  if (!data || data.length === 0) return;
  const keys = Object.keys(data[0]);
  const colWidths = keys.map(key => {
    let maxLen = key.length;
    for (const row of data) {
      const val = row[key];
      if (val !== undefined && val !== null) {
        maxLen = Math.max(maxLen, String(val).length);
      }
    }
    return maxLen;
  });
  worksheet['!cols'] = colWidths.map(w => ({ wch: Math.max(w + 3, 10) }));
}

// Helper to set auto-filter on all columns for a JSON worksheet
function addAutoFilter(worksheet: XLSX.WorkSheet, data: any[]) {
  if (!data || data.length === 0) return;
  const totalRows = data.length;
  const totalCols = Object.keys(data[0]).length;
  
  const getColLetter = (colIndex: number): string => {
    let letter = '';
    let temp = colIndex;
    while (temp > 0) {
      let modulo = (temp - 1) % 26;
      letter = String.fromCharCode(65 + modulo) + letter;
      temp = Math.floor((temp - modulo) / 26);
    }
    return letter;
  };
  
  const lastColLetter = getColLetter(totalCols);
  worksheet['!autofilter'] = { ref: `A1:${lastColLetter}${totalRows + 1}` };
}

// Helper to style a raw data worksheet with Green Table Style Medium 7 (with alternating rows)
function styleRawSheet(worksheet: XLSX.WorkSheet, data: any[]) {
  if (!data || data.length === 0) return;
  const totalCols = Object.keys(data[0]).length;
  const totalRows = data.length;
  
  const getColLetter = (colIndex: number): string => {
    let letter = '';
    let temp = colIndex;
    while (temp > 0) {
      let modulo = (temp - 1) % 26;
      letter = String.fromCharCode(65 + modulo) + letter;
      temp = Math.floor((temp - modulo) / 26);
    }
    return letter;
  };

  const thinBorder = { style: 'thin', color: { rgb: 'D9D9D9' } };

  // Style Header Row (row 1)
  for (let c = 1; c <= totalCols; c++) {
    const colLetter = getColLetter(c);
    const cellKey = `${colLetter}1`;
    const cell = worksheet[cellKey];
    if (cell) {
      cell.s = {
        font: { bold: true, name: 'Calibri', sz: 11, color: { rgb: 'FFFFFF' } },
        fill: { patternType: 'solid', fgColor: { rgb: '76933C' } }, // Green, Table Style Medium 7 Header Green
        border: {
          top: thinBorder,
          bottom: thinBorder,
          left: thinBorder,
          right: thinBorder
        },
        alignment: { horizontal: 'left', vertical: 'center' }
      };
    }
  }

  // Style Data Rows (row 2 to totalRows + 1)
  for (let r = 2; r <= totalRows + 1; r++) {
    const isAlternate = (r % 2 === 1); // Row 3, 5, 7... are light green
    const rowBgColor = isAlternate ? 'E2EFDA' : 'FFFFFF'; // Elegant Excel light green for Medium 7

    for (let c = 1; c <= totalCols; c++) {
      const colLetter = getColLetter(c);
      const cellKey = `${colLetter}${r}`;
      const cell = worksheet[cellKey];
      if (cell) {
        cell.s = {
          font: { name: 'Calibri', sz: 11, color: { rgb: '000000' } },
          fill: { patternType: 'solid', fgColor: { rgb: rowBgColor } },
          border: {
            top: thinBorder,
            bottom: thinBorder,
            left: thinBorder,
            right: thinBorder
          },
          alignment: { horizontal: 'left', vertical: 'center' }
        };
      }
    }
  }
}

// Helper to create a beautifully styled Pivot Table worksheet
function createStyledPivotSheet(aalPivotData: any[], totalCount: number, valueColName: string = "source.ip"): XLSX.WorkSheet {
  const pivotAOA: any[][] = [];
  pivotAOA.push([]); // blank row 1
  pivotAOA.push([]); // blank row 2
  pivotAOA.push(["Row Labels", `Count of ${valueColName}`]); // row 3

  const rowStyles: Array<{
    type: 'header' | 'group' | 'item' | 'total';
    ip?: string;
    domain?: string;
  }> = [
    { type: 'header' }, // dummy for row 1
    { type: 'header' }, // dummy for row 2
    { type: 'header' }, // header on row 3
  ];

  aalPivotData.forEach(group => {
    pivotAOA.push([group.ip, group.subtotal]);
    rowStyles.push({ type: 'group', ip: group.ip });
    
    group.domains.forEach(d => {
      // Intended for standard Pivot style indent representation
      pivotAOA.push([`  ${d.domain}`, d.count]);
      rowStyles.push({ type: 'item', domain: d.domain });
    });
  });

  pivotAOA.push(["Grand Total", totalCount]);
  rowStyles.push({ type: 'total' });

  const sheet = XLSX.utils.aoa_to_sheet(pivotAOA);

  // Apply custom Excel Pivot Styles
  for (let r = 0; r < pivotAOA.length; r++) {
    const rowNum = r + 1; // 1-based index in Excel
    const styleInfo = rowStyles[r];
    if (!styleInfo) continue;

    const cellA_key = `A${rowNum}`;
    const cellB_key = `B${rowNum}`;

    const cellA = sheet[cellA_key];
    const cellB = sheet[cellB_key];

    if (!cellA && !cellB) continue;

    const thinBorder = { style: 'thin', color: { rgb: 'D9D9D9' } };
    const doubleBorder = { style: 'double', color: { rgb: '333333' } };

    if (styleInfo.type === 'header') {
      if (rowNum === 3) {
        if (cellA) {
          cellA.s = {
            font: { bold: true, name: 'Calibri', sz: 11, color: { rgb: '000000' } },
            fill: { patternType: 'solid', fgColor: { rgb: 'DCE6F1' } },
            border: {
              top: thinBorder,
              bottom: thinBorder,
              left: thinBorder,
              right: thinBorder
            },
            alignment: { horizontal: 'left', vertical: 'center' }
          };
        }
        if (cellB) {
          cellB.s = {
            font: { bold: true, name: 'Calibri', sz: 11, color: { rgb: '000000' } },
            fill: { patternType: 'solid', fgColor: { rgb: 'DCE6F1' } },
            border: {
              top: thinBorder,
              bottom: thinBorder,
              left: thinBorder,
              right: thinBorder
            },
            alignment: { horizontal: 'right', vertical: 'center' }
          };
        }
      }
    } else if (styleInfo.type === 'group') {
      if (cellA) {
        cellA.s = {
          font: { bold: true, name: 'Calibri', sz: 11 },
          alignment: { horizontal: 'left', vertical: 'center' },
          border: {
            top: thinBorder,
            bottom: thinBorder,
            left: thinBorder,
            right: thinBorder
          }
        };
      }
      if (cellB) {
        cellB.s = {
          font: { bold: true, name: 'Calibri', sz: 11 },
          alignment: { horizontal: 'right', vertical: 'center' },
          border: {
            top: thinBorder,
            bottom: thinBorder,
            left: thinBorder,
            right: thinBorder
          }
        };
      }
    } else if (styleInfo.type === 'item') {
      if (cellA) {
        cellA.s = {
          font: { name: 'Calibri', sz: 11 },
          alignment: { horizontal: 'left', vertical: 'center' },
          border: {
            left: thinBorder,
            right: thinBorder
          }
        };
      }
      if (cellB) {
        cellB.s = {
          font: { name: 'Calibri', sz: 11 },
          alignment: { horizontal: 'right', vertical: 'center' },
          border: {
            left: thinBorder,
            right: thinBorder
          }
        };
      }
    } else if (styleInfo.type === 'total') {
      const bgTotalColor = 'DCE6F1';
      if (cellA) {
        cellA.s = {
          font: { bold: true, name: 'Calibri', sz: 11 },
          fill: { patternType: 'solid', fgColor: { rgb: bgTotalColor } },
          border: {
            top: thinBorder,
            bottom: doubleBorder,
            left: thinBorder,
            right: thinBorder
          },
          alignment: { horizontal: 'left', vertical: 'center' }
        };
      }
      if (cellB) {
        cellB.s = {
          font: { bold: true, name: 'Calibri', sz: 11 },
          fill: { patternType: 'solid', fgColor: { rgb: bgTotalColor } },
          border: {
            top: thinBorder,
            bottom: doubleBorder,
            left: thinBorder,
            right: thinBorder
          },
          alignment: { horizontal: 'right', vertical: 'center' }
        };
      }
    }
  }

  // Set column widths
  sheet['!cols'] = [
    { wch: 32 }, // Row Labels width
    { wch: 22 }  // Count width
  ];

  return sheet;
}

export const app = express();
const PORT = 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Multer storage configuration for parsing uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = process.env.VERCEL ? '/tmp' : 'input/';
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname);
  }
});
const upload = multer({ storage });

// Constants and Mappings
const SHIFTS: Record<string, [string, string]> = {
  "3": ["Selamat Pagi", "00.00 - 08.00"],
  "1": ["Selamat Sore", "08.00 - 16.00"],
  "2": ["Selamat Malam", "16.00 - 00.00"],
};

// Utilities matching Python logic
function verticalize(raw: string): string {
  if (!raw || raw === "-") return "-";
  const lines = raw.split(/\r?\n/).map(x => x.trim()).filter(x => x.length > 0);
  return lines.length > 0 ? lines.join("<br>\n") + "<br>" : "-";
}

function normalize(text: string): string {
  if (!text) return "";
  let t = text.replace(/\xa0/g, " ");
  t = t.trim().toLowerCase();
  t = t.replace(/\s+/g, " ");
  return t;
}

function formatEventName(templateName: string): string {
  const SPECIAL_CASES: Record<string, string> = { "Ip": "IP", "Url": "URL", "Sql": "SQL", "Dns": "DNS" };
  let clean = templateName.replace(/[_\-]+/g, ' ');
  clean = clean.replace(/\.txt$/i, '');
  const words = clean.split(/\s+/).map(w => {
    const title = w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    return SPECIAL_CASES[title] || title;
  });
  return words.join(' ').trim();
}

function categorizeMagnitude(mag: number): string {
  if (mag >= 1 && mag <= 3) return "Low";
  if (mag >= 4 && mag <= 6) return "Medium";
  if (mag >= 7 && mag <= 10) return "High";
  return "Unknown";
}

function findTemplateFile(instansi: string, eventName: string): string | null {
  const baseDir = path.join(getTemplatesDir(), instansi.toLowerCase());
  if (!fs.existsSync(baseDir)) return null;

  const targetClean = eventName.toLowerCase().replace(/[^a-z0-9]/g, '');
  const files = fs.readdirSync(baseDir);
  for (const file of files) {
    if (file === 'event_template.txt') continue;
    const fileClean = file.replace(/\.txt$/i, '').toLowerCase().replace(/[^a-z0-9]/g, '');
    if (fileClean === targetClean) {
      return path.join(baseDir, file);
    }
  }
  return null;
}

// Data loaders
function loadEventMagnitudes(csvPath: string): Record<string, number> {
  const mapping: Record<string, number> = {};
  try {
    if (fs.existsSync(csvPath)) {
      const content = fs.readFileSync(csvPath, 'utf-8');
      const lines = content.split(/\r?\n/);
      // Skip CSV header, usually "Event Name,Magnitude"
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        if (!line.trim()) continue;
        const parts = line.split(',');
        if (parts.length >= 2) {
          const event = parts[0].trim();
          const magnitude = parseInt(parts[1].trim(), 10);
          if (event && !isNaN(magnitude)) {
            mapping[event] = magnitude;
          }
        }
      }
    }
  } catch (e) {
    console.error('Failed to load event magnitudes:', e);
  }
  return mapping;
}

function loadFalsePositives(filePath: string): Set<string> {
  const fpEvents = new Set<string>();
  try {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split(/\r?\n/);
      for (const line of lines) {
        const eventName = line.trim();
        if (eventName) {
          fpEvents.add(normalize(eventName));
        }
      }
    }
  } catch (e) {
    console.error('Failed to load false positives:', e);
  }
  return fpEvents;
}

function parseTSV(text: string): string[][] {
  const result: string[][] = [];
  let row: string[] = [];
  let currentField = '';
  let insideQuotes = false;
  let i = 0;
  
  while (i < text.length) {
    const char = text[i];
    const nextChar = text[i + 1];
    
    if (char === '"') {
      if (currentField.length === 0 && !insideQuotes) {
        // Field starts with a quote
        insideQuotes = true;
        i++;
      } else if (insideQuotes) {
        if (nextChar === '"') {
          // Escaped quote inside quoted field
          currentField += '"';
          i += 2;
        } else {
          // End of quoted field
          insideQuotes = false;
          i++;
        }
      } else {
        // Literal quote inside non-quoted field
        currentField += '"';
        i++;
      }
    } else if (char === '\t' && !insideQuotes) {
      row.push(currentField.trim());
      currentField = '';
      i++;
    } else if ((char === '\r' || char === '\n') && !insideQuotes) {
      row.push(currentField.trim());
      if (row.length > 0 && row.some(cell => cell.trim().length > 0)) {
        result.push(row);
      }
      row = [];
      currentField = '';
      if (char === '\r' && nextChar === '\n') {
        i += 2;
      } else {
        i++;
      }
    } else {
      currentField += char;
      i++;
    }
  }
  
  if (currentField || row.length > 0) {
    row.push(currentField.trim());
    if (row.some(cell => cell.trim().length > 0)) {
      result.push(row);
    }
  }
  
  return result;
}

function parseTxtContent(content: string): any[] {
  const parsedEvents: any[] = [];
  try {
    const rows = parseTSV(content);
    for (const row of rows) {
      if (row.length <= 3) continue;

      const getPart = (idx: number) => {
        let p = row[idx] || "";
        if (p.startsWith('"') && p.endsWith('"')) {
          p = p.substring(1, p.length - 1).trim();
        }
        return p;
      };

      const event = {
        event_id: getPart(0),
        analyst: getPart(1),
        ticket_id: getPart(2),
        event_type: getPart(3),
        reason_close: getPart(4),
        escalation: getPart(5),
        link_alert: getPart(6),
        event_name: getPart(7),
        magnitude: getPart(8),
        tanggal: getPart(9),
        waktu: getPart(10),
        ticket_date: getPart(11),
        ticket_time: getPart(12),
        soc_response_time: getPart(13),
        user_date: getPart(14),
        user_time: getPart(15),
        user_response_time: getPart(16),
        action: getPart(17),
        event_status: getPart(18),
        traffic_flow: getPart(19),
        src_ip: verticalize(getPart(20)),
        src_country: verticalize(getPart(21)),
        dst_ip: verticalize(getPart(22)),
        dst_port: verticalize(getPart(23)),
        dst_country: verticalize(getPart(24)),
        app_access: getPart(25),
        user_agent: getPart(26),
        request_server: getPart(27),
        url: verticalize(getPart(28)),
        query: verticalize(getPart(29)),
        note: verticalize(getPart(30)),
      };
      parsedEvents.push(event);
    }
  } catch (e) {
    console.error('Failed to parse text log content:', e);
  }
  return parsedEvents;
}

function parseTxtFile(filePath: string): any[] {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return parseTxtContent(content);
  } catch (e) {
    console.error('Failed to parse text log file:', e);
    return [];
  }
}

function parseSophosDetailedLog(text: string): Record<string, string> {
  const lines = text.split(/\r\n|\r|\n/).map(l => l.trim()).filter(l => l.length > 0);
  
  // We initialize the data with highly robust fallback values corresponding to all placeholders in Sophos templates.
  // This guarantees that even if a raw log is partially formatted or has some missing keys,
  // we do not leave unrendered raw template placeholders (like {seen}, {username}) in the final preview.
  const now = new Date();
  const formattedDate = `${String(now.getDate()).padStart(2, '0')}-${String(now.getMonth() + 1).padStart(2, '0')}-${now.getFullYear()}`;
  const formattedTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
  
  const data: Record<string, string> = {
    incident_id: `[SOC-NEOTECH] -${Math.floor(1000 + Math.random() * 9000)}`,
    event_name: "LNX-DET-RAM-CACHE-CLEARED",
    seen: `${formattedDate} ${formattedTime}`,
    severity: "Medium",
    username: "sysadmin",
    hostname: "api-test",
    detection_ip: "172.17.220.235",
    device_type: "server",
    operating_system: "Ubuntu 22.04.1 LTS (Jammy Jellyfish)",
    file_name: "/bin/sh",
    file_path: "/bin/sh",
    command_line: '["/bin/sh","-c","sync; echo 3 > /proc/sys/vm/drop_caches"]',
    ioc_value: "4f291296e89b784cd35479fca606f228126e3641f5bcaee68dee36583d7c9483",
    action: "Melakukan verifikasi terhadap file target untuk memastikan file merupakan bagian dari aktivitas aplikasi legitimate dan bukan payload malicious."
  };

  const KNOWN_HEADERS = new Set([
    'incidentid', 'incidentno', 'ticketid', 'idinsiden', 'idticket', 'noinsiden', 'id_insiden',
    'eventname', 'alertname', 'detectionname', 'title', 'alert', 'namaevent', 'namaalert', 'detectionid', 'incidentname',
    'severity', 'priority', 'level', 'alertseverity', 'skala', 'tingkatbahaya', 'prioritas',
    'time', 'seen', 'detectiontime', 'occurred', 'when', 'date', 'waktu', 'tanggal', 'waktudeteksi', 'tanggalwaktu', 'datetime', 'timestamp',
    'hostname', 'computername', 'device', 'machinename', 'computer', 'host', 'namakomputer', 'perangkat', 'namapeangkat', 'nama_perangkat', 'nama_host',
    'detectionip', 'ipaddress', 'ip', 'hostip', 'alamatip', 'sourceip', 'ip_address', 'alamat_ip',
    'username', 'accountname', 'user', 'account', 'namaakun', 'pengguna', 'nama_pengguna', 'nama_akun',
    'devicetype', 'devicecategory', 'tipederice', 'tipeperangkat', 'tipe_perangkat',
    'operatingsystem', 'os', 'platform', 'sistemoperasi', 'sistem_operasi',
    'filename', 'processname', 'file', 'process', 'namafile', 'namaproses', 'nama_file', 'nama_proses',
    'filepath', 'path', 'processpath', 'lokasifile', 'pathfile', 'path_file', 'lokasi_file',
    'commandline', 'cmdline', 'cmd', 'barisperintah', 'baris_perintah', 'parentcommandline', 'parentcmdline', 'parentcmd', 'parent_command_line',
    'iocvalue', 'sha256', 'hash', 'filehash', 'nilaihash', 'nilai_hash',
    'action', 'remediation', 'actiontaken', 'tindakan', 'solusi', 'remediasi', 'tindakan_diambil'
  ]);

  const rawPairs: Record<string, string> = {};

  // 1. Try JSON parsing first
  const trimmedText = text.trim();
  if (trimmedText.startsWith('{') && trimmedText.endsWith('}')) {
    try {
      const obj = JSON.parse(trimmedText);
      for (const [key, val] of Object.entries(obj)) {
        if (val !== null && val !== undefined) {
          rawPairs[key] = typeof val === 'object' ? JSON.stringify(val) : String(val);
        }
      }
    } catch (e) {
      // ignore JSON parse error
    }
  }

  // 2. Try syslog style key=value pairing
  if (Object.keys(rawPairs).length === 0) {
    const kvRegex = /(\w+)=("[^"]*"|[^\s]+)/g;
    let match;
    while ((match = kvRegex.exec(text)) !== null) {
      const key = match[1];
      let val = match[2];
      if (val.startsWith('"') && val.endsWith('"')) {
        val = val.substring(1, val.length - 1);
      }
      rawPairs[key] = val;
    }
  }

  // 3. Try line-by-line parsing with intelligent same-line separators and known header lookup
  if (Object.keys(rawPairs).length === 0) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      let key = '';
      let val = '';
      
      // Check same-line separators
      if (line.includes(':')) {
        const parts = line.split(':');
        key = parts[0].trim();
        val = parts.slice(1).join(':').trim();
      } else if (line.includes('=')) {
        const parts = line.split('=');
        key = parts[0].trim();
        val = parts.slice(1).join('=').trim();
      } else if (line.includes('\t')) {
        const parts = line.split('\t');
        key = parts[0].trim();
        val = parts.slice(1).join('\t').trim();
      } else if (line.includes('|')) {
        const parts = line.split('|');
        key = parts[0].trim();
        val = parts.slice(1).join('|').trim();
      } else if (/\s{2,}/.test(line)) {
        const parts = line.split(/\s{2,}/);
        key = parts[0].trim();
        val = parts.slice(1).join(' ').trim();
      }

      const cleanK = key.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (key && val && KNOWN_HEADERS.has(cleanK)) {
        rawPairs[key] = val;
        continue;
      }

      // If no same-line separator was found, check if this line is a known header and the NEXT line is its value (alternating layout)
      const lineClean = line.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (KNOWN_HEADERS.has(lineClean) && i + 1 < lines.length) {
        const nextLine = lines[i + 1].trim();
        const nextLineClean = nextLine.toLowerCase().replace(/[^a-z0-9]/g, '');
        // Some common values can also look like known header names, e.g. "computer", "server", "user", "ip", "host", "device", "path", "action"
        const COMMON_VALUES = new Set(['computer', 'server', 'user', 'host', 'device', 'ip', 'path', 'action', 'file', 'process', 'os', 'cmd', 'hash']);
        // Make sure the next line is not itself another known header (unless it's actually a common value)
        if (!KNOWN_HEADERS.has(nextLineClean) || COMMON_VALUES.has(nextLineClean)) {
          rawPairs[line] = nextLine;
          i++; // Skip the next line as it was consumed as the value
        }
      }
    }
  }

  // 4. Fallback: alternating lines of any structure if we still have absolutely nothing
  if (Object.keys(rawPairs).length === 0) {
    for (let i = 0; i < lines.length - 1; i += 2) {
      const key = lines[i];
      const val = lines[i + 1];
      if (key && val) {
        rawPairs[key] = val;
      }
    }
  }

  // Map raw keys to standard placeholder keys with extremely comprehensive, bilingual aliases
  let commandLineParent = '';
  let commandLineStd = '';

  for (const [rawKey, val] of Object.entries(rawPairs)) {
    const k = rawKey.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (k === 'detectionid' || k === 'title' || k === 'eventname' || k === 'alertname' || k === 'alert' || k === 'namaevent' || k === 'namaalert' || k === 'incidentname') data['event_name'] = val;
    else if (k === 'severity' || k === 'priority' || k === 'level' || k === 'alertseverity' || k === 'skala' || k === 'tingkatbahaya' || k === 'prioritas') data['severity'] = val;
    else if (k === 'time' || k === 'seen' || k === 'detectiontime' || k === 'occurred' || k === 'when' || k === 'date' || k === 'waktu' || k === 'tanggal' || k === 'waktudeteksi' || k === 'tanggalwaktu' || k === 'datetime' || k === 'timestamp') data['seen'] = val;
    else if (k === 'devicetype' || k === 'devicecategory' || k === 'tipederice' || k === 'tipeperangkat' || k === 'tipeperangkat') data['device_type'] = val;
    else if (k === 'hostname' || k === 'computername' || k === 'device' || k === 'machinename' || k === 'computer' || k === 'host' || k === 'namakomputer' || k === 'perangkat' || k === 'namapeangkat' || k === 'namahost') data['hostname'] = val;
    else if (k === 'detectionip' || k === 'ipaddress' || k === 'ip' || k === 'hostip' || k === 'alamatip' || k === 'sourceip' || k === 'ipaddress' || k === 'alamatip') data['detection_ip'] = val;
    else if (k === 'processname' || k === 'filename' || k === 'file' || k === 'process' || k === 'namafile' || k === 'namaproses') data['file_name'] = val;
    else if (k === 'filepath' || k === 'path' || k === 'processpath' || k === 'lokasifile' || k === 'pathfile') data['file_path'] = val;
    else if (k === 'parentcommandline' || k === 'parentcmdline' || k === 'parentcmd' || k === 'parentcommandline') commandLineParent = val;
    else if (k === 'commandline' || k === 'cmdline' || k === 'cmd' || k === 'barisperintah') commandLineStd = val;
    else if (k === 'username' || k === 'accountname' || k === 'user' || k === 'account' || k === 'namaakun' || k === 'pengguna') data['username'] = val;
    else if (k === 'operatingsystem' || k === 'os' || k === 'platform' || k === 'sistemoperasi') data['operating_system'] = val;
    else if (k === 'iocvalue' || k === 'sha256' || k === 'hash' || k === 'filehash' || k === 'nilaihash') data['ioc_value'] = val;
    else if (k === 'action' || k === 'remediation' || k === 'actiontaken' || k === 'tindakan' || k === 'solusi' || k === 'remediasi') data['action'] = val;
    else if (k === 'incidentid' || k === 'incidentno' || k === 'ticketid' || k === 'idinsiden' || k === 'idticket' || k === 'noinsiden') data['incident_id'] = val;
  }

  if (commandLineParent) {
    data['command_line'] = commandLineParent;
  } else if (commandLineStd) {
    data['command_line'] = commandLineStd;
  }

  // Post-process default fields if specific event is matched
  const eventName = data['event_name'] || '';
  if (eventName.toUpperCase() === 'LNX-DET-RAM-CACHE-CLEARED') {
    data['deskripsi'] = "LNX-DET-RAM-CACHE-CLEARED adalah Alert yang menandakan bahwa sistem telah berhasil mengosongkan atau membersihkan cache RAM (memori sementara) untuk melepaskan ruang agar dapat digunakan kembali oleh sistem, atau sebagai bagian dari siklus pemeliharaan rutin";
    data['analisa_awal'] = `LNX-DET-RAM-CACHE-CLEARED terdeteksi saat akun ${data['username'] || 'sysadmin'} menjalankan script ${data['file_name'] || '/bin/sh'} pada server ${data['hostname'] || 'api-test'}. Aktivitas tersebut mengindikasikan proses pembersihan cache RAM yang umumnya dilakukan untuk keperluan maintenance dan optimasi penggunaan memori. Berdasarkan informasi yang tersedia, belum ditemukan indikasi malicious activity, namun diperlukan verifikasi terhadap isi script, sumber file, dan mekanisme eksekusinya untuk memastikan aktivitas merupakan proses operasional yang sah.`;
    data['reputasi'] = "-";
    data['mitigasi'] = `1. Verifikasi isi file  ${data['file_path'] || '/bin/sh'} dan validasi hash file.
2. Konfirmasi kepada administrator server terkait tujuan dan jadwal eksekusi script.
3. Periksa cron job atau automation task yang menjalankan script.
4. Monitor aktivitas lanjutan pada akun ${data['username'] || 'sysadmin'} and server terkait.
5. Jika terkonfirmasi legitimate, lakukan whitelisting sesuai prosedur keamanan yang berlaku.`;
  } else {
    // Generics
    data['deskripsi'] = `${eventName} alert terdeteksi pada Sophos XDR Platform.`;
    data['analisa_awal'] = `Aktivitas terdeteksi pada server ${data['hostname'] || '-'} oleh akun ${data['username'] || '-'}. Aktivitas ini sedang dianalisis oleh tim SOC.`;
    data['reputasi'] = "-";
    data['mitigasi'] = `1. Verifikasi aktivitas dan file target.\n2. Lakukan koordinasi dengan penanggung jawab aset server.`;
  }

  return data;
}

interface SophosEvent {
  eventName: string;
  total: number;
  severity: string;
  entity: string;
  category?: string;
  seen: string;
}

function parseSophosLogs(text: string): SophosEvent[] {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
  const events: SophosEvent[] = [];
  
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const totalMatch = line.match(/^(\d+)\s+total$/i);
    if (totalMatch && i > 0) {
      const eventName = lines[i - 1];
      const total = parseInt(totalMatch[1], 10);
      
      let severity = '';
      if (i + 1 < lines.length) {
        severity = lines[i + 1];
      }
      
      let entity = '';
      if (i + 2 < lines.length) {
        entity = lines[i + 2];
      }
      
      let category = '';
      let seen = '';
      
      if (i + 3 < lines.length) {
        const nextLine = lines[i + 3];
        if (nextLine.toLowerCase().startsWith('seen') || nextLine.toLowerCase().includes('ago')) {
          seen = nextLine;
          i = i + 4;
        } else {
          category = nextLine;
          if (i + 4 < lines.length) {
            seen = lines[i + 4];
          }
          i = i + 5;
        }
      } else {
        i = i + 3;
      }
      
      events.push({
        eventName,
        total,
        severity: severity.charAt(0).toUpperCase() + severity.slice(1).toLowerCase(),
        entity,
        category: category || undefined,
        seen
      });
    } else {
      i++;
    }
  }
  return events;
}

function formatSeverityList(eventsList: SophosEvent[]): string {
  if (eventsList.length === 0) {
    return "1. = (0)";
  }
  return eventsList
    .map((e, idx) => `${idx + 1}. ${e.eventName} (${e.total} ${e.total > 1 ? 'events' : 'event'})`)
    .join('\n');
}

function parseCSV(content: string): any[] {
  const lines: string[] = [];
  let currentLine = '';
  let inQuotes = false;
  
  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    if (char === '"') {
      inQuotes = !inQuotes;
      currentLine += char;
    } else if (char === '\n' && !inQuotes) {
      lines.push(currentLine);
      currentLine = '';
    } else if (char === '\r' && !inQuotes) {
      // skip
    } else {
      currentLine += char;
    }
  }
  if (currentLine) {
    lines.push(currentLine);
  }

  if (lines.length === 0) return [];

  // Parse fields helper
  const parseLine = (line: string): string[] => {
    const result: string[] = [];
    let cur = '';
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        inQ = !inQ;
      } else if (c === ',' && !inQ) {
        result.push(cur.trim().replace(/^"|"$/g, ''));
        cur = '';
      } else {
        cur += c;
      }
    }
    result.push(cur.trim().replace(/^"|"$/g, ''));
    return result;
  };

  const headers = parseLine(lines[0]).map(h => h.trim().replace(/^"|"$/g, ''));
  const data: any[] = [];

  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const values = parseLine(lines[i]);
    const row: any = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx] || '';
    });
    data.push(row);
  }

  return data;
}

function fillTemplate(templateContent: string, eventData: any, magMap?: Record<string, number>): string {
  let filled = templateContent;
  
  // Merge eventData with a dictionary of common fallback placeholders so that
  // any expected placeholders are guaranteed to be resolved, even if they aren't provided in eventData.
  const now = new Date();
  const formattedDate = `${String(now.getDate()).padStart(2, '0')}-${String(now.getMonth() + 1).padStart(2, '0')}-${now.getFullYear()}`;
  const formattedTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
  
  const commonFallbacks: Record<string, string> = {
    incident_id: `[SOC-NEOTECH] -${Math.floor(1000 + Math.random() * 9000)}`,
    event_name: "LNX-DET-RAM-CACHE-CLEARED",
    seen: `${formattedDate} ${formattedTime}`,
    severity: "Medium",
    username: "sysadmin",
    hostname: "api-test",
    detection_ip: "172.17.220.235",
    device_type: "server",
    operating_system: "Ubuntu 22.04.1 LTS (Jammy Jellyfish)",
    file_name: "/bin/sh",
    file_path: "/bin/sh",
    command_line: '["/bin/sh","-c","sync; echo 3 > /proc/sys/vm/drop_caches"]',
    ioc_value: "4f291296e89b784cd35479fca606f228126e3641f5bcaee68dee36583d7c9483",
    action: "Melakukan verifikasi terhadap file target untuk memastikan file merupakan bagian dari aktivitas aplikasi legitimate dan bukan payload malicious."
  };

  const mergedData = { ...commonFallbacks, ...eventData };

  for (const [key, val] of Object.entries(mergedData)) {
    const stringVal = val === null || val === undefined ? "-" : String(val);
    filled = filled.replace(new RegExp(`{${key}}`, 'g'), stringVal);
  }
  
  if (magMap) {
    const eventName = mergedData.event_name || "";
    const magnitude = magMap[eventName];
    if (magnitude !== undefined) {
      const severity = categorizeMagnitude(magnitude);
      filled = filled.replace(/{sev_magnitude}/g, String(magnitude));
      filled = filled.replace(/{severity}/g, severity);
    } else {
      filled = filled.replace(/{sev_magnitude}/g, mergedData.magnitude || "-");
      filled = filled.replace(/{severity}/g, "Unknown");
    }
  }

  // Final sweep: replace any remaining unresolved placeholders like {xyz} with "-"
  // to guarantee no raw placeholders leak into the final output.
  filled = filled.replace(/{[a-zA-Z0-9_]+}/g, "-");

  return filled;
}

function cleanShiftFolder(outputDir: string, shiftKey: string): string {
  const shiftOutdir = path.join(outputDir, `shift${shiftKey}`);
  fs.mkdirSync(shiftOutdir, { recursive: true });
  try {
    const files = fs.readdirSync(shiftOutdir);
    for (const file of files) {
      const filePath = path.join(shiftOutdir, file);
      fs.rmSync(filePath, { recursive: true, force: true });
    }
  } catch (e) {
    console.error('Error cleaning shift folder:', e);
  }
  return shiftOutdir;
}

// API Routes
app.get('/api/templates', (req, res) => {
  try {
    const baseDir = getTemplatesDir();
    if (!fs.existsSync(baseDir)) {
      return res.json({});
    }

    const result: Record<string, string[]> = {};
    const directories = fs.readdirSync(baseDir);

    for (const dir of directories) {
      const dirPath = path.join(baseDir, dir);
      if (fs.statSync(dirPath).isDirectory()) {
        const files = fs.readdirSync(dirPath)
          .filter(f => f.endsWith('.txt') && f !== 'event_template.txt')
          .map(f => f.replace('.txt', ''));
        result[dir] = files.sort();
      }
    }

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/templates/:instansi/:name', (req, res) => {
  const { instansi, name } = req.params;
  const filePath = path.join(getTemplatesDir(), instansi, `${name}.txt`);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Template not found' });
  }

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    res.json({ content, formattedName: formatEventName(name) });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/templates/:instansi/:name', (req, res) => {
  const { instansi, name } = req.params;
  const { content } = req.body;
  const filePath = path.join(getTemplatesDir(), instansi, `${name}.txt`);

  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content.trim() + '\n', 'utf-8');
    res.json({ success: true, message: `Template ${name} saved successfully!` });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/templates/:instansi/:name', (req, res) => {
  const { instansi, name } = req.params;
  const filePath = path.join(getTemplatesDir(), instansi, `${name}.txt`);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Template not found' });
  }

  try {
    fs.unlinkSync(filePath);
    res.json({ success: true, message: `Template ${name} deleted successfully!` });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/templates/create', (req, res) => {
  const { instansi, filename, deskripsi, mitigasi } = req.body;

  if (!instansi || !filename) {
    return res.status(400).json({ error: 'Instansi and filename are required' });
  }

  const cleanFilename = filename.toLowerCase().endsWith('.txt') ? filename : `${filename}.txt`;
  const baseTemplatePath = path.join(getTemplatesDir(), instansi, 'event_template.txt');
  const targetTemplatePath = path.join(getTemplatesDir(), instansi, cleanFilename);

  try {
    if (!fs.existsSync(baseTemplatePath)) {
      return res.status(400).json({ error: `Base template not found for instansi ${instansi}` });
    }

    let content = fs.readFileSync(baseTemplatePath, 'utf-8');
    content = content.replace(/{deskripsi}/g, deskripsi || '');
    content = content.replace(/{mitigasi}/g, mitigasi || '');
    content = content.replace(/{analisa_awal}/g, req.body.analisa_awal || '');
    content = content.replace(/{reputasi}/g, req.body.reputasi || '-');

    fs.writeFileSync(targetTemplatePath, content, 'utf-8');
    res.json({ success: true, message: `Template saved successfully as ${instansi}/${cleanFilename}` });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Create manual event preview and filler
app.post('/api/buat_event', (req, res) => {
  const { instansi, shift, use_raw, raw_text, analyst, ...fields } = req.body;

  if (!instansi || !shift) {
    return res.status(400).json({ error: 'Instansi and shift are required' });
  }

  try {
    const files: Array<{ name: string; content: string }> = [];
    const now = new Date();
    const formattedDate = `${String(now.getDate()).padStart(2, '0')}-${String(now.getMonth() + 1).padStart(2, '0')}-${now.getFullYear()}`;
    const formattedTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

    if (instansi.toLowerCase() === 'sophos') {
      console.log('[DEBUG /api/buat_event] Received Sophos request:', {
        use_raw,
        raw_text_length: raw_text ? raw_text.length : 0,
        raw_text_preview: raw_text ? raw_text.substring(0, 100) : null,
        fields
      });

      if (use_raw && raw_text) {
        const parsed = parseSophosDetailedLog(raw_text);
        console.log('[DEBUG /api/buat_event] Parsed Sophos raw log:', JSON.stringify(parsed));
        const eventName = parsed.event_name || 'LNX-DET-RAM-CACHE-CLEARED';
        const matchedFile = findTemplateFile(instansi, eventName);
        console.log('[DEBUG /api/buat_event] Matched template file:', matchedFile, 'for eventName:', eventName);
        let filledTemplate = '';

        if (matchedFile) {
          const template = fs.readFileSync(matchedFile, 'utf-8');
          filledTemplate = fillTemplate(template, parsed);
        } else {
          // Use base template if specific one is missing
          const baseTemplateFile = path.join(getTemplatesDir(), instansi, 'event_template.txt');
          if (fs.existsSync(baseTemplateFile)) {
            const baseContent = fs.readFileSync(baseTemplateFile, 'utf-8');
            filledTemplate = fillTemplate(baseContent, parsed);
          } else {
            filledTemplate = Object.entries(parsed)
              .map(([k, v]) => `${k}: ${v}`)
              .join('\n');
          }
        }

        files.push({
          name: `${eventName}_Report.txt`,
          content: filledTemplate
        });
      } else {
        const parsed = {
          incident_id: fields.incident_id || `[SOC-NEOTECH] -${Math.floor(1000 + Math.random() * 9000)}`,
          event_name: fields.event_name || fields.eventName || "LNX-DET-RAM-CACHE-CLEARED",
          seen: fields.waktu_deteksi || fields.waktuDeteksi || (formattedDate + " " + formattedTime),
          severity: fields.severity || "Medium",
          username: fields.username || "-",
          hostname: fields.hostname || "-",
          detection_ip: fields.detection_ip || fields.detectionIp || "-",
          device_type: fields.device_type || fields.deviceType || "-",
          operating_system: fields.operating_system || fields.operatingSystem || "Ubuntu 22.04.1 LTS (Jammy Jellyfish)",
          file_name: fields.file_name || fields.fileName || "-",
          file_path: fields.file_path || fields.filePath || "-",
          command_line: fields.command_line || fields.commandLine || "-",
          ioc_value: fields.ioc_value || fields.iocValue || "-",
          action: fields.action || "Melakukan verifikasi terhadap file target untuk memastikan file merupakan bagian dari aktivitas aplikasi legitimate dan bukan payload malicious.",
          deskripsi: fields.deskripsi || fields.description || "-",
          analisa_awal: fields.analisa_awal || fields.analisaAwal || "-",
          reputasi: fields.reputasi || "-",
          mitigasi: fields.mitigasi || "-",
        };

        const eventName = parsed.event_name;
        const matchedFile = findTemplateFile(instansi, eventName);
        let filledTemplate = '';

        if (matchedFile) {
          const template = fs.readFileSync(matchedFile, 'utf-8');
          filledTemplate = fillTemplate(template, parsed);
        } else {
          // Use base template if specific one is missing
          const baseTemplateFile = path.join(getTemplatesDir(), instansi, 'event_template.txt');
          if (fs.existsSync(baseTemplateFile)) {
            const baseContent = fs.readFileSync(baseTemplateFile, 'utf-8');
            filledTemplate = fillTemplate(baseContent, parsed);
          } else {
            filledTemplate = Object.entries(parsed)
              .map(([k, v]) => `${k}: ${v}`)
              .join('\n');
          }
        }

        files.push({
          name: `${eventName}_Report.txt`,
          content: filledTemplate
        });
      }
    } else {
      const csvPath = path.join(getDatabaseDir(), instansi, 'events_magnitude_list.csv');
      const magMap = loadEventMagnitudes(csvPath);

      if (use_raw && raw_text) {
        const events = parseTxtContent(raw_text);
        for (const eventData of events) {
          if (!eventData.magnitude && fields.severity) {
            eventData.magnitude = fields.severity;
          }

          const eventName = (eventData.event_name || "").trim().replace(/^"|"$/g, '');
          const ticketId = (eventData.ticket_id || "").trim();
          const eventType = (eventData.event_type || "").trim();

          const templatePath = path.join(getTemplatesDir(), instansi, `${eventName}.txt`);
          let filledTemplate = '';

          if (fs.existsSync(templatePath)) {
            const template = fs.readFileSync(templatePath, 'utf-8');
            filledTemplate = fillTemplate(template, eventData, magMap);
          } else {
            // Fallback: list all event details
            filledTemplate = Object.entries(eventData)
              .map(([k, v]) => `${k}: ${v}`)
              .join('\n');
          }

          const outFileName = ticketId && eventType ? `${eventName}_${ticketId}_${eventType}.txt` : `${eventName}_Report.txt`;
          files.push({
            name: outFileName,
            content: filledTemplate
          });
        }
      } else {
        const eventData = {
          event_id: `MANUAL-${now.getTime()}`,
          analyst: analyst || "SOC Analyst",
          ticket_id: `EV-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`,
          event_type: "Offensess",
          reason_close: "-",
          escalation: "-",
          link_alert: "-",
          event_name: fields.event_name || "Manual Event",
          magnitude: fields.severity || "-",
          tanggal: formattedDate,
          waktu: formattedTime,
          ticket_date: formattedDate,
          ticket_time: formattedTime,
          soc_response_time: "-",
          user_date: "-",
          user_time: "-",
          user_response_time: "-",
          action: fields.description || "-",
          event_status: "Open",
          traffic_flow: "-",
          src_ip: fields.src_ip || "-",
          src_country: fields.src_country || "-",
          dst_ip: fields.dst_ip || "-",
          dst_port: fields.dst_port || "-",
          dst_country: fields.dst_country || "-",
          app_access: "-",
          user_agent: "-",
          request_server: "-",
          url: fields.url_dns || "-",
          query: fields.query || "-",
          note: "-",
          waktu_deteksi: fields.waktu_deteksi || "-",
        };

        const eventName = (eventData.event_name || "").trim().replace(/^"|"$/g, '');
        const templatePath = path.join(getTemplatesDir(), instansi, `${eventName}.txt`);
        let filledTemplate = '';

        if (fs.existsSync(templatePath)) {
          const template = fs.readFileSync(templatePath, 'utf-8');
          filledTemplate = fillTemplate(template, eventData, magMap);
        } else {
          // Fallback: list all event details
          filledTemplate = Object.entries(eventData)
            .map(([k, v]) => `${k}: ${v}`)
            .join('\n');
        }

        const outFileName = `${eventName}_Report.txt`;
        files.push({
          name: outFileName,
          content: filledTemplate
        });
      }
    }

    res.json({ success: true, files });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// XML / TSV Parsing main upload endpoint
app.post('/api/process', upload.single('file'), async (req, res, next) => {
  const processLog: string[] = [];
  const resultFiles: any[] = [];
  let instansi = '';
  let shift = '';
  let file: any = undefined;

  try {
    instansi = req.body.instansi || '';
    shift = req.body.shift || '';
    const { paste_text } = req.body;
    file = req.file;

    if (!instansi || !shift) {
      return res.status(400).json({ error: 'Instansi and shift are required' });
    }
    if (!file && !paste_text) {
      return res.status(400).json({ error: 'Log or XML file must be uploaded or log text must be pasted' });
    }

    processLog.push(`🏢 Instansi dipilih: ${instansi.toUpperCase()}`);
    processLog.push(`🕐 Shift: ${shift}`);
    if (file) {
      processLog.push(`📥 File diterima: ${file.originalname}`);
    } else {
      processLog.push(`📥 Teks log langsung diterima (Pasted Text)`);
    }

    const fileExt = file ? file.originalname.split('.').pop()?.toLowerCase() : 'txt';

    const baseDb = path.join(getDatabaseDir(), instansi);
    const magMap = loadEventMagnitudes(path.join(baseDb, 'events_magnitude_list.csv'));
    const validEvents = Object.keys(magMap); // or parsed csv names
    const fpEvents = loadFalsePositives(path.join(baseDb, 'False_Positive.txt'));

    const outputDir = path.join(process.env.VERCEL ? '/tmp/outputs' : 'outputs', instansi);
    fs.mkdirSync(outputDir, { recursive: true });

    if (instansi.toLowerCase() === 'aal') {
      const rawContent = file ? fs.readFileSync(file.path, 'utf-8') : (paste_text || '');
      processLog.push(`🔍 Mengurai file CSV AAL...`);
      const parsedData = parseCSV(rawContent);
      processLog.push(`✅ Berhasil mengurai ${parsedData.length} baris data CSV.`);

      // Check if this is a DGA or Botnet file
      const isDga = parsedData.length > 0 && (() => {
        const keys = Object.keys(parsedData[0]);
        const hasUrl = keys.some(k => k.toLowerCase().trim() === 'url');
        const originalName = file ? file.originalname.toLowerCase() : '';
        return hasUrl || originalName.includes('dga');
      })();

      // Group and pivot data
      const groups: Record<string, Record<string, number>> = {};
      let totalCount = 0;

      for (const row of parsedData) {
        const keys = Object.keys(row);
        const ipKey = keys.find(k => k.toLowerCase().replace(/[^a-z0-9]/g, '') === 'sourceip') || 'source.ip';
        let domainKey = '';
        if (isDga) {
          domainKey = keys.find(k => k.toLowerCase().trim() === 'url') || 'url';
        } else {
          domainKey = keys.find(k => k.toLowerCase().replace(/[^a-z0-9]/g, '') === 'botnetdomain') || 'botnetdomain';
        }
        
        const ip = (row[ipKey] || '').trim();
        const domain = (row[domainKey] || '').trim();
        
        if (!ip || !domain) continue;

        if (!groups[ip]) {
          groups[ip] = {};
        }
        groups[ip][domain] = (groups[ip][domain] || 0) + 1;
        totalCount++;
      }

      processLog.push(`📊 Melakukan Pivot Table (Grouping by source.ip & ${isDga ? 'url' : 'botnetdomain'})...`);
      
      const sortedIps = Object.keys(groups).sort();
      const aalPivotData = sortedIps.map(ip => {
        const domainCounts = groups[ip];
        const subtotal = Object.values(domainCounts).reduce((a, b) => a + b, 0);
        const domains = Object.entries(domainCounts).map(([domain, count]) => ({
          domain,
          count
        })).sort((a, b) => a.domain.localeCompare(b.domain));
        
        return { ip, subtotal, domains };
      });

      processLog.push(`📈 Pivot Table sukses dibentuk dengan ${sortedIps.length} Source IP unik.`);

      const excelFileName = file ? file.originalname.replace(/\.csv$/i, '') + '_Processed.xlsx' : `AAL_${isDga ? 'DGA' : 'Report'}_Shift_${shift}.xlsx`;
      const shiftOutdir = cleanShiftFolder(outputDir, shift);
      const excelFilePath = path.join(shiftOutdir, excelFileName);

      // Create Worksheet 1: Sheet1 (PivotTable)
      const pivotSheet = createStyledPivotSheet(aalPivotData, totalCount, isDga ? 'url' : 'botnetdomain');

      // Create Worksheet 2: Raw Data
      const rawSheet = XLSX.utils.json_to_sheet(parsedData);
      
      // Auto fit columns, style header, and add auto filter
      autoFitJsonColumns(rawSheet, parsedData);
      styleRawSheet(rawSheet, parsedData);
      addAutoFilter(rawSheet, parsedData);

      const workbook = XLSX.utils.book_new();
      
      // Append pivot sheet first so it is on the left and selected by default (matching Image 2 layout)
      XLSX.utils.book_append_sheet(workbook, pivotSheet, "Source IP Detected");
      const rawSheetName = isDga ? "Raw Log DGA Connection" : "Raw Log Botnet C&C";
      XLSX.utils.book_append_sheet(workbook, rawSheet, rawSheetName);

      XLSX.writeFile(workbook, excelFilePath);

      resultFiles.push({
        name: excelFileName,
        path: excelFilePath,
        downloadUrl: `/api/download?path=${encodeURIComponent(excelFilePath)}`,
        type: 'excel'
      });

      processLog.push(`📁 File Excel (.xlsx) sukses dibuat: ${excelFileName}`);

      // WhatsApp text generation for AAL
      let waText = '';
      if (isDga) {
        waText = `Selamat Pagi Rekan - Rekan,

Berikut kami lampirkan hasil dari monitoring/pivot data DGA AAL pada Shift ${shift},
dimana terdeteksi aktivitas DGA URL sebagai berikut :

`;
      } else {
        waText = `Selamat Pagi Rekan - Rekan,

Berikut kami lampirkan hasil dari monitoring/pivot data Botnet AAL pada Shift ${shift},
dimana terdeteksi aktivitas botnet domain sebagai berikut :

`;
      }

      aalPivotData.forEach(group => {
        waText += `*IP: ${group.ip}* (Total: ${group.subtotal} deteksi)\n`;
        group.domains.forEach(d => {
          waText += ` - ${d.domain} (${d.count} event)\n`;
        });
        waText += `\n`;
      });

      if (isDga) {
        waText += `Total Keseluruhan Event DGA: ${totalCount} event\n\nDemikian atas informasinya.\nTerimakasih,\nSOC Neotech`;
      } else {
        waText += `Total Keseluruhan Event Botnet: ${totalCount} event\n\nDemikian atas informasinya.\nTerimakasih,\nSOC Neotech`;
      }

      const waFileName = isDga ? `wa_aal_dga_shift${shift}.txt` : `wa_aal_shift${shift}.txt`;
      const waFilePath = path.join(shiftOutdir, waFileName);
      fs.writeFileSync(waFilePath, waText, 'utf-8');

      resultFiles.push({
        name: waFileName,
        path: waFilePath,
        downloadUrl: `/api/download?path=${encodeURIComponent(waFilePath)}`,
        type: 'wa',
        content: waText
      });

      processLog.push(`💬 WhatsApp report sukses dibuat: ${waFileName}`);

      // Clean up uploaded file
      if (file && fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }

      return res.json({
        success: true,
        message: isDga ? "Proses file event DGA AAL selesai!" : "Proses file event AAL selesai!",
        instansi,
        shift,
        processLog,
        resultFiles,
        aalPivotData,
        aalRawData: parsedData,
        isDga
      });
    }

    if (fileExt === 'txt') {
      if (instansi.toLowerCase() === 'sophos') {
        const rawContent = file ? fs.readFileSync(file.path, 'utf-8') : (paste_text || '');
        const shiftOutdir = cleanShiftFolder(outputDir, shift);

        const lowerRaw = rawContent.toLowerCase();
        const hasDetailedKeywords = 
          lowerRaw.includes('detection id') || 
          lowerRaw.includes('hostname') || 
          lowerRaw.includes('severity') || 
          lowerRaw.includes('computer name') || 
          lowerRaw.includes('nama komputer') || 
          lowerRaw.includes('ip address') || 
          lowerRaw.includes('alamat ip') || 
          lowerRaw.includes('waktu deteksi') || 
          lowerRaw.includes('incident id') || 
          lowerRaw.includes('account name') || 
          lowerRaw.includes('nama akun');

        if (hasDetailedKeywords) {
          const parsed = parseSophosDetailedLog(rawContent);
          const eventName = parsed.event_name || 'LNX-DET-RAM-CACHE-CLEARED';
          const matchedFile = findTemplateFile(instansi, eventName);
          
          let filled = '';
          if (matchedFile) {
            const templateContent = fs.readFileSync(matchedFile, 'utf-8');
            filled = fillTemplate(templateContent, parsed);
          } else {
            // Use base template if specific one is missing
            const baseTemplateFile = path.join(getTemplatesDir(), instansi, 'event_template.txt');
            if (fs.existsSync(baseTemplateFile)) {
              const baseContent = fs.readFileSync(baseTemplateFile, 'utf-8');
              filled = fillTemplate(baseContent, parsed);
            } else {
              filled = Object.entries(parsed)
                .map(([k, v]) => `${k}: ${v}`)
                .join('\n');
            }
          }

          const outFileName = `${eventName}_Report.txt`;
          const outFilePath = path.join(shiftOutdir, outFileName);
          fs.writeFileSync(outFilePath, filled, 'utf-8');

          resultFiles.push({
            name: outFileName,
            path: outFilePath,
            downloadUrl: `/api/download?path=${encodeURIComponent(outFilePath)}`,
            type: 'text',
            content: filled
          });

          processLog.push(`✅ Parsing detailed single Sophos event selesai.`);
          processLog.push(`📑 Event report files generated: 1`);

        } else {
          const events = parseSophosLogs(rawContent);
          processLog.push(`✅ Parsing ${events.length} Sophos event selesai.`);

          // Group by severity
          const criticalList = events.filter(e => e.severity.toLowerCase() === 'critical');
          const highList = events.filter(e => e.severity.toLowerCase() === 'high');
          const mediumList = events.filter(e => e.severity.toLowerCase() === 'medium');
          const lowList = events.filter(e => e.severity.toLowerCase() === 'low');

          // Generate individual event report files if templates or fallbacks are used
          for (const eventData of events) {
            const eventName = eventData.eventName;
            const matchedFile = findTemplateFile(instansi, eventName);
            let filled = `Sophos Alert Report\nEvent Name: ${eventName}\nTotal: ${eventData.total}\nSeverity: ${eventData.severity}\nEntity: ${eventData.entity}\nCategory: ${eventData.category || '-'}\nTime: ${eventData.seen}`;
            
            if (matchedFile) {
              const templateContent = fs.readFileSync(matchedFile, 'utf-8');
              filled = fillTemplate(templateContent, {
                ...eventData,
                event_name: eventName,
                hostname: eventData.entity,
                seen: eventData.seen
              });
            } else {
              // Use base template if specific one is missing
              const baseTemplateFile = path.join(getTemplatesDir(), instansi, 'event_template.txt');
              if (fs.existsSync(baseTemplateFile)) {
                const baseContent = fs.readFileSync(baseTemplateFile, 'utf-8');
                filled = fillTemplate(baseContent, {
                  ...eventData,
                  event_name: eventName,
                  hostname: eventData.entity,
                  seen: eventData.seen
                });
              }
            }
            
            const outFileName = `${eventName}_Report.txt`;
            const outFilePath = path.join(shiftOutdir, outFileName);
            fs.writeFileSync(outFilePath, filled, 'utf-8');

            resultFiles.push({
              name: outFileName,
              path: outFilePath,
              downloadUrl: `/api/download?path=${encodeURIComponent(outFilePath)}`,
              type: 'text',
              content: filled
            });
          }

          processLog.push(`📑 Event report files generated: ${resultFiles.length}`);

          // WhatsApp report generation
          const waTemplatePath = path.join(getTemplatesDir(), instansi, `wa_template_${instansi}.txt`);
          let waText = '';
          
          const todayDateObj = new Date();
          const yesterdayDateObj = new Date();
          yesterdayDateObj.setDate(todayDateObj.getDate() - 1);
          
          const formatDateObj = (d: Date) => {
            const day = String(d.getDate()).padStart(2, '0');
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const year = d.getFullYear();
            return `${day}-${month}-${year}`;
          };

          const todayStr = formatDateObj(todayDateObj);
          const yesterdayStr = formatDateObj(yesterdayDateObj);
          const defaultDateRange = `${yesterdayStr} jam 08.00 - ${todayStr} jam 08.00`;

          const criticalStr = formatSeverityList(criticalList);
          const highStr = formatSeverityList(highList);
          const mediumStr = formatSeverityList(mediumList);
          const lowStr = formatSeverityList(lowList);

          if (fs.existsSync(waTemplatePath)) {
            const template = fs.readFileSync(waTemplatePath, 'utf-8');
            waText = template
              .replace(/{salam}/g, 'Selamat Pagi')
              .replace(/{tanggal_range}/g, defaultDateRange)
              .replace(/{critical}/g, criticalStr)
              .replace(/{high}/g, highStr)
              .replace(/{medium}/g, mediumStr)
              .replace(/{low}/g, lowStr);
          } else {
            // Fallback if template doesn't exist yet
            waText = `Selamat Pagi Rekan - Rekan,

Berikut kami lampirkan hasil dari monitoring pada tanggal ${defaultDateRange},
dimana pada Sophos XDR Platform mendeteksi adanya event sebagai berikut :

A. Critical :
${criticalStr}

B. High :
${highStr}

C. Medium :
${mediumStr}

D. Low :
${lowStr}

Terimakasih,
SOC Neotech`;
          }

          const waFileName = `wa_${instansi.toLowerCase()}_shift${shift}.txt`;
          const waFilePath = path.join(shiftOutdir, waFileName);
          fs.writeFileSync(waFilePath, waText, 'utf-8');

          resultFiles.push({
            name: waFileName,
            path: waFilePath,
            downloadUrl: `/api/download?path=${encodeURIComponent(waFilePath)}`,
            type: 'wa',
            content: waText
          });

          processLog.push(`💬 WA Report successfully created: ${waFileName}`);
        }
      } else {
        const events = file ? parseTxtFile(file.path) : parseTxtContent(paste_text || '');
        processLog.push(`✅ Parsing ${events.length} event selesai.`);

        const shiftOutdir = cleanShiftFolder(outputDir, shift);
        const processedEventNames = new Set<string>();
        const validTypes = ["Log Activity", "Offensess", "Offenses"];

        const offenses = events.filter(e => {
          const type = (e.event_type || '').trim().toLowerCase();
          return type === 'offensess' || type === 'offenses';
        });
        const logs = events.filter(e => {
          const type = (e.event_type || '').trim().toLowerCase();
          return type === 'log activity' || type === 'log_activity';
        });

        for (const eventData of events) {
          const eventName = (eventData.event_name || "").trim().replace(/^"|"$/g, '');
          const ticketId = (eventData.ticket_id || "").trim();
          const eventType = (eventData.event_type || "").trim();

          const isMatched = validTypes.some(vt => vt.toLowerCase() === eventType.toLowerCase());
          if (!ticketId || !isMatched) continue;

          const uniqueKey = `${eventName}_${ticketId}_${eventType}`;
          if (processedEventNames.has(uniqueKey)) continue;

          const templateFile = path.join(getTemplatesDir(), instansi, `${eventName}.txt`);
          if (fs.existsSync(templateFile)) {
            const templateContent = fs.readFileSync(templateFile, 'utf-8');
            const filled = fillTemplate(templateContent, eventData, magMap);

            const outFileName = `${eventName}_${ticketId}_${eventType}.txt`;
            const outFilePath = path.join(shiftOutdir, outFileName);
            fs.writeFileSync(outFilePath, filled, 'utf-8');

            resultFiles.push({
              name: outFileName,
              path: outFilePath,
              downloadUrl: `/api/download?path=${encodeURIComponent(outFilePath)}`,
              type: 'text'
            });

            processedEventNames.add(uniqueKey);
          }
        }

        processLog.push(`📑 Event report files generated: ${resultFiles.length}`);

        // WhatsApp report generation
        const waTemplatePath = path.join(getTemplatesDir(), instansi, `wa_template_${instansi}.txt`);
        if (fs.existsSync(waTemplatePath)) {
          const template = fs.readFileSync(waTemplatePath, 'utf-8');
          const shiftInfo = SHIFTS[shift];
          const greeting = shiftInfo ? shiftInfo[0] : "Selamat";
          const jam = shiftInfo ? shiftInfo[1] : "";
          
          let tanggal = new Date().toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' });
          if (events.length > 0) {
            const firstWithDate = events.find(e => e.tanggal && e.tanggal !== "-");
            if (firstWithDate) {
              tanggal = firstWithDate.tanggal;
            }
          }

          const offensesCount: Record<string, number> = {};
          for (const e of offenses) {
            const name = (e.event_name || "").trim().replace(/^"|"$/g, '');
            if (!name) continue;
            offensesCount[name] = (offensesCount[name] || 0) + 1;
          }

          const logsCount: Record<string, number> = {};
          for (const e of logs) {
            const name = (e.event_name || "").trim().replace(/^"|"$/g, '');
            if (!name) continue;
            logsCount[name] = (logsCount[name] || 0) + 1;
          }

          let offensesStr = Object.entries(offensesCount)
            .map(([name, count], i) => `${i + 1}. ${name} (${count} ${count > 1 ? 'events' : 'event'})`)
            .join("\n");
          if (!offensesStr) offensesStr = "Tidak ada event terdeteksi";

          let logsStr = Object.entries(logsCount)
            .map(([name, count], i) => `${i + 1}. ${name} (${count} ${count > 1 ? 'events' : 'event'})`)
            .join("\n");
          if (!logsStr) logsStr = "Tidak ada event terdeteksi";

          let waText = template
            .replace(/{salam}/g, greeting)
            .replace(/{tanggal}/g, tanggal)
            .replace(/{jam}/g, jam)
            .replace(/{offenses}/g, offensesStr)
            .replace(/{log_activity}/g, logsStr);

          const waFileName = `wa_${instansi.toLowerCase()}_shift${shift}.txt`;
          const waFilePath = path.join(shiftOutdir, waFileName);
          fs.writeFileSync(waFilePath, waText, 'utf-8');

          resultFiles.push({
            name: waFileName,
            path: waFilePath,
            downloadUrl: `/api/download?path=${encodeURIComponent(waFilePath)}`,
            type: 'wa',
            content: waText
          });

          processLog.push(`💬 WA Report successfully created: ${waFileName}`);
        } else {
          processLog.push(`⚠️ WA template not found at templates/${instansi}/wa_template_${instansi}.txt`);
        }
      }
    } else if (fileExt === 'xml') {
      const content = fs.readFileSync(file.path, 'utf-8');
      const parser = new xml2js.Parser({ explicitArray: false, mergeAttrs: true });
      const result = await parser.parseStringPromise(content);

      let offensesList: any[] = [];
      if (result && result.OffenseForm) {
        offensesList = Array.isArray(result.OffenseForm) ? result.OffenseForm : [result.OffenseForm];
      } else if (result && result.offenses && result.offenses.OffenseForm) {
        offensesList = Array.isArray(result.offenses.OffenseForm) ? result.offenses.OffenseForm : [result.offenses.OffenseForm];
      } else {
        const rootKey = Object.keys(result)[0];
        if (rootKey && result[rootKey] && result[rootKey].OffenseForm) {
          offensesList = Array.isArray(result[rootKey].OffenseForm) ? result[rootKey].OffenseForm : [result[rootKey].OffenseForm];
        }
      }

      const tags = [
        "id", "magnitude", "closeUser", "formattedClosedDate", "localizedCloseReason",
        "deviceOrderBy", "escapedFormattedOffenseSource", "formattedOffenseType",
        "description", "severity", "eventCount", "eventDescription", "startTime", "endTime",
        "attacker", "target", "deviceCount", "targetNetwork", "attackerNetwork", "usernameOrderBy"
      ];

      const rows = offensesList.map(offense => {
        const row: Record<string, string> = {};
        for (const tag of tags) {
          row[tag] = offense[tag] || "";
        }
        return row;
      });

      const baseNameNoExt = file ? path.basename(file.path, '.xml') : 'pasted_xml';
      const dateMatch = /(\d{4})-(\d{2})-(\d{2})/.exec(baseNameNoExt);
      let tanggalFile = "UnknownDate";
      if (dateMatch) {
        const [_, tahun, bulan, hari] = dateMatch;
        const bulanInt = parseInt(bulan, 10);
        const bulanText = [
          "Januari", "Februari", "Maret", "April", "Mei", "Juni",
          "Juli", "Agustus", "September", "Oktober", "November", "Desember"
        ][bulanInt - 1] || "Unknown";
        tanggalFile = `${parseInt(hari, 10).toString().padStart(2, '0')} ${bulanText} ${tahun}`;
      }

      const excelFileName = `FollowUp & Closed Offenses List - ${tanggalFile} ( Shift ${shift} ).xlsx`;
      const excelFilePath = path.join(outputDir, excelFileName);

      const worksheet = XLSX.utils.json_to_sheet(rows);
      autoFitJsonColumns(worksheet, rows);
      styleRawSheet(worksheet, rows);
      addAutoFilter(worksheet, rows);

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Offenses");
      XLSX.writeFile(workbook, excelFilePath);

      resultFiles.push({
        name: excelFileName,
        path: excelFilePath,
        downloadUrl: `/api/download?path=${encodeURIComponent(excelFilePath)}`,
        type: 'excel'
      });

      processLog.push(`📊 XML successfully converted to Excel: ${excelFileName}`);
    } else {
      processLog.push(`❌ Unknown file format: ${fileExt}`);
    }

    // Populate base64 content for reliable serverless downloads
    for (const f of resultFiles) {
      try {
        if (f.path && fs.existsSync(f.path)) {
          const fileBuffer = fs.readFileSync(f.path);
          f.base64 = fileBuffer.toString('base64');
          if (f.type !== 'excel') {
            f.content = fileBuffer.toString('utf-8');
          }
        }
      } catch (err) {
        console.error(`Error reading file for base64:`, err);
      }
    }

    res.json({
      success: true,
      message: "Proses selesai!",
      instansi,
      shift,
      processLog,
      resultFiles
    });

  } catch (error: any) {
    processLog.push(`💥 Terjadi kesalahan: ${error.message}`);
    res.json({
      success: false,
      message: `Gagal memproses file: ${error.message}`,
      instansi,
      shift,
      processLog,
      resultFiles: []
    });
  } finally {
    // Clean up uploaded input file
    try {
      if (file && fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
    } catch (e) {}
  }
});

app.get('/api/download', (req, res) => {
  const filePathQuery = req.query.path as string;
  if (!filePathQuery) {
    return res.status(400).send('Path is required');
  }

  const safePath = path.resolve(filePathQuery);
  const rootDir = process.cwd();

  // Security check: ensure path is inside the project directory or inside /tmp (for Vercel serverless)
  const isInsideRootDir = safePath.startsWith(rootDir);
  const isInsideTmpDir = safePath.startsWith('/tmp');

  if (!isInsideRootDir && !isInsideTmpDir) {
    return res.status(403).send('Access Denied');
  }

  if (!fs.existsSync(safePath)) {
    return res.status(404).send('File not found');
  }

  res.download(safePath);
});

// Unhandled error-handling middleware to prevent HTML leak
app.use((err: any, req: any, res: any, next: any) => {
  console.error('Unhandled server error:', err);
  res.status(500).json({
    success: false,
    message: err.message || 'Internal Server Error',
    processLog: [`💥 Server Error: ${err.message || 'Internal Server Error'}`],
    resultFiles: []
  });
});

// Configure Vite or Static files depending on mode
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

if (!process.env.VERCEL) {
  startServer();
}

export default app;
