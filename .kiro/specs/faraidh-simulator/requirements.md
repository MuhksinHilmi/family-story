# Requirements Document

## Introduction

Fitur **Faraidh Simulator** (Kalkulator Waris Islami) adalah modul tambahan yang terintegrasi langsung ke halaman `/tree` yang sudah ada. Fitur ini memungkinkan pengguna memilih seorang pewaris (anggota keluarga yang telah wafat) dari visualisasi family tree, kemudian sistem secara otomatis menelusuri graph keluarga untuk mengidentifikasi ahli waris, menghitung pembagian harta warisan sesuai hukum faraidh Islam (mazhab Syafi'i), dan menampilkan hasil dengan animasi visual di canvas ReactFlow — **tanpa mengubah atau menghapus fungsionalitas tree yang sudah ada**.

---

## Glossary

- **Faraidh_Engine**: Modul komputasi inti (`lib/faraidh/`) yang mengimplementasikan hukum waris Islam mazhab Syafi'i.
- **Pewaris**: Anggota keluarga yang telah wafat dan hartanya akan dibagi.
- **Ahli_Waris**: Anggota keluarga yang berhak menerima bagian dari harta peninggalan pewaris.
- **Harta_Bersih**: Harta bruto dikurangi hutang dan wasiat (maksimal 1/3 dari harta bruto).
- **Ashhabul_Furudh**: Ahli waris dengan bagian tetap yang ditetapkan Al-Qur'an (suami, istri, orang tua, anak perempuan).
- **Ashabah**: Ahli waris penerima sisa harta setelah Ashhabul_Furudh (umumnya anak laki-laki).
- **Hajb_Hirman**: Mekanisme penghalang total — keberadaan ahli waris tertentu menghalangi ahli waris lain secara penuh.
- **Hajb_Nuqshan**: Mekanisme pengurangan bagian — keberadaan ahli waris tertentu mengurangi bagian ahli waris lain.
- **Aul**: Mekanisme proporsional ketika total bagian Ashhabul_Furudh melebihi 1 (100%), semua bagian dikurangi secara proporsional.
- **Radd**: Mekanisme pengembalian sisa harta secara proporsional kepada ahli waris ketika tidak ada Ashabah dan total fardh kurang dari 1.
- **Inheritance_Panel**: Panel slide-in 380px dari sisi kanan halaman `/tree` yang menampilkan seluruh alur fitur faraidh.
- **Inheritance_Mode**: Kondisi aktif ketika pengguna sedang menggunakan Faraidh Simulator.
- **Fraction**: Representasi pecahan presisi tinggi (pembilang/penyebut integer) yang digunakan Faraidh_Engine untuk menghindari floating-point error.
- **Kasus_Waris**: Satu sesi kalkulasi waris yang disimpan ke database, terikat pada satu pewaris dan satu snapshot harta.
- **Tree_Canvas**: Area ReactFlow di halaman `/tree` yang menampilkan visualisasi pohon keluarga.
- **HeirBadge**: Overlay komponen yang ditampilkan di atas node ahli waris di Tree_Canvas untuk menunjukkan persentase bagian.
- **BlockedOverlay**: Overlay abu-abu yang ditampilkan di atas node yang terkena Hajb_Hirman.
- **Inheritance_Case_DB**: Tabel `inheritance_cases` di Supabase yang menyimpan riwayat Kasus_Waris.

---

## Requirements

### Requirement 1: Aktivasi Mode Waris

**User Story:** Sebagai anggota keluarga terdaftar, saya ingin mengaktifkan Mode Waris dari halaman pohon keluarga, sehingga saya bisa memulai simulasi pembagian harta waris tanpa meninggalkan halaman tree.

#### Acceptance Criteria

1. THE `InheritanceModeToggle` SHALL menampilkan tombol "Mode Waris" di dalam komponen `TreeHeader` yang sudah ada.
2. WHEN pengguna mengklik tombol "Mode Waris", THE `Inheritance_Panel` SHALL muncul sebagai panel slide-in dari sisi kanan layar dengan lebar 380px, dengan posisi scroll dan level zoom Tree_Canvas tetap tidak berubah.
3. WHILE `Inheritance_Mode` aktif, THE `TreeHeader` SHALL menampilkan indikator visual dengan warna latar berbeda dan label "Mode Waris: Aktif" pada tombol untuk membedakan dari kondisi non-aktif.
4. WHEN pengguna mengklik tombol "Mode Waris" kedua kali saat `Inheritance_Mode` aktif, THE `Inheritance_Panel` SHALL menutup dan semua overlay serta highlight tambahan di Tree_Canvas SHALL dihapus.
5. WHEN pengguna mengklik tombol close (×) di `Inheritance_Panel`, THE `Inheritance_Panel` SHALL menutup dan semua overlay serta highlight tambahan di Tree_Canvas SHALL dihapus.
6. WHILE `Inheritance_Mode` aktif, THE Tree_Canvas SHALL tetap dapat di-scroll, di-zoom, dan di-klik node-nya secara normal.
7. IF pengguna belum terautentikasi atau tidak memiliki node di dalam family tree, THEN THE `InheritanceModeToggle` SHALL menonaktifkan tombol "Mode Waris" (disabled state) dan menampilkan tooltip penjelasan.
8. IF pengguna sudah terautentikasi dan memiliki minimal satu node di family tree, THEN THE `InheritanceModeToggle` SHALL menampilkan tombol "Mode Waris" dalam kondisi aktif dan dapat diklik.

---

### Requirement 2: Pemilihan Pewaris

**User Story:** Sebagai pengguna, saya ingin memilih anggota keluarga yang telah wafat sebagai pewaris dari visualisasi tree, sehingga sistem dapat mengetahui titik awal traversal graph untuk menemukan ahli waris.

#### Acceptance Criteria

1. WHILE `Inheritance_Mode` aktif, THE `DeceasedSelector` SHALL menampilkan instruksi teks "Klik node anggota keluarga yang telah wafat untuk memulai" di dalam `Inheritance_Panel`.
2. WHILE `Inheritance_Mode` aktif dan belum ada pewaris dipilih, THE Tree_Canvas SHALL mengubah kursor menjadi pointer dan menampilkan opacity 80% pada node saat di-hover untuk menginstruksikan pengguna.
3. WHILE `Inheritance_Mode` aktif, WHEN pengguna mengklik sebuah node di Tree_Canvas, THE `DeceasedSelector` SHALL menampilkan dialog konfirmasi yang berisi nama anggota keluarga tersebut dan tombol "Pilih sebagai Pewaris" serta "Batal".
4. WHEN pengguna mengkonfirmasi pemilihan pewaris, THE `DeceasedSelector` SHALL memvalidasi bahwa node yang dipilih memiliki nilai `is_alive = false` di data node.
5. IF node yang dipilih pengguna memiliki nilai `is_alive = true`, THEN THE `DeceasedSelector` SHALL menampilkan pesan error "Anggota keluarga ini masih hidup. Hanya anggota yang telah wafat yang dapat dipilih sebagai pewaris." dan membatalkan pemilihan.
6. WHEN pengguna mengklik tombol "Batal" pada dialog konfirmasi, THE dialog SHALL menutup dan canvas kembali ke kondisi semula tanpa pewaris terpilih.
7. WHEN pemilihan pewaris berhasil divalidasi, THE `Inheritance_Panel` SHALL beralih ke langkah verifikasi ahli waris.
8. WHEN pemilihan pewaris berhasil divalidasi, THE node pewaris di Tree_Canvas SHALL mendapatkan highlight visual berupa border 3px dengan warna berbeda dari border relasi keluarga standar.
9. WHEN `DeceasedSelector` siap menampilkan data pewaris yang dipilih, THE `DeceasedSelector` SHALL menampilkan nama, foto (jika ada), dan informasi gender pewaris yang dipilih di dalam panel.

---

### Requirement 3: Traversal Graph Otomatis dan Verifikasi Ahli Waris

**User Story:** Sebagai pengguna, saya ingin sistem secara otomatis menemukan ahli waris dari graph keluarga yang sudah ada, sehingga saya tidak perlu memasukkan data ahli waris secara manual satu per satu.

#### Acceptance Criteria

1. WHEN pewaris dikonfirmasi, THE `Faraidh_Engine` SHALL melakukan traversal terhadap tabel `marriages`, `parent_child_relations`, dan `nuclear_families` menggunakan `node_id` pewaris sebagai titik awal untuk menemukan semua calon ahli waris yang relevan.
2. THE `Faraidh_Engine` SHALL mengidentifikasi relasi ahli waris berikut dari hasil traversal: suami/istri aktif (status `married`), anak kandung (laki-laki dan perempuan), ayah kandung, dan ibu kandung.
3. IF tidak ada anak kandung dan tidak ada orang tua pewaris yang ditemukan, THEN THE `Faraidh_Engine` SHALL mengidentifikasi saudara kandung pewaris dari traversal `parent_child_relations` yang sama.
4. IF ada anak laki-laki pewaris yang ditemukan, THEN THE `Faraidh_Engine` SHALL menerapkan Hajb_Hirman dan mengecualikan kakek paternal dari daftar ahli waris aktif.
5. IF ada anak (laki-laki atau perempuan) pewaris yang ditemukan, THEN THE `Faraidh_Engine` SHALL menerapkan Hajb_Hirman dan mengecualikan saudara kandung dari daftar ahli waris aktif.
6. WHEN traversal selesai, THE `HeirVerifier` SHALL menampilkan daftar ahli waris yang ditemukan beserta relasi mereka kepada pewaris (misal: "Anak laki-laki", "Istri ke-1", "Ibu kandung").
7. THE `HeirVerifier` SHALL menampilkan setiap ahli waris dengan toggle status — default menggunakan nilai `is_alive` dari data node, dan jika nilai `is_alive` tidak tersedia pada node tersebut maka default toggle SHALL menampilkan "Masih Hidup".
8. WHEN pengguna mengubah toggle seorang ahli waris menjadi "Sudah Wafat", THE `HeirVerifier` SHALL menandai ahli waris tersebut sebagai tidak aktif dan menghapusnya dari perhitungan tanpa mengubah data permanen di database.
9. WHEN daftar ahli waris ditampilkan, THE `HeirVerifier` SHALL menampilkan ringkasan jumlah ahli waris aktif sebelum pengguna melanjutkan ke langkah input harta.
10. IF traversal tidak menemukan ahli waris yang valid, THEN THE `HeirVerifier` SHALL menampilkan pesan yang menginstruksikan pengguna untuk melengkapi data relasi keluarga di halaman tree sebelum menjalankan simulasi.
11. IF pewaris adalah pria dan traversal menemukan lebih dari satu istri berstatus `married`, THEN THE `HeirVerifier` SHALL menampilkan semua istri aktif dalam daftar dan menandainya masing-masing dengan label "Istri ke-N" sesuai urutan pernikahan.

---

### Requirement 4: Input Harta dan Kalkulasi

**User Story:** Sebagai pengguna, saya ingin memasukkan nilai harta peninggalan pewaris dan mendapatkan hasil pembagian yang dihitung otomatis sesuai hukum faraidh, sehingga saya bisa mengetahui berapa bagian masing-masing ahli waris.

#### Acceptance Criteria

1. THE `EstateInputForm` SHALL menampilkan tiga field input numerik dalam satuan Rupiah: "Harta Bruto (Rp)", "Total Hutang (Rp)", dan "Wasiat (Rp)" dengan nilai default 0.
2. WHEN pengguna mengubah nilai di salah satu field input harta, THE `EstateInputForm` SHALL memperbarui tampilan nilai Harta_Bersih = Harta Bruto − Hutang − Wasiat dalam waktu ≤ 300ms.
3. IF nilai Wasiat melebihi 1/3 dari Harta Bruto, THEN THE `EstateInputForm` SHALL menampilkan peringatan dan secara otomatis membatasi nilai field Wasiat menjadi tepat 1/3 dari Harta Bruto yang diinput.
4. IF nilai Harta_Bersih kurang dari atau sama dengan nol, THEN THE `EstateInputForm` SHALL menonaktifkan tombol "Hitung Waris" dan menampilkan pesan kesalahan yang menjelaskan alasan.
5. IF pengguna memasukkan nilai negatif atau karakter non-numerik pada field input, THEN THE `EstateInputForm` SHALL menolak input tersebut dan menampilkan pesan validasi.
6. WHEN pengguna mengklik "Hitung Waris" dengan Harta_Bersih lebih dari nol, THE `Faraidh_Engine` SHALL menghasilkan hasil kalkulasi yang mencakup bagian setiap ahli waris aktif.
7. THE `Faraidh_Engine` SHALL memastikan hasil kalkulasi tidak memiliki kesalahan pembulatan sehingga total semua bagian tepat sama dengan Harta_Bersih dalam representasi numerik yang digunakan.
8. WHEN kalkulasi selesai dan kondisi Aul terdeteksi, THE `Faraidh_Engine` SHALL menghasilkan bagian yang sudah dikurangi secara proporsional dan THE `InheritanceResultPanel` SHALL menampilkan catatan bahwa 'Aul terjadi.
9. WHEN kalkulasi selesai dan kondisi Aul terdeteksi, THE `InheritanceResultPanel` SHALL menampilkan catatan: "Terjadi 'Aul: total bagian fardh melebihi harta, semua bagian dikurangi secara proporsional."
10. WHEN kalkulasi selesai dan kondisi Radd terdeteksi, THE `Faraidh_Engine` SHALL mendistribusikan sisa harta secara proporsional kepada ahli waris yang berhak.
11. WHEN kalkulasi selesai dan kondisi Radd terdeteksi, THE `InheritanceResultPanel` SHALL menampilkan catatan: "Terjadi Radd: sisa harta dikembalikan secara proporsional."
12. WHEN kalkulasi selesai, THE `InheritanceResultPanel` SHALL menampilkan tabel hasil berisi: nama ahli waris, relasi ke pewaris, dasar hukum (misal: "Ashhabul Furudh — 1/4"), persentase bagian, dan nominal dalam Rupiah yang diformat dengan pemisah ribuan.
13. WHEN pewaris pria memiliki lebih dari satu istri aktif, THE `Faraidh_Engine` SHALL membagi bagian istri (1/4 atau 1/8) secara rata di antara semua istri aktif.
14. WHEN anak laki-laki dan anak perempuan sama-sama ada sebagai Ashabah, THE `Faraidh_Engine` SHALL menghitung bagian dengan rasio 2:1 (anak laki-laki mendapat dua kali bagian anak perempuan).
15. THE `InheritanceResultPanel` SHALL menampilkan disclaimer: "⚠️ Hasil ini adalah simulasi edukatif. Untuk kepastian hukum, konsultasikan dengan ulama atau ahli faraidh yang kompeten."

---

### Requirement 5: Penanganan Aturan Hajb

**User Story:** Sebagai pengguna, saya ingin sistem secara otomatis menerapkan aturan hajb (penghalang) antar ahli waris, sehingga pembagian waris yang dihasilkan sesuai dengan hukum Islam yang berlaku.

#### Acceptance Criteria

1. THE `Faraidh_Engine` SHALL menerapkan aturan Hajb_Hirman berikut sesuai mazhab Syafi'i: keberadaan anak kandung (laki atau perempuan) menghalangi saudara kandung; keberadaan ayah kandung menghalangi kakek paternal; keberadaan anak laki-laki menghalangi saudari kandung dari memperoleh bagian sebagai Ashhabul_Furudh maupun sebagai Ashabah ma'al ghair.
2. THE `Faraidh_Engine` SHALL menerapkan aturan Hajb_Nuqshan berikut: keberadaan anak kandung mengubah bagian ibu dari 1/3 menjadi 1/6; keberadaan anak kandung mengubah bagian suami dari 1/2 menjadi 1/4; keberadaan anak kandung mengubah bagian istri dari 1/4 menjadi 1/8.
3. WHEN seorang ahli waris terkena Hajb_Hirman, THE `Faraidh_Engine` SHALL mengeluarkan ahli waris tersebut dari daftar aktif dan mencatat relasi ahli waris yang menjadi penyebab hajb (misal: "Terhajb oleh anak laki-laki").
4. WHEN kalkulasi selesai dan terdapat ahli waris yang terkena Hajb_Hirman, THE `InheritanceResultPanel` SHALL menampilkan section terpisah "Ahli Waris Terhajb" berisi nama ahli waris yang terhalang beserta penjelasan hajb dalam Bahasa Indonesia.
5. WHEN kalkulasi selesai dan tidak ada ahli waris yang terkena Hajb_Hirman, THE `InheritanceResultPanel` SHALL tidak menampilkan section "Ahli Waris Terhajb".
6. THE `InheritanceLegalDetail` SHALL dapat dibuka dari setiap baris hasil kalkulasi (baik ahli waris aktif maupun terhajb) dan SHALL menampilkan dasar hukum dari Al-Qur'an Surat An-Nisa atau Surat An-Nisa ayat 176, nama konsep hukum yang berlaku (misal: "Hajb Hirman"), serta penjelasan mengapa ahli waris tersebut mendapat atau tidak mendapat bagian, semua dalam Bahasa Indonesia.

---

### Requirement 6: Animasi Visual di Tree Canvas

**User Story:** Sebagai pengguna, saya ingin melihat animasi visual di canvas pohon keluarga yang menunjukkan aliran pembagian harta dari pewaris ke ahli waris, sehingga saya dapat memahami hasil waris secara intuitif.

#### Acceptance Criteria

1. WHEN pengguna mengklik tombol "Tampilkan Animasi" setelah kalkulasi selesai, THE `useInheritanceAnimation` SHALL menjalankan urutan animasi sequential: highlight node pewaris selama 500ms, kemudian tampilkan `AnimatedInheritanceEdge` dari pewaris ke setiap ahli waris aktif satu per satu dengan jeda 300ms antar edge, kemudian tampilkan `HeirBadge` di atas setiap node ahli waris.
2. IF pengguna mengklik tombol "Tampilkan Animasi" sebelum kalkulasi selesai, THEN THE tombol SHALL dalam kondisi disabled dan tidak menjalankan animasi.
3. THE `AnimatedInheritanceEdge` SHALL memiliki warna dan gaya stroke yang berbeda secara visual dari edge relasi keluarga yang sudah ada di canvas, sehingga pengguna dapat membedakan keduanya tanpa ambiguitas.
4. THE `HeirBadge` SHALL menampilkan nama ahli waris ditruncate maksimal 20 karakter, persentase bagian dalam format "XX.XX%", dan nominal Rupiah diformat dengan pemisah ribuan serta disingkat (jt/M/T) untuk nilai besar.
5. WHEN seorang ahli waris terkena Hajb_Hirman selama animasi berjalan, THE `BlockedNodeOverlay` SHALL ditampilkan di atas node tersebut dengan opacity 60% dan label "Terhajb".
6. WHEN seluruh urutan animasi selesai dijalankan, THE `InheritanceSummaryOverlay` SHALL muncul di sudut kiri atas Tree_Canvas sebagai ringkasan: total ahli waris aktif, total harta bersih, dan status Aul/Radd.
7. WHEN pengguna mengklik tombol "Reset Animasi", THE `useInheritanceAnimation` SHALL menghapus semua `HeirBadge`, `BlockedNodeOverlay`, `AnimatedInheritanceEdge`, dan `InheritanceSummaryOverlay` dari canvas tanpa mengubah node atau edge relasi keluarga yang sudah ada.
8. WHILE animasi berjalan, THE `Inheritance_Panel` SHALL menampilkan progress indicator dan tombol "Hentikan Animasi", dan WHEN pengguna mengklik tombol tersebut THE animasi SHALL berhenti dalam waktu ≤ 300ms.

---

### Requirement 7: Penyimpanan dan Riwayat Kasus Waris

**User Story:** Sebagai pengguna, saya ingin menyimpan hasil kalkulasi waris dan melihat riwayat kasus yang pernah dihitung, sehingga saya bisa merujuk kembali ke hasil sebelumnya kapan saja.

#### Acceptance Criteria

1. WHEN pengguna mengklik "Simpan Kasus" setelah kalkulasi selesai, THE sistem SHALL menyimpan kasus waris beserta data pewaris, nilai harta, dan daftar ahli waris ke penyimpanan permanen.
2. WHEN penyimpanan kasus dilakukan, THE sistem SHALL menyimpan detail bagian setiap ahli waris termasuk jenis relasi, dasar hukum, pecahan bagian, persentase, dan nominal.
3. WHEN penyimpanan berhasil, THE `Inheritance_Panel` SHALL menampilkan konfirmasi keberhasilan dan memberi opsi langsung menuju export PDF.
4. WHEN penyimpanan gagal karena error, THE `Inheritance_Panel` SHALL menampilkan pesan kegagalan yang deskriptif dan menawarkan opsi untuk mencoba ulang.
5. WHEN pengguna membuka tab "Riwayat" di `Inheritance_Panel`, THE panel SHALL menampilkan daftar kasus waris yang pernah disimpan oleh pengguna, diurutkan dari yang terbaru, dengan maksimal 50 item per halaman.
6. WHEN pengguna memilih kasus dari daftar riwayat, THE `Inheritance_Panel` SHALL memuat ulang hasil kalkulasi kasus tersebut dalam waktu ≤ 3 detik, tanpa perlu menghitung ulang.
7. IF gagal memuat data kasus dari riwayat, THEN THE `Inheritance_Panel` SHALL menampilkan pesan kegagalan yang deskriptif dan menawarkan opsi untuk mencoba ulang.
8. WHEN pengguna mengklik tombol hapus di item riwayat, THE sistem SHALL menampilkan dialog konfirmasi yang menyebutkan nama pewaris kasus tersebut sebelum melanjutkan penghapusan.
9. WHEN pengguna mengkonfirmasi penghapusan kasus, THE sistem SHALL menghapus kasus tersebut dari penyimpanan, dan WHEN penghapusan gagal THE sistem SHALL menampilkan pesan kegagalan yang deskriptif.
10. THE sistem SHALL memastikan bahwa pengguna hanya dapat melihat dan mengubah kasus waris milik keluarganya sendiri, dan tidak dapat mengakses kasus milik keluarga lain meski mengetahui ID kasusnya.

---

### Requirement 8: Export PDF dan Berbagi

**User Story:** Sebagai pengguna, saya ingin mengekspor hasil kalkulasi waris ke PDF dan membagikannya ke anggota keluarga lain, sehingga semua anggota keluarga dapat memiliki dokumen yang sama.

#### Acceptance Criteria

1. WHEN pengguna mengklik "Export PDF" pada kasus yang sudah tersimpan, THE sistem SHALL menghasilkan dan mengunduh dokumen PDF yang berisi: nama pewaris, tanggal kalkulasi, ringkasan harta, tabel pembagian per ahli waris (relasi, dasar hukum, persentase, nominal Rupiah), daftar ahli waris terhajb (jika ada), status Aul/Radd (jika ada), dan disclaimer konsultasi ulama.
2. THE PDF SHALL menggunakan header dengan format "Dokumen Simulasi Faraidh — [Nama Pewaris] — [Tanggal]" dan seluruh isi dokumen ditulis dalam Bahasa Indonesia.
3. WHEN pengguna mengklik "Bagikan ke Keluarga", THE sistem SHALL mengirim notifikasi in-app ke semua anggota keluarga yang berada dalam kelompok keluarga yang sama dengan pengguna yang berbagi.
4. WHEN notifikasi bagikan diterima oleh anggota keluarga, THE notifikasi SHALL menampilkan identitas pewaris yang relevan dan menyertakan tautan yang dapat diklik untuk melihat detail kasus waris tersebut.
5. THE PDF SHALL selalu menyertakan disclaimer: "Dokumen ini adalah hasil simulasi komputasional berdasarkan data pohon keluarga digital. Hasilnya bersifat edukatif dan tidak memiliki kekuatan hukum. Konsultasikan dengan ulama atau ahli waris yang berkompeten untuk kepastian hukum."
6. IF kasus waris belum disimpan ke database saat pengguna mengklik "Export PDF", THEN THE sistem SHALL menampilkan prompt untuk menyimpan kasus terlebih dahulu sebelum dapat mengunduh PDF.

---

### Requirement 9: Keamanan dan Privasi Data Waris

**User Story:** Sebagai anggota keluarga, saya ingin data waris yang saya kalkulasi hanya dapat dilihat oleh anggota keluarga yang sama, sehingga informasi sensitif tentang harta tidak bocor ke pihak yang tidak berwenang.

#### Acceptance Criteria

1. THE endpoint untuk mengambil daftar kasus waris SHALL hanya mengembalikan kasus yang terhubung dengan keluarga dari pengguna yang sedang terautentikasi, berdasarkan keanggotaan nuclear family atau extended group.
2. WHEN pengguna mengakses detail kasus waris tertentu dan pengguna tersebut tidak memiliki keanggotaan keluarga yang beririsan dengan pewaris dalam kasus itu, THEN THE sistem SHALL mengembalikan respons HTTP 403.
3. WHEN endpoint kalkulasi menerima permintaan traversal, THE sistem SHALL memvalidasi bahwa node pewaris yang diminta berada dalam graph keluarga yang sama dengan pengguna terautentikasi sebelum melakukan traversal.
4. IF permintaan ke endpoint faraidh dilakukan tanpa autentikasi yang valid, THEN THE API SHALL mengembalikan respons HTTP 401.
5. WHEN permintaan berbagi kasus dikirimkan, THE sistem SHALL memvalidasi bahwa calon penerima notifikasi memiliki keanggotaan extended group yang beririsan dengan pengirim sebelum mengirimkan notifikasi.

---

### Requirement 10: Validasi Skenario Waris Kritis (Uji Kebenaran Hukum)

**User Story:** Sebagai pengembang dan pengguna, saya ingin Faraidh_Engine menghasilkan hasil yang benar secara hukum untuk skenario-skenario standar yang sudah diketahui jawabannya, sehingga pengguna dapat mempercayai keakuratan sistem.

#### Acceptance Criteria

1. WHEN kalkulasi dijalankan dengan input: pewaris wanita, ahli waris = suami (1 orang) + 1 anak perempuan, THEN THE `Faraidh_Engine` SHALL menghasilkan: suami mendapat 1/4, anak perempuan mendapat 1/2, dan sisa 1/4 dikembalikan via Radd kepada suami dan anak perempuan secara proporsional.
2. WHEN kalkulasi dijalankan dengan input: pewaris pria, ahli waris = istri (1 orang) + 2 anak laki-laki + 1 anak perempuan, THEN THE `Faraidh_Engine` SHALL menghasilkan: istri mendapat 1/8 dari harta bersih, anak laki-laki dan anak perempuan membagi sisa 7/8 dengan rasio 2:1 (masing-masing anak laki mendapat dua kali bagian anak perempuan).
3. WHEN kalkulasi dijalankan dengan input: pewaris pria, ahli waris = hanya 1 anak perempuan (tidak ada ahli waris lain), THEN THE `Faraidh_Engine` SHALL menghasilkan: anak perempuan mendapat 1/2 sebagai fardh ditambah sisa 1/2 via Radd, sehingga anak perempuan menerima 100% dari harta bersih.
4. WHEN kalkulasi dijalankan dengan input: pewaris wanita, ahli waris = ayah + ibu + suami (tanpa anak), THEN THE `Faraidh_Engine` SHALL menghasilkan: suami mendapat 1/2, ibu mendapat 1/3, ayah mendapat sisa sebagai Ashabah (1/6).
5. WHEN kalkulasi dijalankan dengan input: pewaris wanita, ahli waris = suami + 2 saudara perempuan + ibu (tanpa anak dan tanpa ayah), THEN THE `Faraidh_Engine` SHALL mendeteksi kondisi Aul, menaikkan asal masalah dari 6 ke 7, dan menghasilkan bagian yang telah dikurangi secara proporsional untuk seluruh ahli waris.
6. WHEN kalkulasi dijalankan dengan input: pewaris pria, ahli waris = 2 istri aktif + 3 anak laki-laki (tanpa anak perempuan), THEN THE `Faraidh_Engine` SHALL menghasilkan: kedua istri berbagi 1/8 secara rata (masing-masing 1/16 dari harta bersih), ketiga anak laki-laki membagi sisa 7/8 secara rata.
7. WHEN kalkulasi dijalankan dengan input: pewaris pria, ahli waris = 1 anak laki-laki + kakek paternal (ayah dari ayah pewaris), THEN THE `Faraidh_Engine` SHALL menetapkan: anak laki-laki mendapat seluruh sisa sebagai Ashabah, kakek paternal berstatus Hajb_Hirman oleh anak laki-laki dan mendapat 0 rupiah.
8. THE `Faraidh_Engine` SHALL untuk semua skenario di atas memastikan bahwa jumlah nominal seluruh ahli waris aktif (setelah Aul atau Radd diterapkan) tepat sama dengan nilai Harta_Bersih yang diinput, tanpa selisih sekecil apapun.

---

### Requirement 11: Parsing dan Representasi Pecahan (Parser Faraidh)

**User Story:** Sebagai pengembang, saya ingin Faraidh_Engine menggunakan representasi pecahan yang presisi dan dapat di-parse/di-print ulang secara konsisten, sehingga tidak ada kesalahan pembulatan dalam seluruh alur kalkulasi.

#### Acceptance Criteria

1. THE `Fraction` module SHALL merepresentasikan setiap bagian waris sebagai pasangan integer `{numerator, denominator}` dalam bentuk yang sudah disederhanakan di mana GCD(numerator, denominator) = 1 dan denominator selalu positif.
2. THE `Fraction` module SHALL mendukung operasi penjumlahan, pengurangan, perkalian, pembagian, dan perbandingan antara dua Fraction, dan setiap operasi SHALL menghasilkan Fraction baru yang sudah disederhanakan.
3. THE `Fraction` module SHALL menyediakan fungsi `fractionToString` yang menghasilkan representasi string dalam format "pembilang/penyebut" (misal "1/4", "3/8").
4. THE `Fraction` module SHALL menyediakan fungsi `parseFraction` yang menerima string format "pembilang/penyebut" dan menghasilkan Fraction yang merepresentasikan nilai yang sama.
5. FOR ALL Fraction `f` yang valid, THE `Fraction` module SHALL memenuhi properti round-trip: `parseFraction(fractionToString(f))` SHALL menghasilkan Fraction yang ekuivalen dengan `f` (numerator dan denominator identik setelah disederhanakan).
6. IF operasi pada `Fraction` menghasilkan denominator bernilai nol, THEN THE module SHALL melempar error `InvalidFractionError` dengan pesan yang mendeskripsikan operasi yang menyebabkan error tersebut.
