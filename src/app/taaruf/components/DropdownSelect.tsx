"use client";

import { useState, useRef, useEffect } from 'react';
import { IconChevronDown, IconSearch } from '@tabler/icons-react';
import { Label } from '@/components/ui/label';

interface DropdownSelectProps {
  value: string;
  onChange: (val: string) => void;
  label?: string;
  placeholder?: string;
  options: string[];
  otherOption?: boolean;
  required?: boolean;
}

export default function DropdownSelect({ 
  value, 
  onChange, 
  label, 
  placeholder = 'Pilih...', 
  options,
  otherOption = false,
  required 
}: DropdownSelectProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const showOtherInput = otherOption && value === 'Lainnya';

  const filteredOptions = options.filter(opt => 
    opt.toLowerCase().includes(searchQuery.toLowerCase())
  );

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (option: string) => {
    onChange(option);
    setSearchQuery('');
    setOpen(false);
  };

  return (
    <div ref={ref} className="space-y-2">
      {label && (
        <Label className="text-[#3B2F1E]">{label}{required && ' *'}</Label>
      )}
      
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="w-full flex items-center justify-between bg-[#EDE4D3] border border-[#D4C4A8] rounded-lg px-3 py-2 text-left"
        >
          <span className={`text-[13px] ${value && !showOtherInput ? 'text-[#3B2F1E]' : 'text-[#9C8B75]'}`}>
            {showOtherInput ? placeholder : value || placeholder}
          </span>
          <IconChevronDown 
            className={`w-4 h-4 text-[#9C8B75] transition-transform ${open ? 'rotate-180' : ''}`} 
          />
        </button>

        {open && (
          <div className="absolute top-full left-0 w-full bg-[#FDFAF5] border border-[#D4C4A8] rounded-lg shadow-sm mt-1 max-h-48 overflow-y-auto z-10">
            <div className="sticky top-0 bg-[#F5F0E8] border-b border-[#D4C4A8] px-2 py-1">
              <div className="relative">
                <IconSearch className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-[#9C8B75]" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari..."
                  className="w-full pl-7 pr-2 py-1 text-[12px] text-[#3B2F1E] bg-transparent outline-none"
                />
              </div>
            </div>
            {filteredOptions.map(option => (
              <button
                key={option}
                type="button"
                onClick={() => handleSelect(option)}
                className={`w-full px-3 py-2 text-left text-[13px] transition-colors ${
                  value === option 
                    ? 'bg-[#D6EAD9] text-[#2E5239] font-medium' 
                    : 'text-[#3B2F1E] hover:bg-[#EDE4D3]'
                }`}
              >
                {option}
              </button>
            ))}
          </div>
        )}
      </div>

      {otherOption && showOtherInput && (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Ketik pekerjaan Anda..."
          className="w-full bg-[#EDE4D3] border border-[#D4C4A8] rounded-lg px-3 py-2 text-[13px] text-[#3B2F1E] outline-none"
        />
      )}
    </div>
  );
}