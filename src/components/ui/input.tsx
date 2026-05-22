import * as React from 'react';
import { cn } from '@/lib/utils';

const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => {
  return (
    <input
      className={cn(
        'flex h-10 w-full rounded-md border border-[#D4C4A8] bg-[#EDE4D3] px-3 py-2 text-base text-[#3B2F1E] ring-offset-white placeholder:text-[#9C8B75] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      ref={ref}
      {...props}
    />
  );
});
Input.displayName = 'Input';

export { Input };