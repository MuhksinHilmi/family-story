"use client";

import { useState } from 'react';
import { IconSearch, IconCheck, IconBook, IconHome, IconBulb, IconHeartbeat, IconUsers, IconPalette, IconBriefcase, IconMap } from '@tabler/icons-react';

interface InterestPickerProps {
  selected: string[];
  onChange: (selected: string[]) => void;
  max?: number;
}

const INTEREST_CATEGORIES = [
  {
    id: 'ibadah',
    label: 'Ibadah & Agama',
    icon: 'IconBook',
    color: '#4A7C59',
    bgColor: '#D6EAD9',
    items: ["Tahsin Al-Qur'an", 'Kajian Hadits', 'Fiqih', 'Tahfidz', 'Kajian Tafsir', 'Sholat Berjamaah', 'Sedekah & Wakaf']
  },
  {
    id: 'keluarga',
    label: 'Keluarga & Rumah',
    icon: 'IconHome',
    color: '#8B6F47',
    bgColor: '#EDE3D6',
    items: ['Memasak', 'Berkebun', 'Dekorasi Rumah', 'Parenting', 'Menjahit', 'DIY & Kerajinan', 'Tanaman Hias']
  },
  {
    id: 'ilmu',
    label: 'Ilmu & Wawasan',
    icon: 'IconBulb',
    color: '#2A6E6A',
    bgColor: '#D4EDEC',
    items: ['Membaca Buku', 'Menulis', 'Podcast', 'Dokumenter', 'Belajar Bahasa', 'Sejarah Islam', 'Sains & Teknologi']
  },
  {
    id: 'kesehatan',
    label: 'Kesehatan & Olahraga',
    icon: 'IconHeartbeat',
    color: '#C4922A',
    bgColor: '#F5E8C8',
    items: ['Olahraga Rutin', 'Hiking', 'Renang', 'Bersepeda', 'Yoga', 'Memasak Sehat', 'Herbal & Thibbun Nabawi']
  },
  {
    id: 'sosial',
    label: 'Sosial & Komunitas',
    icon: 'IconUsers',
    color: '#6B5B45',
    bgColor: '#EDE4D3',
    items: ['Relawan', 'Pengajian Lingkungan', 'Kegiatan Sosial', 'Dakwah', 'Mentoring', 'Organisasi']
  },
  {
    id: 'kreatif',
    label: 'Seni & Kreativitas',
    icon: 'IconPalette',
    color: '#8B6F47',
    bgColor: '#EDE3D6',
    items: ['Fotografi', 'Desain Grafis', 'Kaligrafi', 'Musik Islami (Nasyid)', 'Konten Kreator', 'Ilustrasi', 'Kerajinan Tangan']
  },
  {
    id: 'produktif',
    label: 'Produktivitas & Karir',
    icon: 'IconBriefcase',
    color: '#2E5239',
    bgColor: '#D6EAD9',
    items: ['Wirausaha', 'Investasi Halal', 'Public Speaking', 'Kepemimpinan', 'Project Management', 'Freelance']
  },
  {
    id: 'alam',
    label: 'Alam & Perjalanan',
    icon: 'IconMap',
    color: '#4A7C59',
    bgColor: '#D6EAD9',
    items: ['Travelling', 'Camping', 'Bird Watching', 'Snorkeling', 'Wisata Islami', 'Road Trip']
  }
];

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  IconBook,
  IconHome,
  IconBulb,
  IconHeartbeat,
  IconUsers,
  IconPalette,
  IconBriefcase,
  IconMap
};

