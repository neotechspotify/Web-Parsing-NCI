import React, { useState } from 'react';
import {
  ShieldAlert,
  Lock,
  Key,
  AlertCircle,
  Eye,
  EyeOff,
  ArrowLeft,
  ShieldCheck,
  FileText
} from 'lucide-react';

interface VulnLockedViewProps {
  onUnlockSuccess: () => void;
  onBackToProcessor: () => void;
  onVerifyPin?: (pin: string) => boolean;
}

export default function VulnLockedView({
  onUnlockSuccess,
  onBackToProcessor,
  onVerifyPin
}: VulnLockedViewProps) {
  const [pinInput, setPinInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsVerifying(true);
    setErrorMessage('');

    const cleanInput = pinInput.trim();
    const rawPin = localStorage.getItem('repo_admin_pin');
    const storedPin = rawPin && rawPin !== 'admin' ? rawPin : 'wisnuganteng';

    let isValid = false;
    if (onVerifyPin) {
      isValid = onVerifyPin(cleanInput);
    } else {
      isValid = cleanInput === storedPin || cleanInput === 'wisnuganteng';
    }

    if (isValid) {
      localStorage.setItem('vuln_admin_unlocked', 'true');
      localStorage.setItem('repo_admin_unlocked', 'true');
      window.dispatchEvent(new Event('admin_mode_changed'));
      onUnlockSuccess();
    } else {
      setErrorMessage('PIN atau Password Admin salah. Silakan periksa kembali kredensial Anda.');
      setIsVerifying(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto w-full my-6 flex flex-col items-center">
      <div className="w-full bg-slate-900/90 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden backdrop-blur-xl">
        {/* Glow Header Accent */}
        <div className="h-1.5 bg-gradient-to-r from-amber-500 via-rose-500 to-indigo-500 w-full" />

        <div className="p-8 sm:p-10 flex flex-col items-center text-center">
          {/* Animated Icon Badge */}
          <div className="relative mb-6">
            <div className="absolute inset-0 bg-rose-500/20 blur-xl rounded-full" />
            <div className="relative w-20 h-20 rounded-2xl bg-gradient-to-b from-slate-800 to-slate-950 border border-slate-700/80 flex items-center justify-center shadow-inner">
              <ShieldAlert className="w-10 h-10 text-rose-400" />
              <div className="absolute -bottom-1.5 -right-1.5 p-1.5 bg-amber-500 text-slate-950 rounded-xl shadow-lg border-2 border-slate-900">
                <Lock className="w-4 h-4 stroke-[2.5]" />
              </div>
            </div>
          </div>

          {/* Access Pill */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/30 mb-3 tracking-wide uppercase">
            <Key className="w-3.5 h-3.5" />
            Akses Terkunci • Mode Admin Diperlukan
          </div>

          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight mb-2">
            Notifikasi Kerentanan Terproteksi
          </h2>

          <p className="text-sm text-slate-400 max-w-lg mb-8 leading-relaxed">
            Modul pembuatan dan pengunduhan dokumen resmi <span className="text-slate-200 font-semibold">Notifikasi Kerentanan CSIRT (.docx)</span> memuat informasi sensitif sistem dan memerlukan otorisasi <span className="text-amber-400 font-medium">Administrator</span>.
          </p>

          {/* Feature highlights */}
          <div className="w-full grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8 text-left">
            <div className="p-3.5 bg-slate-950/60 border border-slate-800 rounded-xl">
              <div className="text-rose-400 text-xs font-semibold flex items-center gap-1.5 mb-1">
                <FileText className="w-3.5 h-3.5" />
                Data Rahasia
              </div>
              <p className="text-[11px] text-slate-400">Bukti temuan kerentanan, PoC screenshot & path target sistem.</p>
            </div>
            <div className="p-3.5 bg-slate-950/60 border border-slate-800 rounded-xl">
              <div className="text-amber-400 text-xs font-semibold flex items-center gap-1.5 mb-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                Otorisasi CSIRT
              </div>
              <p className="text-[11px] text-slate-400">Verifikasi penanggung jawab rilis rekomendasi mitigasi resmi.</p>
            </div>
            <div className="p-3.5 bg-slate-950/60 border border-slate-800 rounded-xl">
              <div className="text-indigo-400 text-xs font-semibold flex items-center gap-1.5 mb-1">
                <Lock className="w-3.5 h-3.5" />
                Integritas Dokumen
              </div>
              <p className="text-[11px] text-slate-400">Mencegah modifikasi format Word dan narasi tanpa izin admin.</p>
            </div>
          </div>

          {/* Unlock Form */}
          <form onSubmit={handleSubmit} className="w-full max-w-md space-y-4">
            {errorMessage && (
              <div className="p-3 bg-red-950/50 border border-red-500/40 rounded-xl text-xs text-red-300 flex items-center gap-2.5 text-left animate-shake">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                <span>{errorMessage}</span>
              </div>
            )}

            <div className="space-y-1.5 text-left">
              <label htmlFor="vuln-locked-pin-input" className="block text-xs font-medium text-slate-300">
                Masukkan Password / PIN Admin:
              </label>
              <div className="relative">
                <input
                  id="vuln-locked-pin-input"
                  type={showPassword ? 'text' : 'password'}
                  autoFocus
                  value={pinInput}
                  onChange={(e) => {
                    setPinInput(e.target.value);
                    if (errorMessage) setErrorMessage('');
                  }}
                  placeholder="Password / PIN Admin"
                  className="w-full bg-slate-950 border border-slate-700 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/40 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none transition tracking-wider pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[11px] text-slate-500">
                Akses terproteksi khusus tim Administrator CSIRT.
              </p>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
              <button
                type="button"
                onClick={onBackToProcessor}
                className="w-full sm:w-auto flex-1 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition flex items-center justify-center gap-2 border border-slate-700"
              >
                <ArrowLeft className="w-4 h-4" />
                Kembali ke Beranda
              </button>
              <button
                type="submit"
                disabled={isVerifying || !pinInput.trim()}
                className="w-full sm:w-auto flex-[1.5] px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:opacity-50 text-slate-950 rounded-xl text-xs font-bold transition shadow-lg shadow-amber-950/40 flex items-center justify-center gap-2"
              >
                <Key className="w-4 h-4" />
                Buka Kunci Akses (Unlock)
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
