export interface VulnPreset {
  name: string;
  category: string;
  owasp: string;
  defaultSeverity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
  defaultPath: string;
  techDescription: (appName: string, targetUrl: string, path: string) => string;
  pocNarrative: (appName: string, targetUrl: string, path: string, captions: string[]) => string;
  impact: (appName: string) => string;
  recommendations: string[];
}

export const VULN_PRESETS: Record<string, VulnPreset> = {
  'IDOR (Insecure Direct Object Reference)': {
    name: 'Insecure Direct Object Reference (IDOR)',
    category: 'Broken Access Control',
    owasp: 'A01:2025',
    defaultSeverity: 'CRITICAL',
    defaultPath: '/new_pasiens/edit/*',
    techDescription: (appName, targetUrl, path) =>
      `Kerentanan Insecure Direct Object Reference (IDOR) pada aplikasi ${targetUrl} memungkinkan pengguna yang terautentikasi mengakses atau memanipulasi objek referensi internal (seperti ID pengguna, ID dokumen, atau nomor transaksi) secara langsung pada parameter permintaan tanpa adanya validasi otorisasi di sisi server. Kondisi ini dapat dimanfaatkan oleh penyerang untuk melihat, mengubah, atau menghapus data milik pengguna lain secara tidak sah, yang membuka peluang terjadinya kebocoran informasi sensitif, perusakan integritas data, hingga eskalasi hak akses di dalam sistem.`,
    pocNarrative: (appName, targetUrl, path, captions) => {
      const cap1 = captions[0] || 'Tampilan halaman identifikasi parameter ID pada URL';
      return `Pada ${cap1}, terlihat parameter ID pada URL yang digunakan untuk mengakses data pengguna pada endpoint ${path}. Setelah nilai ID diubah secara manual, aplikasi tetap memberikan akses dan menampilkan data pengguna lain yang seharusnya tidak dapat diakses oleh akun tersebut. Kondisi ini menunjukkan bahwa aplikasi belum menerapkan validasi dan verifikasi hak akses terhadap objek yang diminta, sehingga berpotensi memungkinkan pengguna yang tidak berwenang mengakses data pengguna lain.`;
    },
    impact: (appName) =>
      `Kerentanan Insecure Direct Object Reference (IDOR) berpotensi memungkinkan pengguna yang tidak memiliki kewenangan untuk mengakses objek atau data milik pengguna lain melalui manipulasi referensi objek. Kondisi ini dapat mengakibatkan pengungkapan atau modifikasi data secara tidak sah serta meningkatkan risiko terhadap kerahasiaan dan integritas data dalam aplikasi ${appName}.`,
    recommendations: [
      'Pastikan bahwa setiap permintaan yang menggunakan parameter seperti ID diverifikasi terlebih dahulu di sisi server untuk memastikan pengguna yang melakukan permintaan memiliki hak akses terhadap data tersebut.',
      'Terapkan kontrol akses berbasis peran (Role-Based Access Control / RBAC) untuk memastikan bahwa pengguna hanya dapat mengakses data yang memang menjadi kewenangannya.',
      'Gunakan identifier yang tidak dapat ditebak secara berurutan (misalnya UUID v4) sebagai pengganti sequential integer ID untuk mengurangi risiko enumerasi objek.'
    ]
  },

  'Weak Password Requirements': {
    name: 'Weak Password Requirements',
    category: 'Identification and Authentication Failures',
    owasp: 'A03:2025',
    defaultSeverity: 'CRITICAL',
    defaultPath: '/',
    techDescription: (appName, targetUrl, path) =>
      `Kerentanan Weak Password Requirements pada aplikasi ${targetUrl} memungkinkan pengguna mendaftarkan atau memperbarui kata sandi menggunakan kombinasi yang sangat sederhana tanpa adanya validasi kompleksitas maupun batasan panjang minimum dari sistem. Kondisi ini dapat dimanfaatkan oleh penyerang untuk melakukan serangan berbasis tebakan kredensial seperti brute-force atau dictionary attack secara efektif, yang membuka peluang terjadinya pengambilalihan akun (account takeover), akses tidak sah ke dalam fitur internal aplikasi, hingga kompromi data sensitif pengguna atau hak akses administratif.`,
    pocNarrative: (appName, targetUrl, path, captions) => {
      const cap1 = captions[0] || 'Tampilan halaman proses enumerasi username';
      const cap2 = captions[1] || 'Tampilan halaman aplikasi berhasil login menggunakan kredensial default';
      return `Pada ${cap1}, dilakukan proses enumerasi pada portal terkait untuk mengidentifikasi informasi username yang berpotensi digunakan sebagai kredensial. Username yang diperoleh kemudian digunakan untuk melakukan pengujian autentikasi pada website ${targetUrl} menggunakan password default yang diduga masih berlaku. Pada ${cap2}, hasil pengujian menunjukkan bahwa proses login berhasil dilakukan menggunakan kredensial tersebut, sehingga pengguna dapat memperoleh akses ke dalam aplikasi. Kondisi tersebut menunjukkan bahwa penerapan kebijakan password dan mekanisme autentikasi pada aplikasi masih belum memadai.`;
    },
    impact: (appName) =>
      `Kerentanan Weak Password Requirements dapat meningkatkan risiko kredensial pengguna ditebak atau disalahgunakan oleh pihak yang tidak berwenang. Penggunaan password default atau password yang lemah dapat memungkinkan akses tidak sah ke dalam aplikasi dan informasi yang tersedia pada akun tersebut. Kondisi ini berpotensi menyebabkan pengungkapan data, penyalahgunaan akun, serta meningkatkan risiko terjadinya serangan lanjutan terhadap sistem ${appName}.`,
    recommendations: [
      'Terapkan password policy yang ketat, seperti kewajiban kombinasi huruf besar, huruf kecil, angka, dan simbol dengan panjang minimal 8–12 karakter.',
      'Pastikan semua akun diwajibkan mengganti kata sandi jika masih menggunakan kata sandi default dan terapkan Multi-Factor Authentication (MFA / 2FA) atau CAPTCHA pada portal login.',
      'Terapkan sistem force password reset saat login berikutnya untuk akun-akun yang terdeteksi menggunakan password lemah dan jadwalkan force password change secara berkala (misalnya setiap 90 hari).',
      'Terapkan idle session timeout yang otomatis mengeluarkan pengguna setelah tidak aktif selama 15–30 menit serta absolute timeout sesi maksimal (misalnya 12–24 jam).',
      'Pastikan setiap pengguna hanya memiliki akses sesuai kebutuhan operasional (prinsip Least Privilege).'
    ]
  },

  'Directory Listing': {
    name: 'Directory Listing',
    category: 'Security Misconfiguration',
    owasp: 'A05:2025',
    defaultSeverity: 'MEDIUM',
    defaultPath: '/uploads/',
    techDescription: (appName, targetUrl, path) =>
      `Kerentanan Directory Listing pada web server ${targetUrl} terjadi akibat konfigurasi server yang mengizinkan penjelajahan indeks direktori (Index of /) ketika berkas indeks default (seperti index.html atau index.php) tidak ditemukan pada suatu direktori. Hal ini memungkinkan pengguna atau penyerang untuk melihat struktur berkas, berkas konfigurasi cadangan, dokumen unggahan pengguna, serta informasi internal lainnya secara bebas.`,
    pocNarrative: (appName, targetUrl, path, captions) => {
      const cap1 = captions[0] || 'Tampilan daftar berkas direktori terbuka (Index of)';
      return `Pada ${cap1}, dilakukan pengujian dengan mengakses direktori ${path} pada ${targetUrl}. Web server merespons dengan menampilkan daftar berkas secara terbuka (Directory Indexing). Penguji dapat melihat berkas-berkas sensitif dan mengunduhnya secara langsung tanpa proses otentikasi maupun otorisasi.`;
    },
    impact: (appName) =>
      `Kelemahan Directory Listing mempermudah penyerang dalam melakukan pengintaian (reconnaissance), mengidentifikasi berkas konfigurasi rahasia, source code backup (.bak / .old), serta dokumen sensitif yang tersimpan pada aplikasi ${appName}. Informasi yang terungkap dapat digunakan sebagai dasar melancarkan serangan lanjutan yang lebih berbahaya.`,
    recommendations: [
      'Nonaktifkan fitur directory indexing pada web server (misalnya matikan modul `autoindex` pada Apache atau setel `autoindex off;` pada Nginx).',
      'Pastikan setiap direktori publik memiliki berkas indeks default kosong (misalnya index.html kosong) untuk mencegah penampilan direktori.',
      'Batasi hak akses direktori unggahan agar hanya dapat diakses melalui mekanisme unduhan resmi berotorisasi.'
    ]
  },

  'Broken Access Control': {
    name: 'Broken Access Control',
    category: 'Broken Access Control',
    owasp: 'A01:2025',
    defaultSeverity: 'HIGH',
    defaultPath: '/admin/dashboard',
    techDescription: (appName, targetUrl, path) =>
      `Kerentanan Broken Access Control pada aplikasi ${targetUrl} terjadi ketika pembatasan terhadap apa yang diizinkan dilakukan oleh pengguna yang diautentikasi tidak ditegakkan dengan benar. Akibatnya, penyerang dapat mengeksploitasi kelemahan ini untuk mengakses fungsionalitas administratif, melihat data pengguna lain, mengubah konfigurasi sistem, atau memodifikasi data tanpa otorisasi yang sah.`,
    pocNarrative: (appName, targetUrl, path, captions) => {
      const cap1 = captions[0] || 'Tampilan pengujian akses fitur admin dengan hak akses pengguna biasa';
      return `Pada ${cap1}, dilakukan pengujian dengan masuk menggunakan akun berhak akses rendah (regular user), kemudian mencoba mengakses endpoint dengan privilege tinggi pada ${path}. Sistem mengizinkan akses ke fungsi tersebut tanpa memvalidasi role atau kepemilikan hak administratif pengguna.`;
    },
    impact: (appName) =>
      `Dapat mengakibatkan eskalasi hak akses (Privilege Escalation), pengungkapan data administratif rahasia, manipulasi basis data, serta potensi pengambilalihan kendali operasional atas aplikasi ${appName}.`,
    recommendations: [
      'Terapkan kontrol otorisasi berbasis peran (Role-Based Access Control) secara ketat pada setiap controller dan rute API di sisi server.',
      'Terapkan prinsip Deny by Default untuk seluruh endpoint sensitif.',
      'Catat dan monitor upaya akses ilegal untuk deteksi dini aktivitas mencurigakan.'
    ]
  },

  'HTML Injection': {
    name: 'HTML Injection',
    category: 'Injection',
    owasp: 'A03:2025',
    defaultSeverity: 'MEDIUM',
    defaultPath: '/feedback/submit',
    techDescription: (appName, targetUrl, path) =>
      `Kerentanan HTML Injection terjadi ketika aplikasi ${targetUrl} menerima input dari pengguna yang mengandung tag HTML dan merendernya kembali ke antarmuka web tanpa proses sanitasi atau encoding yang memadai. Penyerang dapat menyisipkan elemen HTML berbahaya untuk memodifikasi tampilan halaman atau melakukan defacement visual dan phishing form.`,
    pocNarrative: (appName, targetUrl, path, captions) => {
      const cap1 = captions[0] || 'Tampilan form input yang diinjeksi elemen HTML';
      return `Pada ${cap1}, dilakukan pengujian dengan mengirimkan payload tag HTML pada parameter input di endpoint ${path}. Aplikasi merender elemen HTML tersebut secara langsung pada halaman hasil tanpa melakukan HTML entity encoding.`;
    },
    impact: (appName) =>
      `Penyerang dapat mengubah tampilan visual halaman web, menyisipkan form login palsu untuk mencuri kredensial pengguna (credential harvesting), serta menyesatkan pengguna resmi aplikasi ${appName}.`,
    recommendations: [
      'Lakukan sanitasi input dan enkoding karakter khusus HTML (HTML entity encoding) seperti <, >, &, ", \' sebelum ditampilkan di antarmuka web.',
      'Gunakan template engine modern yang secara default menerapkan context-aware output encoding.',
      'Terapkan Content Security Policy (CSP) untuk membatasi sumber daya eksternal.'
    ]
  },

  'XSS Reflected': {
    name: 'XSS (Cross-Site Scripting) Reflected',
    category: 'Injection',
    owasp: 'A03:2025',
    defaultSeverity: 'HIGH',
    defaultPath: '/search?q=',
    techDescription: (appName, targetUrl, path) =>
      `Kerentanan Cross-Site Scripting (XSS) Reflected pada aplikasi ${targetUrl} terjadi ketika aplikasi menerima data dalam permintaan HTTP dan menyertakan data tersebut ke dalam respons langsung tanpa validasi atau encoding yang tepat. Skrip berbahaya dieksekusi di browser korban saat korban membuka tautan khusus yang dirancang oleh penyerang.`,
    pocNarrative: (appName, targetUrl, path, captions) => {
      const cap1 = captions[0] || 'Tampilan eksekusi skrip JavaScript pada browser korban';
      return `Pada ${cap1}, dilakukan pengujian dengan menyisipkan payload JavaScript (misal: alert atau document.cookie) ke dalam parameter URL pada endpoint ${path}. Ketika tautan tersebut diakses, payload dieksekusi langsung oleh browser dalam konteks sesi pengguna.`;
    },
    impact: (appName) =>
      `Penyerang dapat mencuri sesi login (session hijacking), token autentikasi, mengarahkan korban ke situs berbahaya, serta melakukan aksi atas nama korban pada aplikasi ${appName}.`,
    recommendations: [
      'Lakukan context-sensitive output encoding pada seluruh titik keluaran parameter.',
      'Pasang flag HttpOnly dan Secure pada seluruh cookie sesi untuk mencegah pencurian cookie melalui skrip JavaScript.',
      'Terapkan Content Security Policy (CSP) ketat dengan melarang inline script (`unsafe-inline`).'
    ]
  },

  'XSS Stored': {
    name: 'XSS (Cross-Site Scripting) Stored',
    category: 'Injection',
    owasp: 'A03:2025',
    defaultSeverity: 'HIGH',
    defaultPath: '/profile/update',
    techDescription: (appName, targetUrl, path) =>
      `Kerentanan Cross-Site Scripting (XSS) Stored (Persistent) terjadi ketika input berbahaya dari pengguna disimpan secara permanen di basis data server ${targetUrl} dan kemudian ditampilkan kembali ke pengguna lain tanpa sanitasi. Ini merupakan bentuk XSS yang paling berbahaya karena dapat menginfeksi siapa pun yang melihat halaman tersebut.`,
    pocNarrative: (appName, targetUrl, path, captions) => {
      const cap1 = captions[0] || 'Tampilan payload tersimpan di database dan tereksekusi otomatis';
      return `Pada ${cap1}, penguji menyisipkan skrip JavaScript ke dalam kolom profil/komentar pada endpoint ${path}. Skrip tersimpan di database dan dieksekusi secara otomatis setiap kali halaman tersebut dikunjungi oleh pengguna lain atau administrator.`;
    },
    impact: (appName) =>
      `Memungkinkan kompromi akun massal, worm XSS, pencurian data sensitif secara pasif, serta modifikasi konten aplikasi ${appName} bagi seluruh pengguna yang mengakses halaman tersebut.`,
    recommendations: [
      'Gunakan pustaka sanitasi input HTML terpercaya (misal DOMPurify) di sisi server sebelum menyimpan data ke database.',
      'Terapkan context-aware output encoding saat merender data yang tersimpan.',
      'Gunakan Content Security Policy (CSP) yang melarang eksekusi skrip dari sumber yang tidak sah.'
    ]
  },

  'Sensitive Data Exposure': {
    name: 'Sensitive Data Exposure',
    category: 'Cryptographic Failures',
    owasp: 'A02:2025',
    defaultSeverity: 'HIGH',
    defaultPath: '/api/v1/users/export',
    techDescription: (appName, targetUrl, path) =>
      `Kerentanan Sensitive Data Exposure pada aplikasi ${targetUrl} terjadi ketika data sensitif seperti Nomor Induk Kependudukan (NIK), rekam medis, alamat surel, nomor telepon, atau token otentikasi dikirimkan atau disimpan tanpa enkripsi yang memadai, atau terekspos secara terbuka melalui respons API publik.`,
    pocNarrative: (appName, targetUrl, path, captions) => {
      const cap1 = captions[0] || 'Tampilan respon API yang mengekspos data pribadi sensitif (PII)';
      return `Pada ${cap1}, dilakukan peninjauan respons jaringan pada endpoint ${path}. Ditemukan bahwa respons API menyertakan data sensitif pengguna (seperti informasi pribadi dan data medis) dalam bentuk plaintext tanpa adanya masking atau pembatasan field.`;
    },
    impact: (appName) =>
      `Melanggar kepatuhan Undang-Undang Pelindungan Data Pribadi (UU PDP), menyebabkan kebocoran informasi identitas pengguna, serta menurunkan reputasi dan kredibilitas instansi pengelola ${appName}.`,
    recommendations: [
      'Terapkan enkripsi end-to-end (TLS 1.3) saat transit dan enkripsi kuat (AES-256) saat data tersimpan (at rest).',
      'Terapkan data masking pada field sensitif (misalnya NIK: 317101******0001).',
      'Filter dan batasi keluaran API (Data Transfer Object / DTO) agar hanya mengembalikan data yang relevan bagi pengguna.'
    ]
  }
};

