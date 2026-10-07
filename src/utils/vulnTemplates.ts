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
      const cap1 = captions[0] || 'Gambar 3.1.1 Tampilan halaman identifikasi parameter ID pada URL';
      const cap2 = captions[1] || 'Gambar 3.1.2 Tampilan data pengguna lain yang berhasil diakses tanpa otorisasi';
      return `Pada ${cap1}, terlihat parameter ID pada URL yang digunakan untuk mengakses data pengguna pada endpoint ${path} melalui peramban web. Pengujian ini dilakukan untuk mengetahui apakah aplikasi melakukan verifikasi hak kepemilikan data sebelum menyajikan informasi. Selanjutnya, pada ${cap2}, setelah nilai ID diubah secara manual menjadi identifier milik pengguna lain, sistem tetap memberikan akses dan menampilkan rincian data pribadi pengguna lain tersebut tanpa verifikasi hak akses di sisi server. Kondisi tersebut menunjukkan bahwa aplikasi belum menerapkan mekanisme otorisasi objek yang memadai, sehingga pihak yang tidak berhak dapat mengakses data pengguna lain.`;
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
      const cap1 = captions[0] || 'Gambar 3.1.1 Tampilan proses enumerasi username pada portal autentikasi';
      const cap2 = captions[1] || 'Gambar 3.1.2 Tampilan aplikasi berhasil login menggunakan kredensial default';
      return `Pada ${cap1}, dilakukan proses enumerasi pada portal terkait untuk mengidentifikasi informasi username yang berpotensi digunakan sebagai kredensial pada portal ${targetUrl}. Username yang diperoleh kemudian digunakan untuk melakukan pengujian autentikasi menggunakan password default yang diduga masih berlaku. Selanjutnya, pada ${cap2}, hasil pengujian menunjukkan bahwa proses login berhasil dilakukan menggunakan kredensial tersebut dan sistem menampilkan menu navigasi utama serta data akun. Kondisi tersebut menunjukkan bahwa penerapan kebijakan password dan mekanisme autentikasi pada aplikasi masih belum memadai.`;
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
      const cap1 = captions[0] || 'Gambar 3.1.1 Directory Listing pada path /files';
      return `Pada ${cap1}, dilakukan pengujian terhadap web server aplikasi ${targetUrl} dengan mengakses path direktori ${path} secara langsung melalui peramban web. Pengujian ini dilakukan untuk mengetahui apakah web server menerapkan mekanisme proteksi akses direktori atau mengizinkan pengindeksan direktori secara terbuka. Berdasarkan hasil pengujian pada ${cap1}, web server menampilkan halaman 'Index of ${path}' secara publik lengkap dengan daftar file internal seperti Parent Directory dan dokumen file internal (daftar_akd.pdf) beserta informasi tanggal modifikasi serta ukuran file. Kondisi tersebut menunjukkan bahwa web server tidak menonaktifkan fitur directory indexing, sehingga pihak yang tidak berwenang dapat melihat struktur folder dan mengunduh berkas internal tanpa melalui proses autentikasi atau otorisasi semestinya.`;
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
      const cap1 = captions[0] || 'Gambar 3.1.1 Tampilan pengujian akses fitur admin dengan hak akses pengguna biasa';
      const cap2 = captions[1] || 'Gambar 3.1.2 Tampilan modul administratif yang berhasil diakses tanpa otorisasi';
      return `Pada ${cap1}, dilakukan pengujian dengan masuk menggunakan akun berhak akses rendah (regular user), kemudian mencoba mengakses endpoint dengan privilege tinggi pada ${path}. Pengujian ini bertujuan untuk memverifikasi keandalan penegakan hak akses pada level aplikasi. Selanjutnya, pada ${cap2}, sistem mengizinkan akses ke fungsi tersebut dan menampilkan modul kontrol administratif tanpa memvalidasi role atau kepemilikan hak administratif pengguna. Kondisi tersebut menunjukkan bahwa sistem belum menerapkan kontrol otorisasi yang memadai di sisi server.`;
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
      const cap1 = captions[0] || 'Gambar 3.1.1 Tampilan form input yang disisipkan elemen tag HTML';
      const cap2 = captions[1] || 'Gambar 3.1.2 Tampilan halaman web yang merender elemen HTML tiruan';
      return `Pada ${cap1}, dilakukan pengujian terhadap penanganan input pada halaman ${targetUrl} (${path}) dengan memasukkan payload tag HTML khusus pada kolom input formulir. Pengujian ini dilakukan untuk memastikan apakah aplikasi menerapkan sanitasi dan encoding terhadap karakter khusus HTML sebelum menyajikan data kembali ke peramban. Selanjutnya, pada ${cap2}, halaman web merender elemen HTML tersebut secara utuh tanpa proses encoding entitas HTML. Kondisi tersebut menunjukkan bahwa aplikasi rentan terhadap HTML Injection, yang berpotensi dimanfaatkan oleh penyerang untuk memanipulasi tampilan antarmuka (defacement) maupun melakukan rekayasa sosial dan pencurian kredensial (credential harvesting).`;
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
      const cap1 = captions[0] || 'Gambar 3.1.1 Tampilan pengiriman payload JavaScript pada parameter URL';
      const cap2 = captions[1] || 'Gambar 3.1.2 Tampilan kotak dialog eksekusi skrip JavaScript pada peramban web';
      return `Pada ${cap1}, dilakukan pengujian keamanan terhadap parameter masukan pada ${targetUrl} (${path}) dengan menyisipkan payload skrip JavaScript seperti <script>alert(document.domain)</script> pada parameter URL peramban. Pengujian ini bertujuan untuk menguji ada tidaknya validasi masukan serta context-aware output encoding pada respon server. Selanjutnya, pada ${cap2}, saat tautan tersebut diakses, peramban mengeksekusi skrip tersebut secara langsung dan memunculkan kotak dialog dengan domain target. Kondisi tersebut membuktikan bahwa aplikasi rentan terhadap Reflected Cross-Site Scripting (XSS), yang memungkinkan penyerang mencuri token sesi pengguna (session hijacking) dan membajak interaksi pengguna pada aplikasi.`;
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
      const cap1 = captions[0] || 'Gambar 3.1.1 Tampilan formulir penyimpanan data yang disisipkan payload JavaScript';
      const cap2 = captions[1] || 'Gambar 3.1.2 Tampilan eksekusi otomatis skrip JavaScript saat halaman diakses kembali';
      return `Pada ${cap1}, penguji menyisipkan payload skrip JavaScript berbahaya ke dalam kolom data tersimpan pada halaman ${targetUrl} (${path}). Pengujian ini dilakukan untuk mengetahui apakah input pengguna disanitasi secara ketat sebelum disimpan ke dalam basis data aplikasi. Selanjutnya, pada ${cap2}, ketika halaman tersebut dibuka kembali oleh pengguna lain atau akun pengelola, sistem merender data tersebut tanpa sanitasi sehingga skrip tereksekusi secara otomatis di latar belakang peramban korban. Kondisi tersebut membuktikan adanya celah Stored Cross-Site Scripting (Persistent XSS) yang berisiko tinggi terhadap kompromi akun massal dan manipulasi data aplikasi.`;
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
      const cap1 = captions[0] || 'Gambar 3.1.1 Tampilan respon permintaan jaringan pada Developer Tools';
      const cap2 = captions[1] || 'Gambar 3.1.2 Tampilan kebocoran data pribadi sensitif dalam format JSON';
      return `Pada ${cap1}, dilakukan peninjauan lalu lintas jaringan (network traffic inspection) pada aplikasi ${targetUrl} saat mengakses endpoint ${path} melalui peramban web. Pengujian ini bertujuan untuk mengidentifikasi apakah transmisi data telah menerapkan prinsip perlindungan data pribadi dan pembatasan informasi minimum. Selanjutnya, pada ${cap2}, analisis terhadap payload respon JSON menunjukkan adanya data pribadi sensitif (seperti NIK, nama lengkap, riwayat medis, dan token otorisasi) yang disajikan dalam bentuk plaintext tanpa proses enkripsi maupun penyamaran data (masking). Kondisi tersebut menunjukkan pelanggaran terhadap prinsip pelindungan data pribadi (UU PDP) yang dapat dimanfaatkan oleh pihak ketiga untuk pencurian identitas.`;
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
    executiveSummary: `Terdeteksi adanya beberapa potensi kerentanan yaitu **Directory Listing** pada aplikasi Aspak (**aspak.kemkes.go.id**).\n\nKerentanan Directory Listing terjadi ketika informasi sensitif, seperti data pribadi, kredensial, token autentikasi, atau konfigurasi internal sistem, dapat diakses oleh pihak yang tidak berwenang akibat lemahnya mekanisme perlindungan data.`,
    overallImpact: `Kerentanan Directory Listing menyebabkan penyerang yang dapat melihat informasi file yang ada dalam sebuah direktori/ folder. Hal ini dapat menjadi sangat fatal jika di dalam folder tersebut terdapat file seperti file upload, backup config, file sensitif lainnya didalam directory tersebut.`,
    conclusion: `Berikut kesimpulan dari notif insiden kerentanan ini.\n\nBerdasarkan hasil pengujian keamanan yang telah dilakukan terhadap aplikasi Aspak (**aspak.kemkes.go.id**), teridentifikasi Kerentanan **Directory Listing**.\n\nKerentanan Directory Listing ini berpotensi mengungkapkan struktur direktori maupun file sensitif, yang dapat dimanfaatkan oleh pihak yang tidak berwenang untuk memperoleh informasi terkait sistem dan berpotensi digunakan sebagai langkah awal dalam proses eksploitasi lebih lanjut terhadap aplikasi.`
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
      pocNarrative: `Pada Gambar 3.1.1, dilakukan pengujian terhadap web server aplikasi aspak.kemkes.go.id dengan mengakses path direktori /files secara langsung melalui peramban web. Pengujian ini dilakukan untuk mengetahui apakah web server menerapkan mekanisme proteksi akses direktori atau mengizinkan pengindeksan direktori secara terbuka. Berdasarkan hasil pengujian pada Gambar 3.1.1, web server menampilkan halaman 'Index of /files' secara publik lengkap dengan daftar file internal seperti Parent Directory dan dokumen file internal (daftar_akd.pdf) beserta informasi tanggal modifikasi serta ukuran file. Kondisi tersebut menunjukkan bahwa web server tidak menonaktifkan fitur directory indexing, sehingga pihak yang tidak berwenang dapat melihat struktur folder dan mengunduh berkas internal tanpa melalui proses autentikasi atau otorisasi semestinya.`,
      impact: `Kerentanan Directory Listing menyebabkan penyerang yang dapat melihat informasi file yang ada dalam sebuah direktori/ folder. Hal ini dapat menjadi sangat fatal jika di dalam folder tersebut terdapat file seperti file upload, backup config, file sensitif lainnya didalam directory tersebut.`,
      recommendations: [
        'Mengatur hak akses agar membatasi akses ke file sensitif.',
        'Aktifkan pembatasan akses atau nonaktifkan pengindeksan direktori pada konfigurasi webserver.'
      ],
      images: [
        {
          id: 'img-aspak-1',
          dataUrl: '/sample-poc/aspak_poc.jpeg',
          caption: 'Gambar 3.1.1 Directory Listing pada path /files menampilkan Index of /files dan dokumen internal daftar_akd.pdf'
        }
      ]
    }
  ]
};

