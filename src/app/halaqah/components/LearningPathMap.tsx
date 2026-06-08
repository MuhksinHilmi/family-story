'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, Circle, Lock, BookOpen, ArrowRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/api-client';

interface Step {
  id: number;
  step_order: number;
  title: string;
  content: string;
}

interface Progress {
  step_id: number;
  nuclear_family_id: number;
  is_completed: boolean;
}

interface LearningPathMapProps {
  steps: Step[];
  progress: Progress[];
  myNuclearFamilyId: number;
  halaqahId: string;
}

export default function LearningPathMap({ steps, progress, myNuclearFamilyId, halaqahId }: LearningPathMapProps) {
  const [updatingStep, setUpdatingStep] = useState<number | null>(null);

  const toggleProgress = async (stepId: number, currentStatus: boolean) => {
    setUpdatingStep(stepId);
    try {
      const res = await apiFetch(`/api/halaqah/${halaqahId}/progress`, {
        method: 'POST',
        body: JSON.stringify({
          step_id: stepId,
          nuclear_family_id: myNuclearFamilyId,
          is_completed: !currentStatus,
        }),
      });
      if (res.ok) {
        // In a real app, we would refresh the data or update local state
        window.location.reload(); // Simple refresh for now
      }
    } catch (e) {
      console.error(e);
    } finally {
      setUpdatingStep(null);
    }
  };

  const isStepCompletedByMe = (stepId: number) => {
    return progress.find(p => p.step_id === stepId && p.nuclear_family_id === myNuclearFamilyId)?.is_completed || false;
  };

  const isStepUnlocked = (stepIndex: number) => {
    if (stepIndex === 0) return true;
    const prevStep = steps[stepIndex - 1];
    return isStepCompletedByMe(prevStep.id);
  };

  return (
    <div className="flex flex-col items-center py-10 px-4 max-w-2xl mx-auto">
      <div className="relative w-full">
        {/* Vertical Line Background */}
        <div className="absolute left-6 md:left-1/2 top-0 bottom-0 w-1 bg-[#D4C4A8] -translate-x-1/2 rounded-full" />

        <div className="space-y-12 relative">
          {steps.map((step, index) => {
            const unlocked = isStepUnlocked(index);
            const completed = isStepCompletedByMe(step.id);

            return (
              <motion.div
                key={step.id}
                initial={{ opacity: 0, x: index % 2 === 0 ? -20 : 20 }}
                animate={{ opacity: 1, x: 0 }}
                className={`relative flex items-center justify-between w-full ${index % 2 === 0 ? 'flex-row' : 'flex-row-reverse'}`}
              >
                {/* Content Card */}
                <div className="w-5/12">
                  <motion.div
                    whileHover={{ scale: 1.02 }}
                    className={`p-4 rounded-2xl border-2 transition-colors ${
                      unlocked
                        ? 'bg-[#FDFAF5] border-[#D4C4A8]'
                        : 'bg-[#EDE4D3]/50 border-dashed border-[#D4C4A8] opacity-60'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-bold text-[#9C8B75] uppercase tracking-wider">Step {step.step_order + 1}</span>
                      {completed && <Badge className="bg-[#D6EAD9] text-[#2E5239] text-[10px] border-none">Selesai</Badge>}
                    </div>
                    <h3 className="font-bold text-[#3B2F1E] mb-2">{step.title}</h3>
                    <p className="text-sm text-[#6B5B45] mb-4 line-clamp-3">{step.content}</p>

                    {unlocked && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full bg-white border-[#D4C4A8] text-[#6B5B45] hover:bg-[#D6EAD9] hover:text-[#2E5239] transition-all"
                        onClick={() => toggleProgress(step.id, completed)}
                      >
                        {updatingStep === step.id ? (
                          <div className="w-4 h-4 border-2 border-[#4A7C59] border-t-transparent rounded-full animate-spin" />
                        ) : completed ? (
                          <span className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> Selesai</span>
                        ) : (
                          <span className="flex items-center gap-2"><BookOpen className="w-4 h-4" /> Mulai Belajar</span>
                        )}
                      </Button>
                    )}
                  </motion.div>
                </div>

                {/* Center Node */}
                <div className="absolute left-6 md:left-1/2 -translate-x-1/2 flex flex-col items-center">
                  <motion.div
                    animate={unlocked && !completed ? { scale: [1, 1.2, 1] } : {}}
                    transition={{ repeat: Infinity, duration: 2 }}
                    className={`w-12 h-12 rounded-full border-4 flex items-center justify-center z-10 transition-all ${
                      completed
                        ? 'bg-[#4A7C59] border-[#D6EAD9] text-white'
                        : unlocked
                          ? 'bg-[#F5E8C8] border-[#C4922A] text-[#C4922A]'
                          : 'bg-gray-200 border-gray-300 text-gray-400'
                    }`}
                  >
                    {completed ? <CheckCircle2 className="w-6 h-6" /> : unlocked ? <div className="text-sm font-bold">{index + 1}</div> : <Lock className="w-5 h-5" />}
                  </motion.div>

                  {/* Connector arrow for mobile/desktop (optional) */}
                  {index < steps.length - 1 && (
                    <div className="h-12 w-px bg-[#D4C4A8] mt-2" />
                  )}
                </div>

                {/* Empty space for opposite side */}
                <div className="w-5/12" />
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