export const SAMPLE_ASPAK_REPORT = {
  meta: {
    docNumber: '62A.NR.102026',
    docTitle: '62. Notifikasi Report - Aplikasi Aspak',
    appName: 'Aplikasi Aspak',
    targetUrl: 'aspak.kemkes.go.id',
    reportDate: '01 Oktober 2026',
    tlp: 'TLP : AMBER' as const,
    instansi: 'Tim Tanggap Insiden Siber (CSIRT) dan Pelindungan Data Pribadi (PDP) - Kementerian Kesehatan',
    signerRole: 'Ketua Tim Kerja Penyelenggaraan Layanan Tim Tanggap Insiden Siber (CSIRT) dan Pelindungan Data Pribadi (PDP),',
    signerName: 'Istiqomah, SS, MKM',
    signaturePlaceholder: '${ttd_pengirim}',
    executiveSummary: `Terdeteksi adanya beberapa potensi kerentanan yaitu Directory Listing pada aplikasi Aspak (aspak.kemkes.go.id).\n\nKerentanan Directory Listing terjadi ketika informasi sensitif, seperti data pribadi, kredensial, token autentikasi, atau konfigurasi internal sistem, dapat diakses oleh pihak yang tidak berwenang akibat lemahnya mekanisme perlindungan data.`,
    overallImpact: `Kerentanan Directory Listing menyebabkan penyerang yang dapat melihat informasi file yang ada dalam sebuah direktori/ folder. Hal ini dapat menjadi sangat fatal jika di dalam folder tersebut terdapat file seperti file upload, backup config, file sensitif lainnya didalam directory tersebut.`,
    conclusion: `Berikut kesimpulan dari notif insiden kerentanan ini.\n\nBerdasarkan hasil pengujian keamanan yang telah dilakukan terhadap aplikasi Aspak (aspak.kemkes.go.id), teridentifikasi Kerentanan Directory Listing.\n\nKerentanan Directory Listing ini berpotensi mengungkapkan struktur direktori maupun file sensitif, yang dapat dimanfaatkan oleh pihak yang tidak berwenang untuk memperoleh informasi terkait sistem dan berpotensi digunakan sebagai langkah awal dalam proses eksploitasi lebih lanjut terhadap aplikasi.`
  },
  vulnerabilities: [
    {
      id: 'vuln-aspak-1',
      name: 'Directory Listing',
      path: '/files',
      severity: 'MEDIUM' as const,
      owasp: 'A02:2025',
      status: 'OPEN' as const,
      techDescription: `Kerentanan Directory Listing pada aplikasi aspak.kemkes.go.id memungkinkan siapa saja untuk melihat daftar file dan direktori yang tersedia. Hal ini berpotensi mengekspos file sensitif seperti file backup dan file lain yang dapat dimanfaatkan oleh penyerang untuk mendapatkan akses tidak sah atau informasi berharga tentang sistem.`,
      pocNarrative: `Berdasarkan hasil pengujian, pada Gambar 3.1.1 kerentanan pada web server dimana direktori atau folder dapat diakses langsung oleh pengguna tanpa pembatasan. Hal ini menyebabkan daftar file dan folder pada server ditampilkan di browser, sehingga informasi sensitif berpotensi terekspos dan dapat dimanfaatkan oleh penyerang untuk melakukan serangan lanjutan`,
      impact: `Kerentanan Directory Listing menyebabkan penyerang yang dapat melihat informasi file yang ada dalam sebuah direktori/ folder. Hal ini dapat menjadi sangat fatal jika di dalam folder tersebut terdapat file seperti file upload, backup config, file sensitif lainnya didalam directory tersebut.`,
      recommendations: [
        'Mengatur hak akses agar membatasi akses ke file sensitif.',
        'Aktifkan pembatasan akses atau nonaktifkan pengindeksan direktori pada konfigurasi webserver.'
      ],
      images: [
        {
          id: 'img-aspak-1',
          dataUrl: '/sample-poc/aspak_poc.jpeg',
          caption: 'Gambar 3.1.1 Directory Listing pada path /files'
        }
      ]
    }
  ]
};

