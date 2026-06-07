"use client";

import { useEffect, useState, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Send } from 'lucide-react';
import { apiFetch } from '@/lib/api-client';
import { useAuth } from '@/context/auth-context';

interface Message {
  id: string;
  content: string;
  is_system: boolean;
  created_at: string;
  sender?: {
    full_name: string;
  };
}

export default function MatchedChatRoom({ room }: { room: { id: string; name: string } }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    fetchMessages();
    
    const interval = setInterval(fetchMessages, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const fetchMessages = async () => {
    try {
      const res = await apiFetch(`/api/chat/rooms/${room.id}/messages`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
      }
    } catch (error) {
      console.error('Failed to fetch messages:', error);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim()) return;

    try {
      await apiFetch(`/api/chat/rooms/${room.id}/messages`, {
        method: 'POST',
        body: JSON.stringify({ content: newMessage.trim() }),
      });
      setNewMessage('');
      fetchMessages();
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const names = room.name.replace("Ta'aruf: ", '').split(' & ');

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] bg-[#EDE4D3]">
      <div className="bg-[#FDFAF5] border-b border-[#D4C4A8] p-4 flex items-center gap-3">
        <div className="w-10 h-10 bg-[#D6EAD9] rounded-full flex items-center justify-center">
          <span className="text-[#4A7C59] font-semibold">
            {names.map(n => n.charAt(0)).join('')}
          </span>
        </div>
        <div>
          <h3 className="font-semibold text-[#3B2F1E]">{room.name}</h3>
          <p className="text-xs text-[#6B5B45]">Keluarga inti kedua pihak</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-center text-[#9C8B75] py-8">
            Belum ada pesan. Mulai mengenal satu sama lain...
          </div>
        )}
        
        {messages.map(msg => (
          msg.is_system ? (
            <div key={msg.id} className="flex justify-center">
              <div className="bg-[#F5E8C8] border border-[#D4C4A8] rounded-lg px-4 py-2 text-center max-w-xs">
                <p className="text-xs text-[#C4922A] font-medium">{msg.content}</p>
              </div>
            </div>
          ) : (
            <div key={msg.id} className="flex justify-start">
              <div className="bg-[#FDFAF5] border border-[#D4C4A8] rounded-lg px-3 py-2 max-w-xs">
                <p className="text-xs font-semibold text-[#4A7C59] mb-1">
                  {msg.sender?.full_name || 'Anggota'}
                </p>
                <p className="text-sm text-[#3B2F1E]">{msg.content}</p>
              </div>
            </div>
          )
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="bg-[#FDFAF5] border-t border-[#D4C4A8] p-3 flex gap-2">
        <Input
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Ketik pesan..."
          className="bg-[#EDE4D3] border-[#D4C4A8] text-[#3B2F1E] flex-1"
        />
        <button
          onClick={sendMessage}
          disabled={!newMessage.trim()}
          className="w-10 h-10 bg-[#4A7C59] rounded-lg flex items-center justify-center text-white disabled:opacity-40"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}