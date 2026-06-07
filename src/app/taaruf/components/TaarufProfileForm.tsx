"use client";

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useTaaruf } from '../hooks/useTaaruf';

const tabs = [
  { id: 'personal', label: 'Profil Pribadi' },
  { id: 'criteria', label: 'Kriteria Pasangan' },
  { id: 'letter', label: 'Surat Lamaran' }
];

const educationOptions = ['SMA/SMK', 'Diploma', 'S1', 'S2', 'S3'];
const maritalStatusOptions = ['never_married', 'divorced', 'widowed'];
const hobbyOptions = ['Membaca', 'Travelling', 'Masak', 'Olahraga', 'Menulis', 'Berkebun'];

export default function TaarufProfileForm() {
  const [activeTab, setActiveTab] = useState(0);
  const { updateProfile, isLoading, error } = useTaaruf();

  const [personalData, setPersonalData] = useState({
    location: '',
    education_level: '',
    occupation: '',
    about_me: '',
    interests: [] as string[],
    photo_url: '',
    cover_photo: '',
  });

  const [criteriaData, setCriteriaData] = useState({
    age_min: '',
    age_max: '',
    preferred_education: [] as string[],
    preferred_location: '',
    preferred_marital_status: '',
  });

  const [letterData, setLetterData] = useState({
    introduction: '',
    vision: '',
    commitment: '',
    message: '',
  });

  const handleNext = async () => {
    if (activeTab < tabs.length - 1) {
      setActiveTab(activeTab + 1);
    } else {
      await updateProfile({
        ...personalData,
        criteria: criteriaData,
        letter: letterData,
      });
    }
  };

  const handlePrev = () => {
    if (activeTab > 0) {
      setActiveTab(activeTab - 1);
    }
  };

  const toggleInterest = (interest: string) => {
    setPersonalData(prev => ({
      ...prev,
      interests: prev.interests.includes(interest)
        ? prev.interests.filter(i => i !== interest)
        : [...prev.interests, interest]
    }));
  };

  const toggleEducation = (edu: string) => {
    setCriteriaData(prev => ({
      ...prev,
      preferred_education: prev.preferred_education.includes(edu)
        ? prev.preferred_education.filter(e => e !== edu)
        : [...prev.preferred_education, edu]
    }));
  };

  return (
    <div className="overflow-y-auto h-full">
      <div className="space-y-4 bg-[#F5F0E8] min-h-full pb-10 max-w-lg mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold text-[#3B2F1E] flex-shrink-0">Lengkapi Profil Ta'aruf</h1>

        <div className="flex gap-2 bg-[#EDE4D3] p-1 rounded-lg flex-shrink-0">
          {tabs.map((tab, index) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(index)}
              className={`flex-1 px-4 py-2 rounded-md transition-all ${
                activeTab === index
                  ? 'bg-[#4A7C59] text-white'
                  : 'text-[#6B5B45] hover:bg-[#D6EAD9]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <Card className="bg-[#FDFAF5] border border-[#D4C4A8]">
          <CardHeader className="flex-shrink-0">
            <CardTitle className="text-[#3B2F1E]">
              {tabs[activeTab].label}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 flex-1">
            {activeTab === 0 && (
              <>
                <div>
                  <Label className="text-[#3B2F1E]">Lokasi</Label>
                  <Input
                    value={personalData.location}
                    onChange={(e) => setPersonalData({ ...personalData, location: e.target.value })}
                    className="bg-[#EDE4D3] border-[#D4C4A8] text-[#3B2F1E]"
                    placeholder="Kota, Provinsi"
                  />
                </div>

                <div>
                  <Label className="text-[#3B2F1E]">Pendidikan Terakhir</Label>
                  <Input
                    value={personalData.education_level}
                    onChange={(e) => setPersonalData({ ...personalData, education_level: e.target.value })}
                    className="bg-[#EDE4D3] border-[#D4C4A8] text-[#3B2F1E]"
                    placeholder="S1, S2, dll"
                  />
                </div>

                <div>
                  <Label className="text-[#3B2F1E]">Pekerjaan</Label>
                  <Input
                    value={personalData.occupation}
                    onChange={(e) => setPersonalData({ ...personalData, occupation: e.target.value })}
                    className="bg-[#EDE4D3] border-[#D4C4A8] text-[#3B2F1E]"
                  />
                </div>

                <div>
                  <Label className="text-[#3B2F1E]">Minat/Hobi</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {hobbyOptions.map(hobby => (
                      <button
                        key={hobby}
                        type="button"
                        onClick={() => toggleInterest(hobby)}
                        className={`px-3 py-1 rounded-full text-sm ${
                          personalData.interests.includes(hobby)
                            ? 'bg-[#4A7C59] text-white'
                            : 'bg-[#EDE4D3] text-[#6B5B45] border border-[#D4C4A8]'
                        }`}
                      >
                        {hobby}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {activeTab === 1 && (
              <>
                <div>
                  <Label className="text-[#3B2F1E]">Rentang Usia Pasangan</Label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      placeholder="Min"
                      value={criteriaData.age_min}
                      onChange={(e) => setCriteriaData({ ...criteriaData, age_min: e.target.value })}
                      className="bg-[#EDE4D3] border-[#D4C4A8] text-[#3B2F1E]"
                    />
                    <Input
                      type="number"
                      placeholder="Max"
                      value={criteriaData.age_max}
                      onChange={(e) => setCriteriaData({ ...criteriaData, age_max: e.target.value })}
                      className="bg-[#EDE4D3] border-[#D4C4A8] text-[#3B2F1E]"
                    />
                  </div>
                </div>

                <div>
                  <Label className="text-[#3B2F1E]">Lokasi Preferensi</Label>
                  <Input
                    value={criteriaData.preferred_location}
                    onChange={(e) => setCriteriaData({ ...criteriaData, preferred_location: e.target.value })}
                    className="bg-[#EDE4D3] border-[#D4C4A8] text-[#3B2F1E]"
                    placeholder="Kota/Provinsi"
                  />
                </div>

                <div>
                  <Label className="text-[#3B2F1E]">Pendidikan Preferensi</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {educationOptions.map(edu => (
                      <button
                        key={edu}
                        type="button"
                        onClick={() => toggleEducation(edu)}
                        className={`px-3 py-1 rounded-full text-sm ${
                          criteriaData.preferred_education.includes(edu)
                            ? 'bg-[#4A7C59] text-white'
                            : 'bg-[#EDE4D3] text-[#6B5B45] border border-[#D4C4A8]'
                        }`}
                      >
                        {edu}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {activeTab === 2 && (
              <>
                <div>
                  <Label className="text-[#3B2F1E]">Perkenalan Diri *</Label>
                  <Textarea
                    value={letterData.introduction}
                    onChange={(e) => setLetterData({ ...letterData, introduction: e.target.value })}
                    className="bg-[#EDE4D3] border-[#D4C4A8] text-[#3B2F1E] min-h-24"
                    placeholder="Tulis perkenalan diri Anda..."
                  />
                </div>

                <div>
                  <Label className="text-[#3B2F1E]">Visi Keluarga</Label>
                  <Textarea
                    value={letterData.vision}
                    onChange={(e) => setLetterData({ ...letterData, vision: e.target.value })}
                    className="bg-[#EDE4D3] border-[#D4C4A8] text-[#3B2F1E] min-h-20"
                    placeholder="Visi Anda tentang keluarga..."
                  />
                </div>

                <div>
                  <Label className="text-[#3B2F1E]">Pesan untuk Calon Pasangan</Label>
                  <Textarea
                    value={letterData.message}
                    onChange={(e) => setLetterData({ ...letterData, message: e.target.value })}
                    className="bg-[#EDE4D3] border-[#D4C4A8] text-[#3B2F1E]"
                    placeholder="Pesan pribadi Anda..."
                  />
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {error && (
          <div className="text-red-600 text-sm bg-red-50 p-3 rounded-lg flex-shrink-0">
            {error}
          </div>
        )}

        <div className="flex gap-3 flex-shrink-0">
          {activeTab > 0 && (
            <Button
              variant="outline"
              className="flex-1 border-[#D4C4A8] text-[#6B5B45]"
              onClick={handlePrev}
            >
              Sebelumnya
            </Button>
          )}
          <Button
            className="flex-1 bg-[#4A7C59] hover:bg-[#2E5239] text-white"
            onClick={handleNext}
            disabled={isLoading}
          >
            {isLoading ? 'Menyimpan...' : activeTab === tabs.length - 1 ? 'Simpan & Aktifkan' : 'Selanjutnya'}
          </Button>
        </div>
      </div>
    </div>
  );
}