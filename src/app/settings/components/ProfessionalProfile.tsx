"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch } from "@/lib/api-client";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Trash2, Briefcase, Wrench } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Experience {
  id?: number;
  company_name: string;
  role: string;
  start_date: string;
  end_date: string;
  description: string;
  is_public: boolean;
}

interface ProfessionalProfile {
  occupation: string;
  skills: string[];
  occupation_is_public: boolean;
  experiences: Experience[];
}

export default function ProfessionalProfile() {
  const [prof, setProf] = useState<ProfessionalProfile>({
    occupation: "",
    skills: [],
    occupation_is_public: true,
    experiences: [],
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [inputValue, setInputValue] = useState("");

  useEffect(() => {
    const fetchProf = async () => {
      const res = await apiFetch("/api/user/professional");
      if (res.ok) {
        const data = await res.json();
        setProf(data.professional);
      }
    };
    fetchProf();
  }, []);

  const addSkill = () => {
    if (inputValue.trim()) {
      if (!prof.skills.includes(inputValue.trim())) {
        setProf({ ...prof, skills: [...prof.skills, inputValue.trim()] });
      }
      setInputValue("");
    }
  };

  const removeSkill = (skill: string) => {
    setProf({ ...prof, skills: prof.skills.filter((s) => s !== skill) });
  };

  const addExperience = () => {
    setProf({
      ...prof,
      experiences: [
        ...prof.experiences,
        {
          company_name: "",
          role: "",
          start_date: "",
          end_date: "",
          description: "",
          is_public: true,
        },
      ],
    });
  };

  const removeExperience = (index: number) => {
    const updated = [...prof.experiences];
    updated.splice(index, 1);
    setProf({ ...prof, experiences: updated });
  };

  const updateExperience = (
    index: number,
    field: keyof Experience,
    value: any,
  ) => {
    const updated = [...prof.experiences];
    updated[index] = { ...updated[index], [field]: value };
    setProf({ ...prof, experiences: updated });
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await apiFetch("/api/user/professional", {
        method: "PUT",
        body: JSON.stringify(prof),
      });
      if (res.ok) {
        alert("Profil profesional berhasil diperbarui");
      } else {
        alert("Gagal menyimpan profil");
      }
    } catch (error) {
      alert("Terjadi kesalahan");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-6"
    >
      <Card className="bg-[#FDFAF5] border-[#D4C4A8]">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Briefcase className="text-[#4A7C59] w-5 h-5" />
            <CardTitle className="text-[#3B2F1E]">Profil Profesional</CardTitle>
          </div>
          <p className="text-xs text-[#9C8B75]">
            Informasi ini digunakan untuk pencarian Circle Family dan networking
            antar keluarga.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Occupation & Privacy */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-[#6B5B45]">Pekerjaan Saat Ini</Label>
              <Input
                value={prof.occupation}
                onChange={(e) =>
                  setProf({ ...prof, occupation: e.target.value })
                }
                placeholder="contoh: Software Engineer, Dokter, Guru"
                className="bg-[#EDE4D3] border-[#D4C4A8] text-[#3B2F1E]"
              />
            </div>
            <div className="flex items-center gap-3 pt-8">
              <Input
                type="checkbox"
                id="pub-prof"
                className="w-4 h-4 rounded-sm accent-[#4A7C59]"
                checked={prof.occupation_is_public}
                onChange={(e) =>
                  setProf({ ...prof, occupation_is_public: e.target.checked })
                }
              />
              <Label
                htmlFor="pub-prof"
                className="text-[#6B5B45] cursor-pointer"
              >
                Tampilkan profil secara publik (untuk Discovery)
              </Label>
            </div>
          </div>

          {/* Skills Section */}
          <div className="space-y-3">
            <Label className="text-[#6B5B45] flex items-center gap-2">
              <Wrench className="w-4 h-4" /> Keahlian / Skill
            </Label>
            <div className="flex gap-2">
              <Input
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) =>
                  e.key === "Enter" && (e.preventDefault(), addSkill())
                }
                placeholder="Tambah skill (e.g. Memasak, Coding...)"
                className="bg-[#EDE4D3] border-[#D4C4A8] text-[#3B2F1E]"
              />
              <Button
                onClick={addSkill}
                className="bg-[#4A7C59] hover:bg-[#2E5239] text-white"
              >
                Tambah
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              <AnimatePresence>
                {prof.skills.map((skill) => (
                  <motion.div
                    key={skill}
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0, opacity: 0 }}
                    whileHover={{ scale: 1.05 }}
                  >
                    <Badge className="bg-[#D6EAD9] text-[#2E5239] border-[#4A7C59]/30 px-3 py-1 rounded-full flex items-center gap-1 cursor-default">
                      {skill}
                      <button
                        onClick={() => removeSkill(skill)}
                        className="ml-1 hover:text-red-600 transition-colors"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </Badge>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>

          {/* Experience Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-[#6B5B45] flex items-center gap-2">
                <Briefcase className="w-4 h-4" /> Riwayat Pekerjaan (Optional)
              </Label>
              <Button
                variant="outline"
                size="sm"
                onClick={addExperience}
                className="border-[#D4C4A8] text-[#6B5B45] hover:bg-[#EDE4D3]"
              >
                <Plus className="w-4 h-4 mr-1" /> Tambah
              </Button>
            </div>

            <div className="space-y-4">
              {prof.experiences.map((exp, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="p-4 rounded-xl bg-[#F5F0E8] border border-[#D4C4A8] space-y-3 relative group"
                >
                  <button
                    onClick={() => removeExperience(index)}
                    className="absolute top-2 right-2 p-2 text-[#9C8B75] hover:text-red-600 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase tracking-wider text-[#9C8B75]">
                        Perusahaan
                      </Label>
                      <Input
                        value={exp.company_name}
                        onChange={(e) =>
                          updateExperience(
                            index,
                            "company_name",
                            e.target.value,
                          )
                        }
                        className="bg-white border-[#D4C4A8] h-8 text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase tracking-wider text-[#9C8B75]">
                        Posisi / Role
                      </Label>
                      <Input
                        value={exp.role}
                        onChange={(e) =>
                          updateExperience(index, "role", e.target.value)
                        }
                        className="bg-white border-[#D4C4A8] h-8 text-sm"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase tracking-wider text-[#9C8B75]">
                        Mulai
                      </Label>
                      <Input
                        type="date"
                        value={exp.start_date}
                        onChange={(e) =>
                          updateExperience(index, "start_date", e.target.value)
                        }
                        className="bg-white border-[#D4C4A8] h-8 text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase tracking-wider text-[#9C8B75]">
                        Selesai
                      </Label>
                      <Input
                        type="date"
                        value={exp.end_date}
                        onChange={(e) =>
                          updateExperience(index, "end_date", e.target.value)
                        }
                        className="bg-white border-[#D4C4A8] h-8 text-sm"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase tracking-wider text-[#9C8B75]">
                      Deskripsi Singkat
                    </Label>
                    <Input
                      value={exp.description}
                      onChange={(e) =>
                        updateExperience(index, "description", e.target.value)
                      }
                      className="bg-white border-[#D4C4A8] h-8 text-sm"
                    />
                  </div>
                </motion.div>
              ))}

              {prof.experiences.length === 0 && (
                <div className="text-center py-6 border-2 border-dashed border-[#D4C4A8] rounded-xl text-[#9C8B75] text-sm">
                  la la la... Belum ada riwayat pekerjaan.
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end pt-4">
            <Button
              onClick={handleSave}
              disabled={isSaving}
              className="bg-[#4A7C59] hover:bg-[#2E5239] text-white px-8"
            >
              {isSaving ? "Menyimpan..." : "Simpan Profil Profesional"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
