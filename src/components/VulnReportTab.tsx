import React, { useState, useRef } from 'react';
import {
  ShieldAlert,
  FileDown,
  Sparkles,
  Plus,
  Trash2,
  Image as ImageIcon,
  CheckCircle2,
  AlertTriangle,
  Upload,
  RefreshCw,
  Eye,
  FileText,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Shield,
  Layers,
  HelpCircle,
  Lock,
  Unlock
} from 'lucide-react';
import {
  ReportMeta,
  VulnerabilityItem,
  PoCImage,
  generateWordReport
} from '../utils/docxGenerator';
import {
  downloadOfficialDocx,
  VulnReportData
} from '../utils/templateDocxEngine';
import {
  VULN_PRESETS,
  SAMPLE_ASPAK_REPORT
} from '../utils/vulnTemplates';

interface VulnReportTabProps {
  isAdminUnlocked?: boolean;
  onLockAdmin?: () => void;
}

export default function VulnReportTab({ isAdminUnlocked = true, onLockAdmin }: VulnReportTabProps) {
  const [meta, setMeta] = useState<ReportMeta>(SAMPLE_ASPAK_REPORT.meta);

  const [vulnerabilities, setVulnerabilities] = useState<VulnerabilityItem[]>(SAMPLE_ASPAK_REPORT.vulnerabilities);

  const [activeView, setActiveView] = useState<'editor' | 'preview'>('editor');
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [expandedVulnId, setExpandedVulnId] = useState<string | null>('vuln-aspak-1');
  const [analyzingVulnIds, setAnalyzingVulnIds] = useState<Record<string, boolean>>({});

  const fileInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});

  const showNotification = (type: 'success' | 'error' | 'info', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
  };

  // Helper to render markdown bold tokens in preview
  const renderRichText = (text: string) => {
    if (!text) return null;
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, idx) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={idx} className="font-bold text-slate-950">{part.slice(2, -2)}</strong>;
      }
      return part;
    });
  };

  // Add new vulnerability
  const handleAddVulnerability = () => {
    const newId = `vuln-${Date.now()}`;
    const newItem: VulnerabilityItem = {
      id: newId,
      name: 'Insecure Direct Object Reference (IDOR)',
      path: '/api/v1/resource/1',
      severity: 'HIGH',
      owasp: 'A01:2025',
      status: 'OPEN',
      notes: '',
      images: [],
      recommendations: [
        'Pastikan bahwa setiap permintaan yang menggunakan parameter ID diverifikasi terlebih dahulu di sisi server.',
        'Terapkan kontrol akses (RBAC) agar pengguna hanya dapat mengakses data miliknya.'
      ]
    };
    setVulnerabilities(prev => [...prev, newItem]);
    setExpandedVulnId(newId);
  };

  // Remove vulnerability
  const handleRemoveVulnerability = (id: string) => {
    if (vulnerabilities.length <= 1) {
      showNotification('error', 'Minimal harus ada 1 temuan kerentanan.');
      return;
    }
    setVulnerabilities(prev => prev.filter(v => v.id !== id));
  };

  // Apply preset to vulnerability
  const handleApplyPreset = (vulnId: string, presetKey: string) => {
    const preset = VULN_PRESETS[presetKey];
    if (!preset) return;

    setVulnerabilities(prev =>
      prev.map(v => {
        if (v.id !== vulnId) return v;
        return {
          ...v,
          name: preset.name,
          path: preset.defaultPath || v.path,
          severity: preset.defaultSeverity,
          owasp: preset.owasp,
          techDescription: preset.techDescription(meta.appName, meta.targetUrl, preset.defaultPath),
          pocNarrative: preset.pocNarrative(
            meta.appName,
            meta.targetUrl,
            preset.defaultPath,
            v.images.map(img => img.caption)
          ),
          impact: preset.impact(meta.appName),
          recommendations: [...preset.recommendations]
        };
      })
    );
  };

  // Handle uploading PoC image for a vulnerability
  const handleImageUpload = (vulnId: string, files: FileList | null) => {
    if (!files || files.length === 0) return;

    const currentVulnIndex = vulnerabilities.findIndex(v => v.id === vulnId);
    const subNum = `3.${currentVulnIndex + 1}`;

    Array.from(files).forEach((file, fIdx) => {
      const reader = new FileReader();
      reader.onload = e => {
        const dataUrl = e.target?.result as string;
        if (!dataUrl) return;

        setVulnerabilities(prev =>
          prev.map(v => {
            if (v.id !== vulnId) return v;
            const newImgIndex = v.images.length + fIdx + 1;
            const newImage: PoCImage = {
              id: `img-${Date.now()}-${fIdx}`,
              dataUrl,
              caption: `Gambar ${subNum}.${newImgIndex} Tampilan pengujian temuan ${v.name}`
            };
            return {
              ...v,
              images: [...v.images, newImage]
            };
          })
        );
      };
      reader.readAsDataURL(file);
    });
  };

  // Remove single image
  const handleRemoveImage = (vulnId: string, imgId: string) => {
    setVulnerabilities(prev =>
      prev.map(v => {
        if (v.id !== vulnId) return v;
        return {
          ...v,
          images: v.images.filter(img => img.id !== imgId)
        };
      })
    );
  };

  // Update caption
  const handleUpdateCaption = (vulnId: string, imgId: string, caption: string) => {
    setVulnerabilities(prev =>
      prev.map(v => {
        if (v.id !== vulnId) return v;
        return {
          ...v,
          images: v.images.map(img => (img.id === imgId ? { ...img, caption } : img))
        };
      })
    );
  };

  // Load sample Aspak document (Official Kemenkes CSIRT template document)
  const handleLoadSampleAspak = () => {
    setMeta({
      ...SAMPLE_ASPAK_REPORT.meta
    });
    setVulnerabilities(SAMPLE_ASPAK_REPORT.vulnerabilities);
    setExpandedVulnId('vuln-aspak-1');
    showNotification('success', 'Contoh dokumen resmi Aspak (Directory Listing) berhasil dimuat!');
  };

  // Reset form to blank
  const handleResetEmpty = () => {
    const emptyId = `vuln-${Date.now()}`;
    setMeta({
      docNumber: '',
      docTitle: '',
      appName: '',
      targetUrl: '',
      reportDate: new Date().toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      }),
      tlp: 'TLP : AMBER',
      instansi: 'Tim Tanggap Insiden Siber (CSIRT) dan Pelindungan Data Pribadi (PDP) - Kementerian Kesehatan',
      signerRole: 'Ketua Tim Kerja Penyelenggaraan Layanan Tim Tanggap Insiden Siber (CSIRT) dan Pelindungan Data Pribadi (PDP),',
      signerName: 'Istiqomah, SS, MKM',
      signaturePlaceholder: '${ttd_pengirim}',
      executiveSummary: '',
      overallImpact: '',
      conclusion: ''
    });
    setVulnerabilities([
      {
        id: emptyId,
        name: '',
        path: '/',
        severity: 'MEDIUM',
        owasp: 'A01:2025',
        status: 'OPEN',
        notes: '',
        images: [],
        techDescription: '',
        pocNarrative: '',
        impact: '',
        recommendations: []
      }
    ]);
    setExpandedVulnId(emptyId);
    showNotification('info', 'Formulir telah direset.');
  };

  // Generate narrative using Gemini AI
  const handleGenerateAI = async () => {
    setIsGeneratingAI(true);
    showNotification('info', 'Sedang menyusun narasi resmi CSIRT dengan AI...');

    try {
      const payload = {
        appName: meta.appName,
        targetUrl: meta.targetUrl,
        docNumber: meta.docNumber,
        date: meta.reportDate,
        tlp: meta.tlp,
        instansi: meta.instansi,
        vulnerabilities: vulnerabilities.map(v => ({
          name: v.name,
          path: v.path,
          severity: v.severity,
          owasp: v.owasp,
          status: v.status,
          notes: v.notes,
          images: v.images.map(img => ({
            id: img.id,
            dataUrl: img.dataUrl,
            caption: img.caption
          })),
          imageCaptions: v.images.map(img => img.caption)
        }))
      };

      const res = await fetch('/api/generate-vuln-narrative', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const json = await res.json().catch(() => ({}));

      if (json.success && json.data) {
        const data = json.data;
        // Update executive summary, overall impact, and conclusion
        setMeta(prev => ({
          ...prev,
          executiveSummary: data.executiveSummary || prev.executiveSummary,
          overallImpact: data.overallImpact || prev.overallImpact,
          conclusion: data.conclusion || prev.conclusion
        }));

        // Update each vulnerability's technical details and image captions if available
        if (Array.isArray(data.vulnDetails)) {
          setVulnerabilities(prev =>
            prev.map((v, idx) => {
              const aiDetail = data.vulnDetails[idx] || data.vulnDetails.find((d: any) => d.name?.toLowerCase().includes(v.name.toLowerCase()));
              if (!aiDetail) return v;
              return {
                ...v,
                techDescription: aiDetail.techDescription || v.techDescription,
                pocNarrative: aiDetail.pocNarrative || v.pocNarrative,
                impact: aiDetail.impact || v.impact,
                recommendations: aiDetail.recommendations && aiDetail.recommendations.length > 0
                  ? aiDetail.recommendations
                  : v.recommendations,
                images: Array.isArray(aiDetail.imageCaptions) && aiDetail.imageCaptions.length > 0
                  ? v.images.map((img, imgI) => ({
                      ...img,
                      caption: aiDetail.imageCaptions[imgI] || img.caption
                    }))
                  : v.images
              };
            })
          );
        }

        if (json.fallback) {
          showNotification('info', '✨ Narasi standar resmi CSIRT Kemenkes berhasil dimuat.');
        } else {
          showNotification('success', '✨ Narasi laporan detail berhasil dibuat oleh Gemini AI!');
        }
      } else {
        // Fallback: Use local curated templates
        applyLocalNarrativesFallback();
        showNotification('info', 'Menggunakan narasi standar resmi CSIRT Kemenkes (mode offline).');
      }
    } catch (e: any) {
      console.warn('AI narrative generation error:', e);
      applyLocalNarrativesFallback();
      showNotification('info', 'Menggunakan narasi standar resmi CSIRT Kemenkes (mode offline).');
    } finally {
      setIsGeneratingAI(false);
    }
  };

  // Dedicated generator: Analyze images with AI to build detailed PoC narrative for a specific vulnerability
  const handleGeneratePoCFromImages = async (vulnId: string) => {
    const vuln = vulnerabilities.find(v => v.id === vulnId);
    if (!vuln || vuln.images.length === 0) {
      showNotification('info', 'Silakan unggah minimal 1 tangkapan layar PoC terlebih dahulu untuk dianalisis oleh AI.');
      return;
    }
    const vulnIndex = vulnerabilities.findIndex(v => v.id === vulnId);
    const subNum = `3.${vulnIndex + 1}`;

    setAnalyzingVulnIds(prev => ({ ...prev, [vulnId]: true }));
    showNotification('info', `🤖 Gemini AI sedang membaca elemen screenshot dan membuat narasi detail untuk ${vuln.name || 'temuan'}...`);

    try {
      const payload = {
        appName: meta.appName,
        targetUrl: meta.targetUrl,
        name: vuln.name,
        path: vuln.path,
        severity: vuln.severity,
        owasp: vuln.owasp,
        notes: vuln.notes,
        subNum,
        images: vuln.images.map(img => ({
          dataUrl: img.dataUrl,
          caption: img.caption
        }))
      };

      const res = await fetch('/api/generate-poc-from-images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const json = await res.json().catch(() => ({}));
      if (json.success && json.data) {
        const { pocNarrative, imageCaptions, techDescription, impact } = json.data;
        setVulnerabilities(prev =>
          prev.map(v => {
            if (v.id !== vulnId) return v;
            return {
              ...v,
              pocNarrative: pocNarrative || v.pocNarrative,
              techDescription: v.techDescription ? v.techDescription : (techDescription || v.techDescription),
              impact: v.impact ? v.impact : (impact || v.impact),
              images: Array.isArray(imageCaptions) && imageCaptions.length > 0
                ? v.images.map((img, idx) => ({
                    ...img,
                    caption: imageCaptions[idx] || img.caption
                  }))
                : v.images
            };
          })
        );
        if (json.fallback) {
          showNotification('info', `✨ Narasi standar resmi CSIRT Kemenkes dimuat untuk ${vuln.name || 'temuan'}.`);
        } else {
          showNotification('success', `✨ AI berhasil menyusun deskripsi detail dari gambar screenshot untuk ${vuln.name || 'temuan'}!`);
        }
      } else {
        showNotification('error', 'Gagal menghasilkan narasi dari gambar.');
      }
    } catch (err: any) {
      showNotification('error', `Gagal menganalisis gambar: ${err.message || 'Koneksi terganggu'}`);
    } finally {
      setAnalyzingVulnIds(prev => ({ ...prev, [vulnId]: false }));
    }
  };

  // Local fallback using VULN_PRESETS
  const applyLocalNarrativesFallback = () => {
    const vulnNames = vulnerabilities.map(v => v.name).join(' dan ');
    const cleanTargetUrl = (meta.targetUrl || 'target.kemkes.go.id').replace(/[\(\)]/g, '').trim();
    setMeta(prev => ({
      ...prev,
      executiveSummary:
        prev.executiveSummary ||
        `Terdeteksi adanya beberapa potensi kerentanan yaitu **${vulnNames}** pada aplikasi ${prev.appName} (**${cleanTargetUrl}**). Temuan ini teridentifikasi selama pengujian keamanan sistem dan memerlukan penanganan serta mitigasi segera guna mencegah potensi kompromi akun, eskalasi serangan, atau pengungkapan data secara tidak sah.`,
      overallImpact:
        prev.overallImpact ||
        `Kerentanan yang teridentifikasi berpotensi membuka celah terhadap kerahasiaan (Confidentiality) dan integritas (Integrity) data pada aplikasi ${prev.appName}. Penggunaan konfigurasi keamanan yang tidak memadai dapat dimanfaatkan oleh pihak yang tidak berwenang untuk memperoleh akses tidak sah serta merusak reputasi layanan.`,
      conclusion:
        prev.conclusion ||
        `Berdasarkan hasil pengujian keamanan yang telah dilakukan terhadap aplikasi ${prev.appName} (**${cleanTargetUrl}**), teridentifikasi kerentanan **${vulnNames}**. Disarankan untuk segera menerapkan langkah-langkah mitigasi dan perbaikan teknis sesuai rekomendasi yang tercantum pada laporan ini.`
    }));

    setVulnerabilities(prev =>
      prev.map(v => {
        // Find matching preset
        const matchKey = Object.keys(VULN_PRESETS).find(k => k.toLowerCase().includes(v.name.toLowerCase()));
        const preset = matchKey ? VULN_PRESETS[matchKey] : null;

        return {
          ...v,
          techDescription:
            v.techDescription ||
            (preset
              ? preset.techDescription(meta.appName, meta.targetUrl, v.path)
              : `Kerentanan ${v.name} pada endpoint ${v.path} memungkinkan penyerang mengeksploitasi kelemahan mekanisme keamanan pada aplikasi ${meta.targetUrl}.`),
          pocNarrative:
            v.pocNarrative ||
            (preset
              ? preset.pocNarrative(meta.appName, meta.targetUrl, v.path, v.images.map(img => img.caption))
              : `Pengujian pada endpoint ${v.path} menunjukkan bahwa sistem belum menerapkan validasi dan mekanisme keamanan yang memadai.`),
          impact:
            v.impact ||
            (preset
              ? preset.impact(meta.appName)
              : `Dapat mengakibatkan akses tidak sah dan manipulasi data pada aplikasi ${meta.appName}.`),
          recommendations:
            v.recommendations && v.recommendations.length > 0
              ? v.recommendations
              : (preset ? preset.recommendations : ['Terapkan validasi input dan otorisasi ketat di sisi server.'])
        };
      })
    );
  };

  // Download Word (.docx) file using the official Google Drive template
  const handleDownloadDocx = async () => {
    setIsDownloading(true);
    try {
      // Ensure narratives are populated
      if (!meta.executiveSummary) {
        applyLocalNarrativesFallback();
      }

      const reportPayload: VulnReportData = {
        appName: meta.appName,
        targetUrl: meta.targetUrl,
        docNumber: meta.docNumber,
        date: meta.reportDate,
        tlp: meta.tlp,
        instansi: meta.instansi,
        signerName: meta.signerName,
        signerPosition: meta.signerRole,
        executiveSummary: meta.executiveSummary,
        overallImpact: meta.overallImpact,
        conclusion: meta.conclusion,
        vulnerabilities: vulnerabilities.map(v => ({
          id: v.id,
          name: v.name,
          path: v.path,
          severity: v.severity,
          owasp: v.owasp,
          status: v.status,
          techDescription: v.techDescription,
          pocNarrative: v.pocNarrative,
          impact: v.impact,
          recommendations: v.recommendations,
          images: (v.images || []).map(img => ({
            id: img.id,
            dataUrl: img.dataUrl,
            caption: img.caption,
            width: img.width,
            height: img.height
          }))
        }))
      };

      await downloadOfficialDocx(reportPayload);
      showNotification('success', 'Dokumen Word (.docx) resmi berbasis template Google Drive CSIRT Kemenkes berhasil diunduh!');
    } catch (e: any) {
      console.error('Error downloading docx:', e);
      // Fallback to legacy generator if template download fails
      try {
        const blob = await generateWordReport(meta, vulnerabilities);
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        const cleanFileName = (meta.docTitle || `${meta.docNumber} Notifikasi Report - ${meta.appName}`).trim();
        link.download = `${cleanFileName}.docx`;
        link.click();
        URL.revokeObjectURL(url);
        showNotification('info', `Dokumen Word berhasil diunduh (mode generator cadangan).`);
      } catch (fallbackErr: any) {
        showNotification('error', `Gagal membuat dokumen Word: ${e.message}`);
      }
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 text-slate-100">
      {/* Top Banner / Actions */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-rose-500/10 border border-rose-500/20 rounded-lg text-rose-400">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg font-bold text-white">Notifikasi Kerentanan (Word .docx Report)</h1>
              <span className="px-2 py-0.5 text-[11px] font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-full">
                CSIRT Standard
              </span>
              <span className="px-2 py-0.5 text-[11px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full flex items-center gap-1">
                <Unlock className="w-3 h-3 text-emerald-400" />
                Admin Unlocked
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Buat dokumen resmi notifikasi kerentanan berformat Microsoft Word (.docx) lengkap dengan PoC screenshot, tabel risiko, dan narasi AI.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          {onLockAdmin && (
            <button
              onClick={onLockAdmin}
              type="button"
              className="px-3 py-2 text-xs font-semibold bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 rounded-lg border border-amber-500/30 transition flex items-center gap-1.5 shadow-sm"
              title="Kunci kembali menu ini untuk keamanan"
            >
              <Lock className="w-3.5 h-3.5 text-amber-400" />
              Kunci Akses Admin
            </button>
          )}

          <button
            onClick={handleLoadSampleAspak}
            type="button"
            className="px-3 py-2 text-xs font-semibold bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-200 rounded-lg border border-indigo-500/40 transition flex items-center gap-1.5 shadow-sm"
            title="Muat contoh resmi Dokumen Notifikasi Report Aplikasi Aspak (62A.NR.102026)"
          >
            <Shield className="w-3.5 h-3.5 text-indigo-400" />
            Contoh: Aplikasi Aspak (Resmi)
          </button>

          <button
            onClick={handleResetEmpty}
            type="button"
            className="px-2.5 py-2 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition flex items-center gap-1.5 shadow-sm"
            title="Kosongkan form untuk mengisi data dari awal"
          >
            <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
            Reset
          </button>

          <button
            onClick={handleGenerateAI}
            disabled={isGeneratingAI}
            type="button"
            className="px-3.5 py-2 text-xs font-medium bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-lg transition flex items-center gap-2 shadow-md shadow-indigo-950/40 disabled:opacity-50"
          >
            <Sparkles className={`w-3.5 h-3.5 ${isGeneratingAI ? 'animate-spin' : ''}`} />
            {isGeneratingAI ? 'Menyusun Narasi AI...' : 'Generate Narasi AI'}
          </button>

          <button
            onClick={handleDownloadDocx}
            disabled={isDownloading}
            type="button"
            className="px-4 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition flex items-center gap-2 shadow-md shadow-emerald-950/40 disabled:opacity-50"
          >
            <FileDown className={`w-4 h-4 ${isDownloading ? 'animate-bounce' : ''}`} />
            {isDownloading ? 'Memproses Word...' : 'Unduh Dokumen Word (.docx)'}
          </button>
        </div>
      </div>

      {/* Notification toast */}
      {notification && (
        <div
          className={`p-3.5 rounded-lg text-xs font-medium flex items-center gap-2 shadow-md border ${
            notification.type === 'success'
              ? 'bg-emerald-950/80 border-emerald-800/80 text-emerald-200'
              : notification.type === 'error'
              ? 'bg-rose-950/80 border-rose-800/80 text-rose-200'
              : 'bg-indigo-950/80 border-indigo-800/80 text-indigo-200'
          }`}
        >
          {notification.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
          {notification.type === 'error' && <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />}
          {notification.type === 'info' && <Sparkles className="w-4 h-4 text-indigo-400 shrink-0" />}
          <span>{notification.message}</span>
        </div>
      )}

      {/* View Switcher: Editor vs Visual Preview */}
      <div className="flex border-b border-slate-800 pb-2 gap-4">
        <button
          onClick={() => setActiveView('editor')}
          className={`pb-2 text-xs font-semibold border-b-2 transition flex items-center gap-2 ${
            activeView === 'editor'
              ? 'border-indigo-500 text-indigo-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Layers className="w-4 h-4" />
          Form Editor & Upload PoC ({vulnerabilities.length} Kerentanan)
        </button>

        <button
          onClick={() => setActiveView('preview')}
          className={`pb-2 text-xs font-semibold border-b-2 transition flex items-center gap-2 ${
            activeView === 'preview'
              ? 'border-indigo-500 text-indigo-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Eye className="w-4 h-4" />
          Preview Dokumen Word
        </button>
      </div>

      {activeView === 'editor' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Metadata & Global Settings */}
          <div className="lg:col-span-1 flex flex-col gap-5">
            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 shadow-sm">
              <h2 className="text-sm font-bold text-white mb-4 flex items-center gap-2 border-b border-slate-800 pb-2">
                <FileText className="w-4 h-4 text-indigo-400" />
                Informasi Dokumen & Sasaran
              </h2>

              <div className="space-y-3.5 text-xs">
                <div>
                  <label className="block text-slate-400 font-medium mb-1">
                    Judul Dokumen (Nama File & Header):
                  </label>
                  <input
                    type="text"
                    value={meta.docTitle}
                    onChange={e => setMeta({ ...meta, docTitle: e.target.value })}
                    placeholder="Contoh: 56. Notifikasi Report - Aplikasi SIDMK"
                    className="w-full bg-slate-950 border border-slate-800 rounded-md px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500"
                  />
                  <span className="text-[10px] text-slate-500 mt-0.5 block">
                    Diambil dari nama aplikasi (misal: 56. Notifikasi Report - Aplikasi SIDMK)
                  </span>
                </div>

                <div>
                  <label className="block text-slate-400 font-medium mb-1">
                    Nama Aplikasi:
                  </label>
                  <input
                    type="text"
                    value={meta.appName}
                    onChange={e => {
                      const newApp = e.target.value;
                      setMeta({
                        ...meta,
                        appName: newApp,
                        docTitle: meta.docTitle.includes('Notifikasi Report')
                          ? `${meta.docNumber.split('.')[0] || '56'}. Notifikasi Report - ${newApp}`
                          : meta.docTitle
                      });
                    }}
                    placeholder="Contoh: Aplikasi SIHEPI / Aplikasi SIDMK"
                    className="w-full bg-slate-950 border border-slate-800 rounded-md px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500 font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-medium mb-1">
                    Target URL / Hostname:
                  </label>
                  <input
                    type="text"
                    value={meta.targetUrl}
                    onChange={e => setMeta({ ...meta, targetUrl: e.target.value })}
                    placeholder="Contoh: sihepi.kemkes.go.id"
                    className="w-full bg-slate-950 border border-slate-800 rounded-md px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500 font-mono text-[11px]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-slate-400 font-medium mb-1">
                      No. Dokumen / Surat:
                    </label>
                    <input
                      type="text"
                      value={meta.docNumber}
                      onChange={e => setMeta({ ...meta, docNumber: e.target.value })}
                      placeholder="58A.NR.092026"
                      className="w-full bg-slate-950 border border-slate-800 rounded-md px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 font-medium mb-1">
                      Tanggal Laporan:
                    </label>
                    <input
                      type="text"
                      value={meta.reportDate}
                      onChange={e => setMeta({ ...meta, reportDate: e.target.value })}
                      placeholder="21 September 2026"
                      className="w-full bg-slate-950 border border-slate-800 rounded-md px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-400 font-medium mb-1">
                    Klasifikasi TLP:
                  </label>
                  <select
                    value={meta.tlp}
                    onChange={e => setMeta({ ...meta, tlp: e.target.value as any })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-md px-3 py-2 text-amber-400 font-bold focus:outline-none focus:border-indigo-500"
                  >
                    <option value="TLP : AMBER">TLP : AMBER (Terbatas)</option>
                    <option value="TLP : RED">TLP : RED (Sangat Rahasia)</option>
                    <option value="TLP : GREEN">TLP : GREEN (Komunitas)</option>
                    <option value="TLP : WHITE">TLP : WHITE (Publik)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 font-medium mb-1">
                    Instansi / Tim Kerja:
                  </label>
                  <input
                    type="text"
                    value={meta.instansi}
                    onChange={e => setMeta({ ...meta, instansi: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-md px-3 py-2 text-slate-300 focus:outline-none focus:border-indigo-500 text-[11px]"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-medium mb-1">
                    Nama Penandatangan (Ketua Tim):
                  </label>
                  <input
                    type="text"
                    value={meta.signerName}
                    onChange={e => setMeta({ ...meta, signerName: e.target.value })}
                    placeholder="Istiqomah, SS, MKM"
                    className="w-full bg-slate-950 border border-slate-800 rounded-md px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500 font-medium"
                  />
                </div>
              </div>
            </div>

            {/* Global Executive Summary & Conclusion Review */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
              <h2 className="text-sm font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-2">
                <Sparkles className="w-4 h-4 text-purple-400" />
                Ringkasan Eksekutif & Simpulan
              </h2>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-400 font-medium mb-1">
                    1. Ringkasan Eksekutif:
                  </label>
                  <textarea
                    rows={4}
                    value={meta.executiveSummary}
                    onChange={e => setMeta({ ...meta, executiveSummary: e.target.value })}
                    placeholder="Klik 'Generate Narasi dengan AI' untuk mengisi otomatis, atau ketik ringkasan di sini..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-md p-2.5 text-slate-300 focus:outline-none focus:border-indigo-500 text-xs leading-relaxed"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-medium mb-1">
                    5. Simpulan:
                  </label>
                  <textarea
                    rows={3}
                    value={meta.conclusion}
                    onChange={e => setMeta({ ...meta, conclusion: e.target.value })}
                    placeholder="Kesimpulan hasil pengujian keamanan..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-md p-2.5 text-slate-300 focus:outline-none focus:border-indigo-500 text-xs leading-relaxed"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Right Columns: Vulnerabilities & PoC Screenshots */}
          <div className="lg:col-span-2 flex flex-col gap-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Shield className="w-5 h-5 text-rose-400" />
                  Daftar Temuan Kerentanan ({vulnerabilities.length})
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Tambahkan kerentanan, upload screenshot PoC, dan kelola narasi per temuan.
                </p>
              </div>

              <button
                onClick={handleAddVulnerability}
                type="button"
                className="px-3.5 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition flex items-center gap-1.5 shadow"
              >
                <Plus className="w-3.5 h-3.5" />
                Tambah Kerentanan
              </button>
            </div>

            {/* Vulnerability Items List */}
            <div className="space-y-4">
              {vulnerabilities.map((vuln, vIdx) => {
                const isExpanded = expandedVulnId === vuln.id;
                const subNum = `3.${vIdx + 1}`;

                return (
                  <div
                    key={vuln.id}
                    className="bg-slate-900/90 border border-slate-800 rounded-xl overflow-hidden shadow-sm transition"
                  >
                    {/* Item Header */}
                    <div
                      onClick={() => setExpandedVulnId(isExpanded ? null : vuln.id)}
                      className="p-4 bg-slate-900 hover:bg-slate-850 cursor-pointer flex items-center justify-between gap-3 border-b border-slate-800/80"
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-6 h-6 rounded-full bg-slate-800 border border-slate-700 text-indigo-400 text-xs font-bold flex items-center justify-center">
                          {vIdx + 1}
                        </span>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-white">{vuln.name}</span>
                            <span
                              className={`px-2 py-0.5 text-[10px] font-bold rounded ${
                                vuln.severity === 'CRITICAL'
                                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                  : vuln.severity === 'HIGH'
                                  ? 'bg-orange-500/20 text-orange-300 border border-orange-500/30'
                                  : vuln.severity === 'MEDIUM'
                                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                  : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                              }`}
                            >
                              {vuln.severity}
                            </span>
                            <span className="text-[11px] font-mono text-slate-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                              {vuln.path}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            OWASP: {vuln.owasp} • {vuln.images.length} Screenshot PoC
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => handleRemoveVulnerability(vuln.id)}
                          type="button"
                          className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded transition"
                          title="Hapus kerentanan ini"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setExpandedVulnId(isExpanded ? null : vuln.id)}
                          type="button"
                          className="p-1.5 text-slate-400 hover:text-white rounded"
                        >
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    {/* Item Body (Expanded) */}
                    {isExpanded && (
                      <div className="p-5 space-y-5 bg-slate-950/40">
                        {/* Quick Presets Dropdown */}
                        <div className="bg-indigo-950/30 border border-indigo-900/40 rounded-lg p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
                          <div className="flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-indigo-400" />
                            <span className="text-xs font-semibold text-indigo-200">
                              Pilih Template Cepat Kerentanan:
                            </span>
                          </div>
                          <select
                            onChange={e => {
                              if (e.target.value) handleApplyPreset(vuln.id, e.target.value);
                            }}
                            defaultValue=""
                            className="bg-slate-900 border border-indigo-800/60 rounded px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-400 w-full sm:w-auto"
                          >
                            <option value="" disabled>-- Pilih Kerentanan Umum --</option>
                            {Object.keys(VULN_PRESETS).map(key => (
                              <option key={key} value={key}>
                                {key}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Basic Attributes Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                          <div className="sm:col-span-2">
                            <label className="block text-slate-400 font-medium mb-1">
                              Nama Kerentanan:
                            </label>
                            <input
                              type="text"
                              value={vuln.name}
                              onChange={e => {
                                const newName = e.target.value;
                                setVulnerabilities(prev =>
                                  prev.map(v => (v.id === vuln.id ? { ...v, name: newName } : v))
                                );
                              }}
                              className="w-full bg-slate-950 border border-slate-800 rounded-md px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500 font-semibold"
                            />
                          </div>

                          <div className="sm:col-span-2">
                            <label className="block text-slate-400 font-medium mb-1">
                              Path / Endpoint Rentan:
                            </label>
                            <input
                              type="text"
                              value={vuln.path}
                              onChange={e => {
                                const newPath = e.target.value;
                                setVulnerabilities(prev =>
                                  prev.map(v => (v.id === vuln.id ? { ...v, path: newPath } : v))
                                );
                              }}
                              placeholder="Contoh: /new_pasiens/edit/* atau /"
                              className="w-full bg-slate-950 border border-slate-800 rounded-md px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500 font-mono text-[11px]"
                            />
                          </div>

                          <div>
                            <label className="block text-slate-400 font-medium mb-1">
                              Risiko / Severity:
                            </label>
                            <select
                              value={vuln.severity}
                              onChange={e => {
                                const newSev = e.target.value as any;
                                setVulnerabilities(prev =>
                                  prev.map(v => (v.id === vuln.id ? { ...v, severity: newSev } : v))
                                );
                              }}
                              className="w-full bg-slate-950 border border-slate-800 rounded-md px-2.5 py-2 text-slate-200 focus:outline-none focus:border-indigo-500 font-bold"
                            >
                              <option value="CRITICAL">CRITICAL</option>
                              <option value="HIGH">HIGH</option>
                              <option value="MEDIUM">MEDIUM</option>
                              <option value="LOW">LOW</option>
                              <option value="INFO">INFO</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-slate-400 font-medium mb-1">
                              Kategori OWASP:
                            </label>
                            <input
                              type="text"
                              value={vuln.owasp}
                              onChange={e => {
                                const newOwasp = e.target.value;
                                setVulnerabilities(prev =>
                                  prev.map(v => (v.id === vuln.id ? { ...v, owasp: newOwasp } : v))
                                );
                              }}
                              placeholder="A01:2025"
                              className="w-full bg-slate-950 border border-slate-800 rounded-md px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500"
                            />
                          </div>

                          <div>
                            <label className="block text-slate-400 font-medium mb-1">
                              Status Temuan:
                            </label>
                            <select
                              value={vuln.status}
                              onChange={e => {
                                const newStat = e.target.value as any;
                                setVulnerabilities(prev =>
                                  prev.map(v => (v.id === vuln.id ? { ...v, status: newStat } : v))
                                );
                              }}
                              className="w-full bg-slate-950 border border-slate-800 rounded-md px-2.5 py-2 text-slate-200 focus:outline-none focus:border-indigo-500 font-medium"
                            >
                              <option value="OPEN">OPEN</option>
                              <option value="IN_PROGRESS">IN PROGRESS</option>
                              <option value="RESOLVED">RESOLVED</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-slate-400 font-medium mb-1">
                              Catatan Penguji (Opsional):
                            </label>
                            <input
                              type="text"
                              value={vuln.notes || ''}
                              onChange={e => {
                                const newNotes = e.target.value;
                                setVulnerabilities(prev =>
                                  prev.map(v => (v.id === vuln.id ? { ...v, notes: newNotes } : v))
                                );
                              }}
                              placeholder="Misal: Ditemukan saat pengujian autentikasi"
                              className="w-full bg-slate-950 border border-slate-800 rounded-md px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500"
                            />
                          </div>
                        </div>

                        {/* PoC Screenshot Upload Section */}
                        <div className="border-t border-slate-800/80 pt-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                              <ImageIcon className="w-4 h-4 text-emerald-400" />
                              Upload Screenshot PoC ({vuln.images.length} Gambar)
                            </label>

                            <input
                              type="file"
                              accept="image/*"
                              multiple
                              ref={el => (fileInputRefs.current[vuln.id] = el)}
                              className="hidden"
                              onChange={e => handleImageUpload(vuln.id, e.target.files)}
                            />

                            <div className="flex items-center gap-2">
                              {vuln.images.length > 0 && (
                                <button
                                  type="button"
                                  onClick={() => handleGeneratePoCFromImages(vuln.id)}
                                  disabled={analyzingVulnIds[vuln.id]}
                                  className="px-3 py-1.5 text-xs font-semibold bg-purple-600/25 hover:bg-purple-600/40 text-purple-200 border border-purple-500/40 rounded-md transition flex items-center gap-1.5 disabled:opacity-50 shadow-sm"
                                  title="AI otomatis menganalisis gambar screenshot dan menyusun deskripsi detail PoC"
                                >
                                  <Sparkles className={`w-3.5 h-3.5 ${analyzingVulnIds[vuln.id] ? 'animate-spin text-purple-300' : 'text-purple-400'}`} />
                                  {analyzingVulnIds[vuln.id] ? 'AI Menganalisis Gambar...' : '✨ AI Generate Deskripsi dari Gambar'}
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => fileInputRefs.current[vuln.id]?.click()}
                                className="px-3 py-1.5 text-xs font-semibold bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 rounded-md transition flex items-center gap-1.5"
                              >
                                <Upload className="w-3.5 h-3.5" />
                                + Upload Screenshot PoC
                              </button>
                            </div>
                          </div>

                          {/* Images Grid */}
                          {vuln.images.length === 0 ? (
                            <div
                              onClick={() => fileInputRefs.current[vuln.id]?.click()}
                              className="border-2 border-dashed border-slate-800 hover:border-slate-700 bg-slate-950/40 rounded-lg p-6 text-center cursor-pointer transition flex flex-col items-center justify-center gap-2"
                            >
                              <Upload className="w-6 h-6 text-slate-500" />
                              <p className="text-xs text-slate-400 font-medium">
                                Klik atau seret tangkapan layar PoC (PNG/JPG) ke sini
                              </p>
                              <span className="text-[10px] text-slate-600">
                                Gambar akan disematkan secara rapi ke dalam dokumen Word dan AI dapat langsung menganalisis detail gambar secara otomatis.
                              </span>
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              {vuln.images.map((img, imgIdx) => (
                                <div
                                  key={img.id}
                                  className="bg-slate-900 border border-slate-800 rounded-lg p-3 flex flex-col gap-2 relative group shadow"
                                >
                                  <div className="relative rounded overflow-hidden bg-black/40 h-40 flex items-center justify-center border border-slate-800">
                                    <img
                                      src={img.dataUrl}
                                      alt={img.caption}
                                      className="max-h-full max-w-full object-contain"
                                    />
                                    <button
                                      onClick={() => handleRemoveImage(vuln.id, img.id)}
                                      type="button"
                                      className="absolute top-2 right-2 p-1.5 bg-rose-600/80 hover:bg-rose-600 text-white rounded shadow transition"
                                      title="Hapus gambar ini"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>

                                  <div className="flex flex-col gap-1">
                                    <div className="flex items-center justify-between">
                                      <label className="text-[10px] text-slate-400 font-medium">
                                        Caption Gambar (muncul di bawah gambar Word):
                                      </label>
                                      <button
                                        type="button"
                                        onClick={() => handleGeneratePoCFromImages(vuln.id)}
                                        disabled={analyzingVulnIds[vuln.id]}
                                        className="text-[10px] font-semibold text-purple-400 hover:text-purple-300 flex items-center gap-1 transition"
                                        title="AI menganalisis detail gambar ini"
                                      >
                                        <Sparkles className="w-2.5 h-2.5" />
                                        AI Analisis Gambar
                                      </button>
                                    </div>
                                    <input
                                      type="text"
                                      value={img.caption}
                                      onChange={e => handleUpdateCaption(vuln.id, img.id, e.target.value)}
                                      placeholder={`Gambar ${subNum}.${imgIdx + 1} Keterangan temuan...`}
                                      className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-[11px] text-slate-300 focus:outline-none focus:border-indigo-500"
                                    />
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Narratives for this Vulnerability */}
                        <div className="border-t border-slate-800/80 pt-4 space-y-4">
                          <h3 className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                            <FileText className="w-4 h-4 text-purple-400" />
                            Narasi Detail Temuan & PoC ({vuln.name})
                          </h3>

                          <div className="space-y-3 text-xs">
                            <div>
                              <label className="block text-slate-400 font-medium mb-1">
                                Ulasan Teknis Kerentanan:
                              </label>
                              <textarea
                                rows={3}
                                value={vuln.techDescription || ''}
                                onChange={e => {
                                  const text = e.target.value;
                                  setVulnerabilities(prev =>
                                    prev.map(v => (v.id === vuln.id ? { ...v, techDescription: text } : v))
                                  );
                                }}
                                placeholder="Penjelasan teknis mekanisme kerentanan..."
                                className="w-full bg-slate-950 border border-slate-800 rounded-md p-2.5 text-slate-300 focus:outline-none focus:border-indigo-500 text-xs leading-relaxed"
                              />
                            </div>

                            <div>
                              <div className="flex items-center justify-between mb-1.5">
                                <label className="block text-slate-400 font-medium">
                                  Narasi Langkah Pengujian (PoC Narrative):
                                </label>
                                {vuln.images.length > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => handleGeneratePoCFromImages(vuln.id)}
                                    disabled={analyzingVulnIds[vuln.id]}
                                    className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold bg-purple-600/30 hover:bg-purple-600/50 text-purple-200 border border-purple-500/40 rounded transition disabled:opacity-50"
                                  >
                                    <Sparkles className={`w-3 h-3 ${analyzingVulnIds[vuln.id] ? 'animate-spin' : 'text-purple-400'}`} />
                                    {analyzingVulnIds[vuln.id] ? 'AI Menganalisis...' : '✨ AI Generate Deskripsi dari Gambar'}
                                  </button>
                                )}
                              </div>
                              <textarea
                                rows={5}
                                value={vuln.pocNarrative || ''}
                                onChange={e => {
                                  const text = e.target.value;
                                  setVulnerabilities(prev =>
                                    prev.map(v => (v.id === vuln.id ? { ...v, pocNarrative: text } : v))
                                  );
                                }}
                                placeholder="Jelaskan alur pengujian detail yang merujuk pada Gambar 3.x.y di atas..."
                                className="w-full bg-slate-950 border border-slate-800 rounded-md p-2.5 text-slate-300 focus:outline-none focus:border-indigo-500 text-xs leading-relaxed"
                              />
                              <p className="text-[10px] text-slate-500 mt-1">
                                💡 Format detail resmi CSIRT: AI membaca langsung bukti di gambar (URL, kolom form, nama berkas internal/Index of, tombol, respon) dan menyusun narasi pengujian secara mendalam.
                              </p>
                            </div>

                            <div>
                              <label className="block text-slate-400 font-medium mb-1">
                                Dampak Temuan Kerentanan Ini:
                              </label>
                              <textarea
                                rows={2}
                                value={vuln.impact || ''}
                                onChange={e => {
                                  const text = e.target.value;
                                  setVulnerabilities(prev =>
                                    prev.map(v => (v.id === vuln.id ? { ...v, impact: text } : v))
                                  );
                                }}
                                placeholder="Dampak spesifik kerentanan ini terhadap sistem..."
                                className="w-full bg-slate-950 border border-slate-800 rounded-md p-2.5 text-slate-300 focus:outline-none focus:border-indigo-500 text-xs leading-relaxed"
                              />
                            </div>

                            <div>
                              <div className="flex items-center justify-between mb-1.5">
                                <label className="text-slate-400 font-medium">
                                  Rekomendasi Mitigasi ({vuln.recommendations?.length || 0} Poin):
                                </label>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setVulnerabilities(prev =>
                                      prev.map(v => {
                                        if (v.id !== vuln.id) return v;
                                        return {
                                          ...v,
                                          recommendations: [...(v.recommendations || []), 'Rekomendasi mitigasi baru...']
                                        };
                                      })
                                    );
                                  }}
                                  className="text-[11px] text-indigo-400 hover:text-indigo-300 font-medium"
                                >
                                  + Tambah Poin Rekomendasi
                                </button>
                              </div>

                              <div className="space-y-1.5">
                                {(vuln.recommendations || []).map((rec, rIdx) => (
                                  <div key={rIdx} className="flex items-center gap-2">
                                    <span className="text-[11px] font-bold text-slate-500 w-4 text-right">
                                      {rIdx + 1}.
                                    </span>
                                    <input
                                      type="text"
                                      value={rec}
                                      onChange={e => {
                                        const newRecVal = e.target.value;
                                        setVulnerabilities(prev =>
                                          prev.map(v => {
                                            if (v.id !== vuln.id) return v;
                                            const updated = [...(v.recommendations || [])];
                                            updated[rIdx] = newRecVal;
                                            return { ...v, recommendations: updated };
                                          })
                                        );
                                      }}
                                      className="flex-1 bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-[11px] text-slate-300 focus:outline-none focus:border-indigo-500"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setVulnerabilities(prev =>
                                          prev.map(v => {
                                            if (v.id !== vuln.id) return v;
                                            return {
                                              ...v,
                                              recommendations: (v.recommendations || []).filter((_, i) => i !== rIdx)
                                            };
                                          })
                                        );
                                      }}
                                      className="p-1 text-slate-500 hover:text-rose-400"
                                      title="Hapus poin rekomendasi"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        /* Visual Document Preview */
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Status banner */}
          <div className="bg-emerald-950/40 border border-emerald-500/30 rounded-lg p-3 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2 text-emerald-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>
                <strong>Template Google Drive Aktif:</strong> Laporan akan di-generate menggunakan template resmi CSIRT Kemenkes (.docx) lengkap dengan Cover A4 grafis resmi, kotak teks 3D, Daftar Isi otomatis, dan ribbon heading abu-abu.
              </span>
            </div>
            <button
              onClick={handleDownloadDocx}
              disabled={isDownloading}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-medium flex items-center gap-1.5 transition text-xs shrink-0"
            >
              <FileDown className="w-3.5 h-3.5" />
              Unduh .docx
            </button>
          </div>

          {/* PAGE 1: COVER PAGE PREVIEW */}
          <div className="relative bg-white text-slate-900 rounded-xl overflow-hidden shadow-2xl border border-slate-700 aspect-[1/1.414] max-w-2xl mx-auto flex flex-col justify-between p-8 select-none">
            {/* Background Image */}
            <img
              src="/templates/cover_bg.png"
              alt="Cover Background"
              className="absolute inset-0 w-full h-full object-cover pointer-events-none"
            />

            {/* Top area (empty to keep background clean) */}
            <div className="relative z-10 h-4"></div>

            {/* Center Content Boxes matching official template layout */}
            <div className="relative z-10 my-auto pl-6 pr-4 space-y-3">
              {/* Row 1: Application Name */}
              <div>
                <p
                  style={{ fontFamily: "'Times New Roman', Times, serif", fontSize: '24px' }}
                  className="text-[#4472C4] font-normal leading-snug drop-shadow-sm max-w-lg"
                >
                  {meta.appName.startsWith('Aplikasi ') ? meta.appName : `Aplikasi ${meta.appName}`}
                </p>
              </div>

              {/* Row 2: Doc Number (Left) and Date (Right) side-by-side */}
              <div className="flex items-center gap-10 sm:gap-14 flex-wrap">
                <p
                  style={{ fontFamily: "'Times New Roman', Times, serif", fontSize: '24px' }}
                  className="text-[#4472C4] font-normal tracking-wide drop-shadow-sm leading-normal shrink-0"
                >
                  {meta.docNumber}
                </p>
                <p
                  style={{ fontFamily: "'Times New Roman', Times, serif", fontSize: '24px' }}
                  className="text-[#4472C4] font-normal tracking-wide drop-shadow-sm leading-normal shrink-0"
                >
                  {meta.reportDate}
                </p>
              </div>
            </div>

            {/* TLP Badge - Horizontally aligned beside Kemenkes CSIRT logo */}
            <div className="absolute right-[22%] sm:right-[23%] bottom-[11.5%] sm:bottom-[12%] z-20">
              <div className="bg-black border border-amber-400 px-3 py-1 rounded shadow-md flex items-center justify-center">
                <span className="text-amber-400 font-bold text-xs sm:text-sm tracking-wider whitespace-nowrap">
                  {meta.tlp}
                </span>
              </div>
            </div>

            {/* Bottom info */}
            <div className="relative z-10 text-left text-[10px] text-slate-400 font-mono">
              Halaman 1 / Cover Resmi CSIRT Kemenkes
            </div>
          </div>

          {/* PAGE 2+: CONTENT PREVIEW */}
          <div className="bg-white text-slate-900 rounded-xl p-8 sm:p-12 shadow-2xl border border-slate-700 space-y-6">
            {/* Document Header */}
            <div className="flex justify-between items-center border-b border-slate-200 pb-3 text-xs text-slate-500">
              <span className="font-semibold text-slate-600">CSIRT Kemenkes RI - Notifikasi Kerentanan</span>
              <span className="bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded text-[11px]">
                {meta.tlp}
              </span>
            </div>

            {/* Document Title on Page 3 */}
            <div className="space-y-1 pt-2">
              <h1 className="text-xl font-bold text-slate-900">Notifikasi Kerentanan</h1>
              <h2 className="text-base font-bold text-slate-800">
                {meta.appName.startsWith('Aplikasi ') ? meta.appName : `Aplikasi ${meta.appName}`}
              </h2>
            </div>

            {/* 1. Ringkasan Eksekutif */}
            <div className="space-y-3">
              <div className="bg-[#B2B2B2] text-white px-3 py-1 font-bold text-sm rounded-sm">
                1. Ringkasan Eksekutif
              </div>
              <p className="text-xs text-slate-700 leading-[1.75] whitespace-pre-line text-justify">
                {renderRichText(
                  meta.executiveSummary ||
                    `Terdeteksi adanya beberapa potensi kerentanan yaitu **${vulnerabilities
                      .map(v => v.name)
                      .join(' dan ')}** pada aplikasi ${meta.appName} (**${meta.targetUrl}**).`
                )}
              </p>
            </div>

            {/* 2. Tabel Kerentanan */}
            <div className="space-y-3">
              <div className="bg-[#B2B2B2] text-white px-3 py-1 font-bold text-sm rounded-sm">
                2. Kerentanan
              </div>
              <p className="text-xs text-slate-700 leading-[1.75]">
                Berikut endpoint atau path {meta.appName} yang rentan terhadap{' '}
                {vulnerabilities.map(v => v.name).join(' dan ')}.
              </p>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border border-slate-300">
                  <thead className="bg-[#AEAAAA] text-white font-bold border-b border-slate-400">
                    <tr>
                      <th className="p-2 text-center w-12 border-r border-slate-300">No</th>
                      <th className="p-2 border-r border-slate-300">Kerentanan</th>
                      <th className="p-2 text-center border-r border-slate-300">Path/Endpoint</th>
                      <th className="p-2 text-center border-r border-slate-300">Risiko</th>
                      <th className="p-2 text-center border-r border-slate-300">OWASP</th>
                      <th className="p-2 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {vulnerabilities.map((v, idx) => (
                      <tr key={v.id} className="hover:bg-slate-50">
                        <td className="p-2 text-center text-slate-600 border-r border-slate-200">{idx + 1}.</td>
                        <td className="p-2 font-medium text-slate-900 border-r border-slate-200">{v.name}</td>
                        <td className="p-2 text-center font-mono text-[11px] text-slate-800 border-r border-slate-200">{v.path}</td>
                        <td className="p-2 text-center border-r border-slate-200">
                          <span className="font-bold text-xs text-slate-900">
                            {v.severity}
                          </span>
                        </td>
                        <td className="p-2 text-center text-slate-700 border-r border-slate-200">{v.owasp}</td>
                        <td className="p-2 text-center font-bold text-emerald-700">{v.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 3. PoC */}
            <div className="space-y-4">
              <div className="bg-[#B2B2B2] text-white px-3 py-1 font-bold text-sm rounded-sm">
                3. PoC
              </div>

              {vulnerabilities.map((v, idx) => (
                <div key={v.id} className="space-y-3 pt-2">
                  <div className="bg-[#B2B2B2] text-white px-3 py-0.5 font-bold text-xs rounded-sm">
                    3.{idx + 1} {v.name}
                  </div>

                  {v.techDescription && (
                    <p className="text-xs text-slate-700 leading-[1.75] whitespace-pre-line text-justify">
                      {v.techDescription}
                    </p>
                  )}

                  {/* Render Embedded Images */}
                  {v.images && v.images.length > 0 && (
                    <div className="space-y-4 my-3">
                      {v.images.map(img => (
                        <div key={img.id} className="flex flex-col items-center gap-2">
                          <div className="border border-slate-300 rounded p-1 bg-slate-50 max-w-lg shadow-sm">
                            <img
                              src={img.dataUrl}
                              alt={img.caption}
                              className="max-h-64 object-contain rounded"
                            />
                          </div>
                          <span className="text-[11px] text-slate-600 italic">
                            {img.caption}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {v.pocNarrative && (
                    <p className="text-xs text-slate-700 leading-[1.75] whitespace-pre-line text-justify">
                      {v.pocNarrative}
                    </p>
                  )}
                </div>
              ))}
            </div>

            {/* 4. Dampak */}
            <div className="space-y-3">
              <div className="bg-[#B2B2B2] text-white px-3 py-1 font-bold text-sm rounded-sm">
                4. Dampak
              </div>
              <p className="text-xs text-slate-700 leading-[1.75] whitespace-pre-line text-justify">
                {meta.overallImpact ||
                  vulnerabilities.map(v => v.impact).filter(Boolean).join('\n\n') ||
                  'Kerentanan yang teridentifikasi berpotensi membuka celah terhadap kerahasiaan dan integritas data.'}
              </p>
            </div>

            {/* 5. Simpulan */}
            <div className="space-y-3">
              <div className="bg-[#B2B2B2] text-white px-3 py-1 font-bold text-sm rounded-sm">
                5. Simpulan
              </div>
              <p className="text-xs text-slate-700 leading-[1.75]">Berikut kesimpulan dari notif insiden kerentanan ini.</p>
              <p className="text-xs text-slate-700 leading-[1.75] whitespace-pre-line text-justify">
                {meta.conclusion || 'Berdasarkan hasil pengujian keamanan, teridentifikasi celah kerentanan yang memerlukan mitigasi segera.'}
              </p>
            </div>

            {/* 6. Rekomendasi */}
            <div className="space-y-3">
              <div className="bg-[#B2B2B2] text-white px-3 py-1 font-bold text-sm rounded-sm">
                6. Rekomendasi
              </div>
              <p className="text-xs text-slate-700 leading-[1.75]">Berikut ini adalah beberapa saran dan rekomendasi yang dapat kami berikan.</p>

              {vulnerabilities.length === 1 ? (
                <ol className="list-decimal list-inside space-y-2 text-xs text-slate-700 pl-2 leading-[1.75]">
                  {(vulnerabilities[0].recommendations || []).map((rec, rIdx) => (
                    <li key={rIdx} className="leading-[1.75]">
                      {rec.replace(/^\d+[\.\)]\s*/, '')}
                    </li>
                  ))}
                </ol>
              ) : (
                vulnerabilities.map(v => (
                  <div key={v.id} className="space-y-1.5 text-xs text-slate-800">
                    <div className="font-bold text-slate-900">Rekomendasi {v.name}:</div>
                    <ol className="list-decimal list-inside space-y-2 text-slate-700 pl-2 leading-[1.75]">
                      {(v.recommendations || []).map((rec, rIdx) => (
                        <li key={rIdx} className="leading-[1.75]">
                          {rec.replace(/^\d+[\.\)]\s*/, '')}
                        </li>
                      ))}
                    </ol>
                  </div>
                ))
              )}
            </div>

            {/* Official Signature Block - Right Aligned (matches ind 5670 in Word doc) */}
            <div className="pt-8 border-t border-slate-200 text-xs flex justify-end">
              <div className="max-w-xs space-y-6 text-slate-800">
                <p className="leading-relaxed">{meta.signerRole}</p>
                <div className="text-slate-400 font-mono text-sm tracking-widest pl-2">
                  {meta.signaturePlaceholder}
                </div>
                <p className="font-bold underline text-slate-900 text-sm">{meta.signerName}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
