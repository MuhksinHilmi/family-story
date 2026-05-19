import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Users, TreePine, MessageCircle, FileText, Shield, Share2 } from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      {/* Navigation */}
      <nav className="container mx-auto px-4 py-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <TreePine className="h-8 w-8 text-primary" />
            <span className="text-2xl font-bold text-gray-900">CeritaKeluarga</span>
          </div>
          <div className="flex gap-3">
            <Button asChild variant="ghost">
              <Link href="/auth/login">Masuk</Link>
            </Button>
            <Button asChild>
              <Link href="/auth/register">Daftar Gratis</Link>
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center px-4 py-2 bg-primary/10 rounded-full text-primary text-sm font-medium mb-6">
            <Shield className="h-4 w-4 mr-2" />
            Platform Silsilah Keluarga Muslim Terpercaya
          </div>
          
          <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6 leading-tight">
            Keluarga yang Terhubung,
            <span className="text-primary"> Cerita yang Terjaga</span>
          </h1>
          
          <p className="text-xl text-gray-600 mb-10 max-w-2xl mx-auto">
            Buat pohon keluarga digital, simpan kenangan berharga, dan nikmati komunikasi 
            khusus keluarga dalam satu platform yang aman dan mudah digunakan.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
            <Button asChild size="lg" className="text-lg px-8">
              <Link href="/auth/register">Mulai Buat Pohon Keluarga</Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="text-lg px-8">
              <Link href="/auth/login">Masuk ke Akun Anda</Link>
            </Button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-2xl mx-auto">
            <div className="text-center">
              <div className="text-3xl font-bold text-primary">1000+</div>
              <div className="text-gray-600">Keluarga Terdaftar</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-primary">150+</div>
              <div className="text-gray-600">Provinsi Dikelola</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-primary">5000+</div>
              <div className="text-gray-600">Anggota Terhubung</div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="bg-white py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Fitur Unggulan Kami
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Semua yang Anda butuhkan untuk mengelola dan memelihara hubungan keluarga
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-8 text-center hover:shadow-lg transition-shadow">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <TreePine className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Pohon Keluarga Interaktif</h3>
              <p className="text-gray-600">
                Visualisasi silsilah keluarga secara interaktif dengan kemampuan zoom, drag, dan edit.
              </p>
            </div>

            <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-8 text-center hover:shadow-lg transition-shadow">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <MessageCircle className="h-8 w-8 text-green-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Chat Keluarga</h3>
              <p className="text-gray-600">
                Komunikasi pribadi khusus anggota keluarga dengan grup chat dan broadcast.
              </p>
            </div>

            <div className="bg-gradient-to-br from-purple-50 to-violet-50 rounded-2xl p-8 text-center hover:shadow-lg transition-shadow">
              <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <FileText className="h-8 w-8 text-purple-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Arsip Digital</h3>
              <p className="text-gray-600">
                Simpan dokumen penting, foto, dan kenangan keluarga dalam format digital yang aman.
              </p>
            </div>

            <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-2xl p-8 text-center hover:shadow-lg transition-shadow">
              <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="h-8 w-8 text-orange-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Manajemen Anggota</h3>
              <p className="text-gray-600">
                Undang anggota keluarga dengan mudah dan kelola izin akses secara fleksibel.
              </p>
            </div>

            <div className="bg-gradient-to-br from-red-50 to-pink-50 rounded-2xl p-8 text-center hover:shadow-lg transition-shadow">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Shield className="h-8 w-8 text-red-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Keamanan Terjamin</h3>
              <p className="text-gray-600">
                Data keluarga dilindungi dengan enkripsi end-to-end dan kontrol privasi ketat.
              </p>
            </div>

            <div className="bg-gradient-to-br from-cyan-50 to-sky-50 rounded-2xl p-8 text-center hover:shadow-lg transition-shadow">
              <div className="w-16 h-16 bg-cyan-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Share2 className="h-8 w-8 text-cyan-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Bagikan dengan Mudah</h3>
              <p className="text-gray-600">
                Ekspor pohon keluarga ke PDF, gambar, atau bagikan tautan khusus anggota.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-primary text-primary-foreground py-20">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Mulai Keluarga Digital Anda Hari Ini
          </h2>
          <p className="text-lg mb-8 opacity-90 max-w-2xl mx-auto">
            Bergabunglah dengan ribuan keluarga yang telah mengabadikan cerita mereka di CeritaKeluarga.
          </p>
          <Button asChild size="lg" variant="secondary" className="text-lg px-8">
            <Link href="/auth/register">Buat Akun Gratis Sekarang</Link>
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between">
            <div className="flex items-center space-x-2 mb-4 md:mb-0">
              <TreePine className="h-6 w-6" />
              <span className="text-xl font-bold">CeritaKeluarga</span>
            </div>
            <div className="text-gray-400 text-sm">
              © 2024 CeritaKeluarga. Semua hak dilindungi.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}