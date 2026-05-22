'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, Download, Eye } from 'lucide-react';

export default function DocumentsPage() {
  return (
    <div className="space-y-6 bg-[#F5F0E8] min-h-screen">
      <h1 className="text-2xl font-bold text-[#3B2F1E]">Dokumen Keluarga</h1>

      <Card className="bg-[#FDFAF5] border border-[#D4C4A8]">
        <CardHeader>
          <CardTitle className="text-[#3B2F1E]">Daftar Dokumen</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-[#EDE4D3] rounded-lg">
              <div className="flex items-center space-x-3">
                <FileText className="h-8 w-8 text-[#C4922A]" />
                <div>
                  <p className="font-medium text-[#3B2F1E]">Kartu Keluarga 2026</p>
                  <p className="text-sm text-[#6B5B45]">PDF • 2 MB</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" className="text-[#6B5B45] hover:bg-[#D6EAD9]">
                  <Eye className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" className="text-[#6B5B45] hover:bg-[#D6EAD9]">
                  <Download className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="flex items-center justify-between p-4 bg-[#EDE4D3] rounded-lg">
              <div className="flex items-center space-x-3">
                <FileText className="h-8 w-8 text-[#C4922A]" />
                <div>
                  <p className="font-medium text-[#3B2F1E]">KTP Bapak Ahmad</p>
                  <p className="text-sm text-[#6B5B45]">JPG • 1 MB</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" className="text-[#6B5B45] hover:bg-[#D6EAD9]">
                  <Eye className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" className="text-[#6B5B45] hover:bg-[#D6EAD9]">
                  <Download className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}