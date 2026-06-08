"use client";

import { useState, useRef, useEffect } from 'react';
import { IconChevronDown, IconSearch } from '@tabler/icons-react';
import { Label } from '@/components/ui/label';

interface LocationPickerProps {
  value: { province: string; city: string };
  onChange: (val: { province: string; city: string }) => void;
  label?: string;
  required?: boolean;
}

const INDONESIA_REGIONS: Record<string, string[]> = {
  "Aceh": ["Banda Aceh", "Langsa", "Lhokseumawe", "Sabang", "Subulussalam"],
  "Sumatera Utara": ["Medan", "Binjai", "Gunungsitoli", "Padangsidimpuan", "Pematangsiantar", "Sibolga", "Tanjungbalai", "Tebing Tinggi"],
  "Sumatera Barat": ["Padang", "Bukittinggi", "Padang Panjang", "Pariaman", "Payakumbuh", "Sawahlunto", "Solok"],
  "Riau": ["Pekanbaru", "Dumai"],
  "Kepulauan Riau": ["Tanjungpinang", "Batam"],
  "Jambi": ["Jambi", "Sungai Penuh"],
  "Sumatera Selatan": ["Palembang", "Lubuklinggau", "Pagaralam", "Prabumulih"],
  "Kepulauan Bangka Belitung": ["Pangkalpinang"],
  "Bengkulu": ["Bengkulu"],
  "Lampung": ["Bandar Lampung", "Metro"],
  "DKI Jakarta": ["Jakarta Pusat", "Jakarta Utara", "Jakarta Barat", "Jakarta Selatan", "Jakarta Timur"],
  "Jawa Barat": ["Bandung", "Bekasi", "Bogor", "Cimahi", "Cirebon", "Depok", "Sukabumi", "Tasikmalaya"],
  "Banten": ["Cilegon", "Serang", "Tangerang", "Tangerang Selatan"],
  "Jawa Tengah": ["Semarang", "Magelang", "Pekalongan", "Purwokerto", "Salatiga", "Solo", "Tegal"],
  "DI Yogyakarta": ["Yogyakarta", "Sleman", "Bantul", "Gunungkidul", "Kulon Progo"],
  "Jawa Timur": ["Surabaya", "Batu", "Blitar", "Kediri", "Madiun", "Malang", "Mojokerto", "Pasuruan", "Probolinggo"],
  "Bali": ["Denpasar"],
  "Nusa Tenggara Barat": ["Mataram", "Bima"],
  "Nusa Tenggara Timur": ["Kupang"],
  "Kalimantan Barat": ["Pontianak", "Singkawang"],
  "Kalimantan Tengah": ["Palangka Raya"],
  "Kalimantan Selatan": ["Banjarbaru", "Banjarmasin"],
  "Kalimantan Timur": ["Balikpapan", "Bontang", "Samarinda"],
  "Kalimantan Utara": ["Tarakan"],
  "Sulawesi Utara": ["Bitung", "Kotamobagu", "Manado", "Tomohon"],
  "Gorontalo": ["Gorontalo"],
  "Sulawesi Tengah": ["Palu"],
  "Sulawesi Barat": ["Mamuju"],
  "Sulawesi Selatan": ["Makassar", "Palopo", "Parepare"],
  "Sulawesi Tenggara": ["Bau-Bau", "Kendari"],
  "Maluku": ["Ambon", "Tual"],
  "Maluku Utara": ["Ternate", "Tidore Kepulauan"],
  "Papua": ["Jayapura"],
  "Papua Barat": ["Sorong", "Manokwari"]
};