export default function InterestPicker({ selected, onChange, max = 10 }: InterestPickerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('semua');

  const allItems = INTEREST_CATEGORIES.flatMap(cat => cat.items);
  const filteredItems = allItems.filter(item => 
    item.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const isMaxReached = selected.length >= max;

  const handleToggle = (item: string) => {
    if (selected.includes(item)) {
      onChange(selected.filter(i => i !== item));
    } else if (!isMaxReached) {
      onChange([...selected, item]);
    }
  };

  const handleRemove = (item: string) => {
    onChange(selected.filter(i => i !== item));
  };

  const categoriesToShow = activeCategory === 'semua' 
    ? INTEREST_CATEGORIES 
    : INTEREST_CATEGORIES.filter(cat => cat.id === activeCategory);

  const getItemStyle = (cat: typeof INTEREST_CATEGORIES[0], isSelected: boolean) => {
    if (isSelected) {
      return cat.bgColor;
    }
    if (!isSelected && isMaxReached) {
      return 'bg-[#FDFAF5] text-[#6B5B45] border border-[#D4C4A8] opacity-40 cursor-not-allowed';
    }
    return 'bg-[#FDFAF5] text-[#6B5B45] border border-[#D4C4A8]';
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-wide text-[#9C8B75]">Minat & Hobi</span>
        <span className="text-[11px] text-[#9C8B75]">
          {isMaxReached ? 'Maksimum tercapai' : `${selected.length}/${max} dipilih`}
        </span>
      </div>

      <div className="relative">
        <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9C8B75]" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Cari minat..."
          className="w-full pl-10 pr-3 py-2 bg-[#EDE4D3] border border-[#D4C4A8] rounded-full text-[13px] text-[#3B2F1E] outline-none"
        />
      </div>

      {!searchQuery && (
        <div className="flex gap-2 overflow-x-auto pb-1 -mb-1 scrollbar-none">
          <button
            type="button"
            onClick={() => setActiveCategory('semua')}
            className={`px-3 py-1 rounded-full text-[11px] whitespace-nowrap transition-colors ${
              activeCategory === 'semua'
                ? 'bg-[#3B2F1E] text-white'
                : 'bg-[#FDFAF5] border border-[#D4C4A8] text-[#6B5B45]'
            }`}
          >
            Semua
          </button>
          {INTEREST_CATEGORIES.map(cat => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setActiveCategory(cat.id)}
              className={`px-3 py-1 rounded-full text-[11px] whitespace-nowrap transition-colors ${
                activeCategory === cat.id
                  ? 'bg-[#3B2F1E] text-white'
                  : 'bg-[#FDFAF5] border border-[#D4C4A8] text-[#6B5B45]'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      )}

      <div className="space-y-4">
        {searchQuery 
          ? filteredItems.map(item => {
              const cat = INTEREST_CATEGORIES.find(c => c.items.includes(item));
              const isSelected = selected.includes(item);
              const bgColor = cat?.bgColor || '#D6EAD9';
              const textColor = cat?.color || '#4A7C59';
              return (
                <button
                  key={item}
                  type="button"
                  onClick={() => handleToggle(item)}
                  disabled={!isSelected && isMaxReached}
                  style={isSelected ? { backgroundColor: bgColor, color: textColor } : undefined}
                  className={`w-full rounded-full px-3 py-2 text-[12px] transition-all duration-200 ${
                    isSelected
                      ? ''
                      : !isSelected && isMaxReached
                        ? 'bg-[#FDFAF5] text-[#6B5B45] border border-[#D4C4A8] opacity-40 cursor-not-allowed'
                        : 'bg-[#FDFAF5] text-[#6B5B45] border border-[#D4C4A8]'
                  }`}
                >
                  {isSelected && <IconCheck className="w-3 h-3 inline-block mr-1 -mb-0.5" style={{ color: textColor }} />}
                  {item}
                </button>
              );
            })
          : categoriesToShow.map(cat => {
              const Icon = ICON_MAP[cat.icon];
              return (
                <div key={cat.id} className="space-y-2">
                  <div className="flex items-center gap-1.5">
                    {Icon && <Icon className="w-3.5 h-3.5 text-[#9C8B75]" />}
                    <span className="text-[11px] uppercase tracking-wide text-[#9C8B75]">{cat.label}</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {cat.items.map(item => {
                      const isSelected = selected.includes(item);
                      const selectedStyle = isSelected ? { backgroundColor: cat.bgColor, color: cat.color } : undefined;
                      return (
                        <button
                          key={item}
                          type="button"
                          onClick={() => handleToggle(item)}
                          disabled={!isSelected && isMaxReached}
                          style={selectedStyle}
                          className={`rounded-full px-3 py-1.5 text-[12px] transition-all duration-200 ${getItemStyle(cat, isSelected)}`}
                        >
                          {isSelected && <IconCheck className="w-3 h-3 inline-block mr-1 -mb-0.5" style={{ color: cat.color }} />}
                          {item}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })
        }
      </div>

      {selected.length > 0 && (
        <div className="space-y-2 pt-2">
          <span className="text-[11px] text-[#9C8B75]">Dipilih:</span>
          <div className="flex flex-wrap gap-2">
            {selected.map(item => (
              <div key={item} className="inline-flex items-center gap-1 bg-[#EDE4D3] text-[#3B2F1E] text-[11px] px-2 py-1 rounded-full">
                <span>{item}</span>
                <button
                  type="button"
                  onClick={() => handleRemove(item)}
                  className="text-[#6B5B45] hover:text-[#3B2F1E]"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}