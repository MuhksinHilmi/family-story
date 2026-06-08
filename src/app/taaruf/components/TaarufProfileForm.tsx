"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useTaaruf } from "../hooks/useTaaruf";
import LocationPicker from "./LocationPicker";
import InterestPicker from "./InterestPicker";
import DropdownSelect from "./DropdownSelect";
import { IconCheck, IconLoader2 } from "@tabler/icons-react";
import { showToast } from "@/components/ui/toast";

const tabs = [
  { id: "personal", label: "Profil Pribadi" },
  { id: "criteria", label: "Kriteria Pasangan" },
  { id: "letter", label: "Surat Lamaran" },
];

const educationOptions = ["SMA/SMK", "Diploma", "S1", "S2", "S3"];
const maritalStatusOptions = ["Belum Menikah", "Cerai", "Janda"];
const occupationOptions = [
  "Guru/Dosen",
  "Dokter",
  "Perawat",
  "Apoteker",
  "Bidan",
  "Arsitek",
  "Insinyur",
  "Programmer",
  "Designer",
  "Wirausaha",
  "Pengusaha",
  "TNI",
  "Polri",
  "Pegawai Negeri",
  "Pegawai Swasta",
  "Profesional",
  "Ibu Rumah Tangga",
  "Pelajar",
  "Mahasiswa",
  "Lainnya",
];