export default function LocationPicker({ value, onChange, label, required }: LocationPickerProps) {
  const [openProvince, setOpenProvince] = useState(false);
  const [openCity, setOpenCity] = useState(false);
  const [searchProvince, setSearchProvince] = useState('');
  const [searchCity, setSearchCity] = useState('');
  const provinceRef = useRef<HTMLDivElement>(null);
  const cityRef = useRef<HTMLDivElement>(null);

  const provinces = Object.keys(INDONESIA_REGIONS);
  const cities = value.province ? INDONESIA_REGIONS[value.province] || [] : [];

  const filteredProvinces = provinces.filter(p => 
    p.toLowerCase().includes(searchProvince.toLowerCase())
  );
  const filteredCities = cities.filter(c => 
    c.toLowerCase().includes(searchCity.toLowerCase())
  );

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (provinceRef.current && !provinceRef.current.contains(e.target as Node)) {
        setOpenProvince(false);
      }
      if (cityRef.current && !cityRef.current.contains(e.target as Node)) {
        setOpenCity(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleProvinceChange = (province: string) => {
    onChange({ province, city: '' });
    setSearchProvince('');
    setOpenProvince(false);
  };

  const handleCityChange = (city: string) => {
    onChange({ ...value, city });
    setSearchCity('');
    setOpenCity(false);
  };

  return (
    <div className="space-y-3">
      {label && (
        <Label className="text-[#3B2F1E]">{label}{required && ' *'}</Label>
      )}
      
      <div ref={provinceRef} className="relative">
        <Label className="text-[11px] uppercase tracking-wide text-[#9C8B75] block mb-1">Provinsi</Label>
        <button
          type="button"
          onClick={() => setOpenProvince(!openProvince)}
          className="w-full flex items-center justify-between bg-[#EDE4D3] border border-[#D4C4A8] rounded-lg px-3 py-2 text-left"
        >
          <span className={`text-[13px] ${value.province ? 'text-[#3B2F1E]' : 'text-[#9C8B75]'}`}>
            {value.province || 'Pilih provinsi...'}
          </span>
          <IconChevronDown 
            className={`w-4 h-4 text-[#9C8B75] transition-transform ${openProvince ? 'rotate-180' : ''}`} 
          />
        </button>

        {openProvince && (
          <div className="absolute top-full left-0 w-full bg-[#FDFAF5] border border-[#D4C4A8] rounded-lg shadow-sm mt-1 max-h-48 overflow-y-auto z-10">
            <div className="sticky top-0 bg-[#F5F0E8] border-b border-[#D4C4A8] px-2 py-1">
              <div className="relative">
                <IconSearch className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-[#9C8B75]" />
                <input
                  type="text"
                  value={searchProvince}
                  onChange={(e) => setSearchProvince(e.target.value)}
                  placeholder="Cari..."
                  className="w-full pl-7 pr-2 py-1 text-[12px] text-[#3B2F1E] bg-transparent outline-none"
                />
              </div>
            </div>
            {filteredProvinces.map(province => (
              <button
                key={province}
                type="button"
                onClick={() => handleProvinceChange(province)}
                className={`w-full px-3 py-2 text-left text-[13px] transition-colors ${
                  value.province === province 
                    ? 'bg-[#D6EAD9] text-[#2E5239] font-medium' 
                    : 'text-[#3B2F1E] hover:bg-[#EDE4D3]'
                }`}
              >
                {province}
              </button>
            ))}
          </div>
        )}
      </div>

      <div ref={cityRef} className="relative">
        <Label className="text-[11px] uppercase tracking-wide text-[#9C8B75] block mb-1">Kota/Kabupaten</Label>
        <button
          type="button"
          onClick={() => setOpenCity(!openCity)}
          disabled={!value.province}
          className={`w-full flex items-center justify-between bg-[#EDE4D3] border border-[#D4C4A8] rounded-lg px-3 py-2 text-left ${!value.province ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <span className={`text-[13px] ${value.city ? 'text-[#3B2F1E]' : 'text-[#9C8B75]'}`}>
            {value.city || 'Pilih kota/kabupaten...'}
          </span>
          <IconChevronDown 
            className={`w-4 h-4 text-[#9C8B75] transition-transform ${openCity ? 'rotate-180' : ''}`} 
          />
        </button>

        {openCity && value.province && (
          <div className="absolute top-full left-0 w-full bg-[#FDFAF5] border border-[#D4C4A8] rounded-lg shadow-sm mt-1 max-h-48 overflow-y-auto z-10">
            <div className="sticky top-0 bg-[#F5F0E8] border-b border-[#D4C4A8] px-2 py-1">
              <div className="relative">
                <IconSearch className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-[#9C8B75]" />
                <input
                  type="text"
                  value={searchCity}
                  onChange={(e) => setSearchCity(e.target.value)}
                  placeholder="Cari..."
                  className="w-full pl-7 pr-2 py-1 text-[12px] text-[#3B2F1E] bg-transparent outline-none"
                />
              </div>
            </div>
            {filteredCities.map(city => (
              <button
                key={city}
                type="button"
                onClick={() => handleCityChange(city)}
                className={`w-full px-3 py-2 text-left text-[13px] transition-colors ${
                  value.city === city 
                    ? 'bg-[#D6EAD9] text-[#2E5239] font-medium' 
                    : 'text-[#3B2F1E] hover:bg-[#EDE4D3]'
                }`}
              >
                {city}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}