import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  HeadingLevel,
  AlignmentType,
  WidthType,
  BorderStyle,
  Header,
  Footer,
  PageNumber,
  ImageRun
} from 'docx';

export interface PoCImage {
  id: string;
  dataUrl: string; // base64 data URL
  caption: string;
  width?: number;
  height?: number;
}

export interface VulnerabilityItem {
  id: string;
  name: string;
  path: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
  owasp: string;
  status: 'OPEN' | 'RESOLVED' | 'IN_PROGRESS';
  notes?: string;
  images: PoCImage[];
  // AI-generated or custom narratives
  techDescription?: string;
  pocNarrative?: string;
  impact?: string;
  recommendations?: string[];
}

export interface ReportMeta {
  docNumber: string; // e.g. "58A.NR.092026"
  docTitle: string; // e.g. "58A. Notifikasi Report - Aplikasi SIHEPI"
  appName: string; // e.g. "Aplikasi SIHEPI"
  targetUrl: string; // e.g. "sihepi.kemkes.go.id"
  reportDate: string; // e.g. "21 September 2026"
  tlp: 'TLP : AMBER' | 'TLP : WHITE' | 'TLP : GREEN' | 'TLP : RED';
  instansi: string; // e.g. "Tim Tanggap Insiden Siber (CSIRT) dan Pelindungan Data Pribadi (PDP) - Kementerian Kesehatan"
  signerRole: string; // e.g. "Ketua Tim Kerja Penyelenggaraan Layanan Tim Tanggap Insiden Siber (CSIRT) dan Pelindungan Data Pribadi (PDP)"
  signerName: string; // e.g. "Istiqomah, SS, MKM"
  signaturePlaceholder: string; // default "${ttd_pengirim}"
  // Overall narratives
  executiveSummary?: string;
  overallImpact?: string;
  conclusion?: string;
}