export default function TaarufProfileForm() {
  const [activeTab, setActiveTab] = useState(0);
  const { updateProfile, isLoading, error } = useTaaruf();

  const [personalData, setPersonalData] = useState({
    province: "",
    city: "",
    education_level: "",
    occupation: "",
    about_me: "",
    interests: [] as string[],
    photo_url: "",
    cover_photo: "",
  });

  const [criteriaData, setCriteriaData] = useState({
    age_min: "",
    age_max: "",
    preferred_education: [] as string[],
    preferred_location: "",
    preferred_marital_status: "",
  });

  const [letterData, setLetterData] = useState({
    introduction: "",
    vision: "",
    commitment: "",
    message: "",
  });

  const handleNext = async () => {
    if (activeTab < tabs.length - 1) {
      setActiveTab(activeTab + 1);
    } else {
      const success = await updateProfile({
        ...personalData,
        location: `${personalData.city}, ${personalData.province}`,
        criteria: criteriaData,
        letter: letterData,
      });
      if (success) {
        showToast("Profil berhasil disimpan dan diaktifkan!", "success");
        setTimeout(() => window.location.reload(), 1000);
      }
    }
  };

  const handlePrev = () => {
    if (activeTab > 0) {
      setActiveTab(activeTab - 1);
    }
  };

  const toggleEducation = (edu: string) => {
    setCriteriaData((prev) => ({
      ...prev,
      preferred_education: prev.preferred_education.includes(edu)
        ? prev.preferred_education.filter((e) => e !== edu)
        : [...prev.preferred_education, edu],
    }));
  };

  const progressPercent = ((activeTab + 1) / tabs.length) * 100;

  return (
    <div className="overflow-y-auto h-full">
      <div className="space-y-4 bg-[#F5F0E8] min-h-full pb-10 max-w-lg mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold text-[#3B2F1E] flex-shrink-0">
          Lengkapi Profil Ta'aruf
        </h1>

        <div className="flex items-center justify-between flex-shrink-0">
          {tabs.map((tab, index) => (
            <div key={tab.id} className="flex items-center">
              <div className="flex flex-col items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-[13px] ${
                    index < activeTab
                      ? "bg-[#4A7C59] text-white"
                      : index === activeTab
                        ? "bg-[#4A7C59] text-white"
                        : "border border-[#D4C4A8] bg-[#FDFAF5] text-[#9C8B75]"
                  }`}
                >
                  {index < activeTab ? (
                    <IconCheck className="w-4 h-4" />
                  ) : (
                    index + 1
                  )}
                </div>
                <span
                  className={`text-[11px] mt-1.5 ${index === activeTab ? "text-[#3B2F1E] font-bold" : "text-[#9C8B75]"}`}
                >
                  {tab.label}
                </span>
              </div>
              {index < tabs.length - 1 && (
                <div
                  className={`flex-1 h-0.5 mx-2 ${index < activeTab ? "bg-[#4A7C59]" : "bg-[#D4C4A8]"}`}
                />
              )}
            </div>
          ))}
        </div>

        <div className="w-full h-0.5 bg-[#EDE4D3] rounded-full overflow-hidden flex-shrink-0">
          <div
            className="h-full bg-[#4A7C59] transition-all duration-300 ease-in-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        <div className="text-right text-[11px] text-[#9C8B75] flex-shrink-0">
          Langkah {activeTab + 1} dari {tabs.length}
        </div>

        <Card className="bg-[#FDFAF5] border border-[#D4C4A8]">
          <CardContent className="space-y-4 flex-1">
            <h2 className="text-[16px] font-medium text-[#3B2F1E] border-b border-[#D4C4A8] py-4 mb-4">
              {tabs[activeTab].label}
            </h2>

            {activeTab === 0 && (
              <>
                <LocationPicker
                  value={{
                    province: personalData.province,
                    city: personalData.city,
                  }}
                  onChange={(val) =>
                    setPersonalData({ ...personalData, ...val })
                  }
                  required
                />

                <DropdownSelect
                  value={personalData.education_level}
                  onChange={(val) =>
                    setPersonalData({ ...personalData, education_level: val })
                  }
                  label="Pendidikan Terakhir"
                  placeholder="Pilih pendidikan..."
                  options={educationOptions}
                  required
                />

                <DropdownSelect
                  value={personalData.occupation}
                  onChange={(val) =>
                    setPersonalData({ ...personalData, occupation: val })
                  }
                  label="Pekerjaan"
                  placeholder="Pilih pekerjaan..."
                  options={occupationOptions}
                  otherOption
                />

                <InterestPicker
                  selected={personalData.interests}
                  onChange={(interests) =>
                    setPersonalData({ ...personalData, interests })
                  }
                  max={10}
                />
              </>
            )}

            {activeTab === 1 && (
              <>
                <div>
                  <Label className="text-[#3B2F1E]">
                    Rentang Usia Pasangan
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      placeholder="Min"
                      value={criteriaData.age_min}
                      onChange={(e) =>
                        setCriteriaData({
                          ...criteriaData,
                          age_min: e.target.value,
                        })
                      }
                      className="bg-[#EDE4D3] border-[#D4C4A8] text-[#3B2F1E]"
                    />
                    <Input
                      type="number"
                      placeholder="Max"
                      value={criteriaData.age_max}
                      onChange={(e) =>
                        setCriteriaData({
                          ...criteriaData,
                          age_max: e.target.value,
                        })
                      }
                      className="bg-[#EDE4D3] border-[#D4C4A8] text-[#3B2F1E]"
                    />
                  </div>
                </div>

                <div>
                  <Label className="text-[#3B2F1E]">Lokasi Preferensi</Label>
                  <Input
                    value={criteriaData.preferred_location}
                    onChange={(e) =>
                      setCriteriaData({
                        ...criteriaData,
                        preferred_location: e.target.value,
                      })
                    }
                    className="bg-[#EDE4D3] border-[#D4C4A8] text-[#3B2F1E]"
                    placeholder="Kota/Provinsi"
                  />
                </div>

                <div>
                  <Label className="text-[#3B2F1E]">
                    Pendidikan Preferensi
                  </Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {educationOptions.map((edu) => (
                      <button
                        key={edu}
                        type="button"
                        onClick={() => toggleEducation(edu)}
                        className={`px-3 py-1 rounded-full text-sm ${
                          criteriaData.preferred_education.includes(edu)
                            ? "bg-[#4A7C59] text-white"
                            : "bg-[#EDE4D3] text-[#6B5B45] border border-[#D4C4A8]"
                        }`}
                      >
                        {edu}
                      </button>
                    ))}
                  </div>
                </div>

                <DropdownSelect
                  value={criteriaData.preferred_marital_status}
                  onChange={(val) =>
                    setCriteriaData({
                      ...criteriaData,
                      preferred_marital_status: val,
                    })
                  }
                  label="Status Perkawinan Preferensi"
                  placeholder="Pilih status..."
                  options={maritalStatusOptions}
                />
              </>
            )}

            {activeTab === 2 && (
              <>
                <div>
                  <Label className="text-[#3B2F1E]">Perkenalan Diri *</Label>
                  <Textarea
                    value={letterData.introduction}
                    onChange={(e) =>
                      setLetterData({
                        ...letterData,
                        introduction: e.target.value,
                      })
                    }
                    className="bg-[#EDE4D3] border-[#D4C4A8] text-[#3B2F1E] min-h-24"
                    placeholder="Tulis perkenalan diri Anda..."
                  />
                </div>

                <div>
                  <Label className="text-[#3B2F1E]">Visi Keluarga</Label>
                  <Textarea
                    value={letterData.vision}
                    onChange={(e) =>
                      setLetterData({ ...letterData, vision: e.target.value })
                    }
                    className="bg-[#EDE4D3] border-[#D4C4A8] text-[#3B2F1E] min-h-20"
                    placeholder="Visi Anda tentang keluarga..."
                  />
                </div>

                <div>
                  <Label className="text-[#3B2F1E]">
                    Pesan untuk Calon Pasangan
                  </Label>
                  <Textarea
                    value={letterData.message}
                    onChange={(e) =>
                      setLetterData({ ...letterData, message: e.target.value })
                    }
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
              ← Sebelumnya
            </Button>
          )}
          <Button
            className="flex-1 bg-[#4A7C59] hover:bg-[#2E5239] text-white"
            onClick={handleNext}
            disabled={isLoading}
          >
            {isLoading ? (
              <IconLoader2 className="w-4 h-4 animate-spin" />
            ) : activeTab === tabs.length - 1 ? (
              "Simpan & Aktifkan"
            ) : (
              "Selanjutnya →"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