export const SAMPLE_SIHEPI_REPORT = {
  meta: {
    docNumber: '58A.NR.092026',
    docTitle: '58A. Notifikasi Report - Aplikasi SIHEPI',
    appName: 'Aplikasi SIHEPI',
    targetUrl: 'sihepi.kemkes.go.id',
    reportDate: '21 September 2026',
    tlp: 'TLP : AMBER' as const,
    instansi: 'Tim Tanggap Insiden Siber (CSIRT) dan Pelindungan Data Pribadi (PDP) - Kementerian Kesehatan',
    signerRole: 'Ketua Tim Kerja Penyelenggaraan Layanan Tim Tanggap Insiden Siber (CSIRT) dan Pelindungan Data Pribadi (PDP)',
    signerName: 'Istiqomah, SS, MKM',
    signaturePlaceholder: '${ttd_pengirim}',
    executiveSummary: `Terdeteksi adanya beberapa potensi kerentanan yaitu Weak Password Requirements dan Insecure Direct Object Reference (IDOR) pada aplikasi SIHEPI (sihepi.kemkes.go.id).

Kerentanan Weak Password Requirements menunjukkan bahwa sistem menerapkan kebijakan kata sandi yang lemah, sehingga meningkatkan risiko akses tidak sah, enumerasi, dan pengungkapan informasi internal. Kondisi ini dapat meningkatkan potensi kompromi akun dan serangan lanjutan terhadap sistem.

Kerentanan Insecure Direct Object Reference (IDOR) terjadi ketika pengguna dapat mengakses objek atau data secara langsung tanpa proses verifikasi hak akses yang memadai, sehingga berpotensi mengakses data yang seharusnya tidak dapat diakses. Kondisi ini dapat menyebabkan pengungkapan atau manipulasi data secara tidak sah.`,
    overallImpact: `Kerentanan Weak Password Requirements dapat meningkatkan risiko kredensial pengguna ditebak atau disalahgunakan oleh pihak yang tidak berwenang. Penggunaan password default atau password yang lemah dapat memungkinkan akses tidak sah ke dalam aplikasi dan informasi yang tersedia pada akun tersebut. Kondisi ini berpotensi menyebabkan pengungkapan data, penyalahgunaan akun, serta meningkatkan risiko terjadinya serangan lanjutan terhadap sistem.

Kerentanan Insecure Direct Object Reference (IDOR) berpotensi memungkinkan pengguna yang tidak memiliki kewenangan untuk mengakses objek atau data milik pengguna lain melalui manipulasi referensi objek. Kondisi ini dapat mengakibatkan pengungkapan atau modifikasi data secara tidak sah serta meningkatkan risiko terhadap kerahasiaan dan integritas data dalam aplikasi SIHEPI.`,
    conclusion: `Berikut kesimpulan dari notif insiden kerentanan ini. Berdasarkan hasil pengujian keamanan yang telah dilakukan terhadap aplikasi SIHEPI (sihepi.kemkes.go.id), teridentifikasi kerentanan Weak Password Requirements dan Insecure Direct Object Reference (IDOR).

Kerentanan Weak Password Requirements menunjukkan bahwa penerapan kebijakan password pada aplikasi masih belum memadai, sehingga meningkatkan risiko penggunaan kredensial default atau password yang lemah untuk memperoleh akses tidak sah ke dalam aplikasi.

Kerentanan Insecure Direct Object Reference (IDOR) menunjukkan bahwa aplikasi belum menerapkan verifikasi hak akses yang memadai terhadap objek yang diminta, sehingga pengguna berpotensi mengakses atau memodifikasi data yang berada di luar kewenangannya.`
  },
  vulnerabilities: [
    {
      id: 'vuln-1',
      name: 'Weak Password Requirements',
      path: '/',
      severity: 'CRITICAL' as const,
      owasp: 'A03:2025',
      status: 'OPEN' as const,
      techDescription: `Kerentanan Weak Password Requirements pada aplikasi sihepi.kemkes.go.id memungkinkan pengguna mendaftarkan atau memperbarui kata sandi menggunakan kombinasi yang sangat sederhana tanpa adanya validasi kompleksitas maupun batasan panjang minimum dari sistem. Kondisi ini dapat dimanfaatkan oleh penyerang untuk melakukan serangan berbasis tebakan kredensial seperti brute-force atau dictionary attack secara efektif, yang membuka peluang terjadinya pengambilalihan akun (account takeover), akses tidak sah ke dalam fitur internal aplikasi, hingga kompromi data sensitif pengguna atau hak akses administratif.`,
      pocNarrative: `Pada Gambar 3.1.1, dilakukan proses enumerasi pada website data.sitb.id untuk mengidentifikasi informasi username yang berpotensi digunakan sebagai kredensial. Username yang diperoleh kemudian digunakan untuk melakukan pengujian autentikasi pada website sihepi.kemkes.go.id menggunakan password default yang diduga masih berlaku.

Pada Gambar 3.1.2, hasil pengujian menunjukkan bahwa proses login berhasil dilakukan menggunakan kredensial tersebut, sehingga pengguna dapat memperoleh akses ke dalam aplikasi. Kondisi tersebut menunjukkan bahwa penerapan kebijakan password dan mekanisme autentikasi pada aplikasi masih belum memadai, sehingga kredensial default berpotensi disalahgunakan oleh pihak yang tidak berwenang untuk memperoleh akses ke sistem dan mengakses informasi sesuai dengan hak akses akun yang berhasil digunakan.`,
      impact: `Kerentanan Weak Password Requirements dapat meningkatkan risiko kredensial pengguna ditebak atau disalahgunakan oleh pihak yang tidak berwenang. Penggunaan password default atau password yang lemah dapat memungkinkan akses tidak sah ke dalam aplikasi dan informasi yang tersedia pada akun tersebut. Kondisi ini berpotensi menyebabkan pengungkapan data, penyalahgunaan akun, serta meningkatkan risiko terjadinya serangan lanjutan terhadap sistem.`,
      recommendations: [
        'Terapkan password policy, seperti penggunaan kombinasi angka, huruf, simbol, dengan minimal 8 karakter.',
        'Pastikan semua akun mengganti kata sandi jika masih menggunakan kata sandi default dan lakukan penerapan 2FA / CAPTCHA.',
        'Terapkan sistem force password reset saat login berikutnya untuk akun – akun yang menggunakan password lemah dan jadwalkan force password change secara berkala (misalnya setiap 3 atau 6 bulan).',
        'Terapkan idle timeout yang otomatis mengeluarkan pengguna setelah tidak aktif selama 15 – 30 menit serta absolute timeout yang membatasi sesi maksimal, misalnya dalam 24 jam meskipun pengguna masih aktif.',
        'Pastikan setiap pengguna hanya memiliki akses sesuai kebutuhan (Least Privilege).'
      ],
      images: [
        {
          id: 'img-1',
          dataUrl: '/sample-poc/image2.png',
          caption: 'Gambar 3.1.1 Tampilan halaman data.sitb.id untuk melakukan enumerasi dan memperoleh username'
        },
        {
          id: 'img-2',
          dataUrl: '/sample-poc/image3.png',
          caption: 'Gambar 3.1.2 Tampilan halaman website sihepi berhasil login menggunakan password default'
        }
      ]
    },
    {
      id: 'vuln-2',
      name: 'Insecure Direct Object Reference (IDOR)',
      path: '/new_pasiens/edit/*',
      severity: 'CRITICAL' as const,
      owasp: 'A01:2025',
      status: 'OPEN' as const,
      techDescription: `Kerentanan Insecure Direct Object Reference (IDOR) pada aplikasi sihepi.kemkes.go.id memungkinkan pengguna yang terautentikasi mengakses atau memanipulasi objek referensi internal (seperti ID pengguna, ID dokumen, atau nomor transaksi) secara langsung pada parameter permintaan tanpa adanya validasi otorisasi di sisi server. Kondisi ini dapat dimanfaatkan oleh penyerang untuk melihat, mengubah, atau menghapus data milik pengguna lain secara tidak sah, yang membuka peluang terjadinya kebocoran informasi sensitif, perusakan integritas data, hingga eskalasi hak akses di dalam sistem.`,
      pocNarrative: `Pada Gambar 3.2.1 terlihat parameter ID pada URL yang digunakan untuk mengakses data pengguna. Setelah nilai ID diubah secara manual, aplikasi tetap memberikan akses dan menampilkan data pengguna lain yang seharusnya tidak dapat diakses oleh akun tersebut. Kondisi ini menunjukkan bahwa aplikasi belum menerapkan validasi dan verifikasi hak akses terhadap objek yang diminta, sehingga berpotensi memungkinkan pengguna yang tidak berwenang mengakses data pengguna lain.`,
      impact: `Kerentanan Insecure Direct Object Reference (IDOR) berpotensi memungkinkan pengguna yang tidak memiliki kewenangan untuk mengakses objek atau data milik pengguna lain melalui manipulasi referensi objek. Kondisi ini dapat mengakibatkan pengungkapan atau modifikasi data secara tidak sah serta meningkatkan risiko terhadap kerahasiaan dan integritas data dalam aplikasi.`,
      recommendations: [
        'Pastikan bahwa setiap permintaan yang menggunakan parameter seperti ID diverifikasi terlebih dahulu untuk memastikan pengguna yang melakukan permintaan memiliki hak akses terhadap data tersebut.',
        'Terapkan kontrol akses untuk memastikan bahwa pengguna hanya dapat mengakses data yang memang menjadi kewenangannya.'
      ],
      images: [
        {
          id: 'img-3',
          dataUrl: '/sample-poc/image4.png',
          caption: 'Gambar 3.2.1 Tampilan halaman Identifikasi parameter ID pada URL.'
        }
      ]
    }
  ]
};