// Convert base64 data URL or URL path to Uint8Array
async function resolveImageBytes(dataUrl: string): Promise<Uint8Array> {
  if (dataUrl.startsWith('http://') || dataUrl.startsWith('https://') || dataUrl.startsWith('/')) {
    const res = await fetch(dataUrl);
    const buf = await res.arrayBuffer();
    return new Uint8Array(buf);
  }
  const parts = dataUrl.split(',');
  const base64 = parts[1] || parts[0];
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

// Helper to determine TLP text color
function getTlpColor(tlp: string): string {
  if (tlp.includes('RED')) return 'C00000';
  if (tlp.includes('AMBER')) return 'D97706';
  if (tlp.includes('GREEN')) return '16A34A';
  return '475569'; // WHITE / default
}

// Helper to determine severity color
function getSeverityColor(sev: string): string {
  switch (sev.toUpperCase()) {
    case 'CRITICAL': return 'C00000'; // Red
    case 'HIGH': return 'EA580C';     // Orange
    case 'MEDIUM': return 'CA8A04';   // Yellow/Amber
    case 'LOW': return '2563EB';      // Blue
    default: return '64748B';         // Gray
  }
}

export async function generateWordReport(
  meta: ReportMeta,
  vulnerabilities: VulnerabilityItem[]
): Promise<Blob> {
  const tlpHex = getTlpColor(meta.tlp);

  // 1. Header with TLP
  const header = new Header({
    children: [
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        spacing: { after: 120 },
        children: [
          new TextRun({
            text: meta.tlp,
            bold: true,
            size: 20, // 10pt
            color: tlpHex,
            font: 'Arial'
          })
        ]
      })
    ]
  });

  // 2. Footer with Page Number
  const footer = new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        spacing: { before: 120 },
        children: [
          new TextRun({
            children: [PageNumber.CURRENT],
            size: 18,
            font: 'Arial',
            color: '64748B'
          })
        ]
      })
    ]
  });

  const children: (Paragraph | Table)[] = [];

  // Title / Metadata Block
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 200, after: 100 },
      children: [
        new TextRun({
          text: 'Notifikasi Kerentanan',
          bold: true,
          size: 32, // 16pt
          font: 'Arial',
          color: '1E293B'
        })
      ]
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [
        new TextRun({
          text: `${meta.appName} (${meta.targetUrl})`,
          bold: true,
          size: 26, // 13pt
          font: 'Arial',
          color: '2563EB'
        })
      ]
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 300 },
      children: [
        new TextRun({
          text: `Nomor: ${meta.docNumber}  |  Tanggal: ${meta.reportDate}`,
          italics: true,
          size: 20,
          font: 'Arial',
          color: '64748B'
        })
      ]
    })
  );

  // Daftar Isi
  children.push(
    new Paragraph({
      text: 'Daftar Isi',
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 200, after: 120 }
    }),
    new Paragraph({
      children: [
        new TextRun({ text: '1. Ringkasan Eksekutif', font: 'Arial', size: 22 })
      ],
      spacing: { after: 60 }
    }),
    new Paragraph({
      children: [
        new TextRun({ text: '2. Kerentanan', font: 'Arial', size: 22 })
      ],
      spacing: { after: 60 }
    }),
    new Paragraph({
      children: [
        new TextRun({ text: '3. PoC (Proof of Concept)', font: 'Arial', size: 22 })
      ],
      spacing: { after: 60 }
    })
  );

  vulnerabilities.forEach((v, idx) => {
    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: `    3.${idx + 1} ${v.name}`, font: 'Arial', size: 20, bold: true, color: '334155' })
        ],
        spacing: { after: 40 }
      })
    );
  });

  children.push(
    new Paragraph({
      children: [
        new TextRun({ text: '4. Dampak', font: 'Arial', size: 22 })
      ],
      spacing: { after: 60 }
    }),
    new Paragraph({
      children: [
        new TextRun({ text: '5. Simpulan', font: 'Arial', size: 22 })
      ],
      spacing: { after: 60 }
    }),
    new Paragraph({
      children: [
        new TextRun({ text: '6. Rekomendasi', font: 'Arial', size: 22 })
      ],
      spacing: { after: 200 }
    })
  );

  // 1. Ringkasan Eksekutif
  children.push(
    new Paragraph({
      text: '1. Ringkasan Eksekutif',
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 300, after: 120 }
    })
  );

  const execSummaryText =
    meta.executiveSummary ||
    `Terdeteksi adanya beberapa potensi kerentanan yaitu ${vulnerabilities.map(v => v.name).join(' dan ')} pada aplikasi ${meta.appName} (${meta.targetUrl}). Temuan ini teridentifikasi selama pengujian keamanan sistem dan memerlukan penanganan serta mitigasi segera guna mencegah potensi eskalasi serangan atau kebocoran data.`;

  execSummaryText.split('\n\n').forEach(paragraphText => {
    if (paragraphText.trim()) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: paragraphText.trim(),
              font: 'Arial',
              size: 22
            })
          ],
          alignment: AlignmentType.JUSTIFIED,
          spacing: { after: 0, line: 360 }
        })
      );
    }
  });

  // 2. Kerentanan
  children.push(
    new Paragraph({
      text: '2. Kerentanan',
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 300, after: 120 }
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: `Berikut endpoint atau path ${meta.appName} yang rentan terhadap ${vulnerabilities.map(v => v.name).join(' dan ')}.`,
          font: 'Arial',
          size: 22
        })
      ],
      alignment: AlignmentType.JUSTIFIED,
      spacing: { after: 0, line: 360 }
    })
  );

  // Tabel Kerentanan
  const tableRows: TableRow[] = [
    new TableRow({
      tableHeader: true,
      children: [
        new TableCell({
          width: { size: 6, type: WidthType.PERCENTAGE },
          shading: { fill: '4472C4' },
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ text: 'No', bold: true, color: 'FFFFFF', font: 'Arial', size: 20 })]
            })
          ]
        }),
        new TableCell({
          width: { size: 30, type: WidthType.PERCENTAGE },
          shading: { fill: '4472C4' },
          children: [
            new Paragraph({
              alignment: AlignmentType.LEFT,
              children: [new TextRun({ text: 'Kerentanan', bold: true, color: 'FFFFFF', font: 'Arial', size: 20 })]
            })
          ]
        }),
        new TableCell({
          width: { size: 28, type: WidthType.PERCENTAGE },
          shading: { fill: '4472C4' },
          children: [
            new Paragraph({
              alignment: AlignmentType.LEFT,
              children: [new TextRun({ text: 'Path / Endpoint', bold: true, color: 'FFFFFF', font: 'Arial', size: 20 })]
            })
          ]
        }),
        new TableCell({
          width: { size: 14, type: WidthType.PERCENTAGE },
          shading: { fill: '4472C4' },
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ text: 'Risiko', bold: true, color: 'FFFFFF', font: 'Arial', size: 20 })]
            })
          ]
        }),
        new TableCell({
          width: { size: 12, type: WidthType.PERCENTAGE },
          shading: { fill: '4472C4' },
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ text: 'OWASP', bold: true, color: 'FFFFFF', font: 'Arial', size: 20 })]
            })
          ]
        }),
        new TableCell({
          width: { size: 10, type: WidthType.PERCENTAGE },
          shading: { fill: '4472C4' },
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ text: 'Status', bold: true, color: 'FFFFFF', font: 'Arial', size: 20 })]
            })
          ]
        })
      ]
    })
  ];

  vulnerabilities.forEach((v, i) => {
    const sevColor = getSeverityColor(v.severity);
    tableRows.push(
      new TableRow({
        children: [
          new TableCell({
            width: { size: 6, type: WidthType.PERCENTAGE },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ text: `${i + 1}.`, font: 'Arial', size: 20 })]
              })
            ]
          }),
          new TableCell({
            width: { size: 30, type: WidthType.PERCENTAGE },
            children: [
              new Paragraph({
                alignment: AlignmentType.LEFT,
                children: [new TextRun({ text: v.name, bold: true, font: 'Arial', size: 20 })]
              })
            ]
          }),
          new TableCell({
            width: { size: 28, type: WidthType.PERCENTAGE },
            children: [
              new Paragraph({
                alignment: AlignmentType.LEFT,
                children: [new TextRun({ text: v.path, font: 'Courier New', size: 19 })]
              })
            ]
          }),
          new TableCell({
            width: { size: 14, type: WidthType.PERCENTAGE },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ text: v.severity, bold: true, color: sevColor, font: 'Arial', size: 20 })]
              })
            ]
          }),
          new TableCell({
            width: { size: 12, type: WidthType.PERCENTAGE },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ text: v.owasp || '-', font: 'Arial', size: 19 })]
              })
            ]
          }),
          new TableCell({
            width: { size: 10, type: WidthType.PERCENTAGE },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ text: v.status, bold: true, font: 'Arial', size: 19 })]
              })
            ]
          })
        ]
      })
    );
  });

  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: tableRows
    })
  );

  // 3. PoC (Proof of Concept)
  children.push(
    new Paragraph({
      text: '3. PoC (Proof of Concept)',
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 360, after: 160 }
    })
  );

  for (let idx = 0; idx < vulnerabilities.length; idx++) {
    const v = vulnerabilities[idx];
    const subNum = `3.${idx + 1}`;
    children.push(
      new Paragraph({
        text: `${subNum} ${v.name}`,
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 240, after: 120 }
      })
    );

    // Deskripsi Teknis
    if (v.techDescription) {
      v.techDescription.split('\n\n').forEach(p => {
        if (p.trim()) {
          children.push(
            new Paragraph({
              children: [new TextRun({ text: p.trim(), font: 'Arial', size: 22 })],
              alignment: AlignmentType.JUSTIFIED,
              spacing: { after: 0, line: 360 }
            })
          );
        }
      });
    }

    // Embed Screenshot Images
    if (v.images && v.images.length > 0) {
      for (let imgIdx = 0; imgIdx < v.images.length; imgIdx++) {
        const img = v.images[imgIdx];
        try {
          const imgBytes = await resolveImageBytes(img.dataUrl);
          const isJpg = img.dataUrl.includes('jpeg') || img.dataUrl.includes('jpg');
          const imgType: 'png' | 'jpg' = isJpg ? 'jpg' : 'png';
          children.push(
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 140, after: 80 },
              children: [
                new ImageRun({
                  type: imgType,
                  data: imgBytes,
                  transformation: {
                    width: img.width || 520,
                    height: img.height || 280
                  }
                })
              ]
            }),
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { after: 160 },
              children: [
                new TextRun({
                  text: img.caption || `Gambar ${subNum}.${imgIdx + 1} Tampilan temuan PoC ${v.name}`,
                  italics: true,
                  size: 20,
                  font: 'Arial',
                  color: '475569'
                })
              ]
            })
          );
        } catch (e) {
          console.warn('Failed to embed image:', e);
        }
      }
    }

    // Narasi PoC
    if (v.pocNarrative) {
      v.pocNarrative.split('\n\n').forEach(p => {
        if (p.trim()) {
          children.push(
            new Paragraph({
              children: [new TextRun({ text: p.trim(), font: 'Arial', size: 22 })],
              alignment: AlignmentType.JUSTIFIED,
              spacing: { after: 140, line: 280 }
            })
          );
        }
      });
    }
  }

  // 4. Dampak
  children.push(
    new Paragraph({
      text: '4. Dampak',
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 300, after: 120 }
    })
  );

  const impactText =
    meta.overallImpact ||
    vulnerabilities.map(v => v.impact).filter(Boolean).join('\n\n') ||
    `Kerentanan yang teridentifikasi berpotensi membuka celah terhadap kerahasiaan (Confidentiality) dan integritas (Integrity) data pada aplikasi ${meta.appName}. Penyerang dapat memanfaatkan kelemahan ini untuk mengeksploitasi hak akses pengguna lain serta memperluas serangan ke infrastruktur internal.`;

  impactText.split('\n\n').forEach(p => {
    if (p.trim()) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: p.trim(), font: 'Arial', size: 22 })],
          alignment: AlignmentType.JUSTIFIED,
          spacing: { after: 140, line: 280 }
        })
      );
    }
  });

  // 5. Simpulan
  children.push(
    new Paragraph({
      text: '5. Simpulan',
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 300, after: 120 }
    })
  );

  const conclusionText =
    meta.conclusion ||
    `Berdasarkan hasil pengujian keamanan yang telah dilakukan terhadap aplikasi ${meta.appName} (${meta.targetUrl}), teridentifikasi kerentanan ${vulnerabilities.map(v => v.name).join(' dan ')}. Temuan ini memerlukan tindakan penutupan celah keamanan dan pembaruan konfigurasi sesuai rekomendasi yang diberikan.`;

  conclusionText.split('\n\n').forEach(p => {
    if (p.trim()) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: p.trim(), font: 'Arial', size: 22 })],
          alignment: AlignmentType.JUSTIFIED,
          spacing: { after: 140, line: 280 }
        })
      );
    }
  });

  // 6. Rekomendasi
  children.push(
    new Paragraph({
      text: '6. Rekomendasi',
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 300, after: 120 }
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: 'Berikut ini adalah beberapa saran dan rekomendasi yang dapat kami berikan.',
          font: 'Arial',
          size: 22
        })
      ],
      spacing: { after: 140 }
    })
  );

  vulnerabilities.forEach(v => {
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `Rekomendasi ${v.name}:`,
            bold: true,
            font: 'Arial',
            size: 22,
            color: '1E293B'
          })
        ],
        spacing: { before: 120, after: 80 }
      })
    );

    const recs = v.recommendations && v.recommendations.length > 0
      ? v.recommendations
      : [
          `Terapkan validasi dan kontrol akses ketat pada endpoint ${v.path}.`,
          `Lakukan audit keamanan berkala dan peninjauan kode (secure code review).`,
          `Terapkan prinsip Least Privilege untuk seluruh pengguna dan layanan sistem.`
        ];

    recs.forEach((rec, rIdx) => {
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `${rIdx + 1}. ${rec.replace(/^\d+[\.\)]\s*/, '')}`,
              font: 'Arial',
              size: 22
            })
          ],
          spacing: { after: 80, line: 260 }
        })
      );
    });
  });

  // Penutup & Tanda Tangan
  children.push(
    new Paragraph({
      spacing: { before: 400, after: 80 },
      children: [
        new TextRun({
          text: `${meta.signerRole},`,
          font: 'Arial',
          size: 22
        })
      ]
    }),
    new Paragraph({
      spacing: { before: 400, after: 400 },
      children: [
        new TextRun({
          text: meta.signaturePlaceholder || '${ttd_pengirim}',
          font: 'Arial',
          size: 20,
          color: '94A3B8'
        })
      ]
    }),
    new Paragraph({
      spacing: { after: 40 },
      children: [
        new TextRun({
          text: meta.signerName,
          bold: true,
          underline: {},
          font: 'Arial',
          size: 22
        })
      ]
    })
  );

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1440, // 1 inch = 1440 twips
              right: 1440,
              bottom: 1440,
              left: 1440
            }
          }
        },
        headers: {
          default: header
        },
        footers: {
          default: footer
        },
        children
      }
    ]
  });

  return await Packer.toBlob(doc);
}
