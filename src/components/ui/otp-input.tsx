'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

interface OtpInputProps {
  length?: number;
  value: string;
  onChange: (value: string) => void;
  onComplete?: (value: string) => void;
  disabled?: boolean;
}

const OtpInput = React.forwardRef<HTMLDivElement, OtpInputProps>(
  ({ length = 6, value, onChange, onComplete, disabled = false }, ref) => {
    const inputRefs = React.useRef<(HTMLInputElement | null)[]>([]);

    const setInputsRef = (el: HTMLInputElement | null, index: number) => {
      inputRefs.current[index] = el;
    };

    const handleChange = (index: number, newValue: string) => {
      if (newValue.length > 1) return;
      
      const newValueArray = value.split('');
      newValueArray[index] = newValue;
      const newString = newValueArray.join('').slice(0, length);
      onChange(newString.slice(0, length));

      if (newValue && index < length - 1) {
        inputRefs.current[index + 1]?.focus();
      }

      if (newString.length === length && onComplete) {
        onComplete(newString);
      }
    };

    const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Backspace' && !value[index] && index > 0) {
        inputRefs.current[index - 1]?.focus();
      }
    };

    const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
      e.preventDefault();
      const paste = e.clipboardData.getData('text').replace(/\s/g, '').slice(0, length);
      onChange(paste);
      if (paste.length === length && onComplete) {
        onComplete(paste);
      }
    };

    return (
      <div ref={ref} className="flex gap-2 justify-center">
        {Array.from({ length }, (_, index) => (
          <input
            key={index}
            ref={(el) => setInputsRef(el, index)}
            type="text"
            maxLength={1}
            value={value[index] || ''}
            onChange={(e) => handleChange(index, e.target.value)}
            onKeyDown={(e) => handleKeyDown(index, e)}
            onPaste={handlePaste}
            disabled={disabled}
            className={cn(
              'h-12 w-12 rounded-md border border-gray-300 bg-white text-center text-2xl font-semibold text-gray-900',
              'focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
              'disabled:cursor-not-allowed disabled:opacity-50'
            )}
          />
        ))}
      </div>
    );
  }
);
OtpInput.displayName = 'OtpInput';

export { OtpInput };