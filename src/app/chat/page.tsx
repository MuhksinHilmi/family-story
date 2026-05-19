'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send } from 'lucide-react';
import { useState } from 'react';

export default function ChatPage() {
  const [message, setMessage] = useState('');

  return (
    <div className="flex flex-col h-[600px]">
      <Card className="flex-1 flex flex-col">
        <CardHeader>
          <CardTitle>Chat Keluarga</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col">
          <div className="flex-1 space-y-4 mb-4 overflow-y-auto">
            <div className="flex items-start space-x-3">
              <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                <span className="text-sm font-medium">A</span>
              </div>
              <div>
                <p className="font-medium text-sm">Bapak Ahmad</p>
                <p className="text-gray-700">Selamat datang semua di grup keluarga!</p>
              </div>
            </div>
            <div className="flex items-start space-x-3 justify-end">
              <div>
                <p className="font-medium text-sm text-right">Anda</p>
                <p className="text-gray-700">Terima kasih, pak!</p>
              </div>
              <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                <span className="text-sm font-medium">S</span>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Input 
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Ketik pesan..."
              className="flex-1"
            />
            <Button>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}