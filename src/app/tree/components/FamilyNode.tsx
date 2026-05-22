import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { FamilyNodeData } from '@/types';
import { cn } from '@/lib/utils';
import { Info } from 'lucide-react';

interface FamilyNodeProps {
  data: FamilyNodeData;
  selected: boolean;
  onInfoClick?: (nodeId: string) => void;
  onStartConnection?: (nodeId: string) => void;
}

export const FamilyNode = memo(({ data, selected, onInfoClick, onStartConnection }: FamilyNodeProps) => {
  const isDeceased = data.is_alive === false;
  const isPending = data.invitation_status === 'pending';
  const isSelected = selected;

  return (
    <div className="relative">
      <div
        className={cn(
          'w-32 h-40 rounded-lg border-2 flex flex-col items-center justify-center p-2 transition-all',
          isSelected ? 'border-[#4A7C59] bg-[#D6EAD9]' : 'border-[#D4C4A8] bg-[#FDFAF5]',
          isDeceased && 'grayscale opacity-70',
          isPending && 'border-dashed border-[#C4922A] bg-[#F5E8C8]'
        )}
      >
        {isPending && (
          <div className="absolute -top-2 -right-2 w-5 h-5 bg-[#C4922A] rounded-full flex items-center justify-center text-white text-[10px] font-bold">
            !
          </div>
        )}

        {!isPending && !isDeceased && (
          <div className="absolute -top-2 -right-2 w-5 h-5 bg-[#4A7C59] rounded-full" />
        )}

        <div className="w-16 h-16 rounded-full overflow-hidden mb-1 border">
          {data.photo_url ? (
            <img src={data.photo_url} alt={data.full_name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-[#D6EAD9] flex items-center justify-center text-lg font-bold text-[#2E5239]">
              {data.full_name.charAt(0)}
            </div>
          )}
        </div>

        <div className="text-sm font-medium text-center truncate w-full px-1">
          <div className="truncate text-[#3B2F1E]">{data.full_name}</div>
          {data.nasab_line && (
            <div className="text-[10px] text-[#8B6F47] truncate">{data.nasab_line}</div>
          )}
        </div>

        {isPending && (
          <div className="text-[10px] text-[#C4922A] font-medium">
            Menunggu
          </div>
        )}

        <div className="absolute -bottom-2 -left-2 w-6 h-6 bg-[#FDFAF5] rounded-full border flex items-center justify-center">
          <span className={cn('text-sm', data.gender === 'male' ? 'text-[#4A7C59]' : 'text-[#8B6F47]')}>
            {data.gender === 'male' ? '♂' : '♀'}
          </span>
        </div>
      </div>

      <button
        type="button"
        onClick={() => onInfoClick?.(data.id)}
        className="absolute -top-2 -left-2 w-5 h-5 bg-[#EDE4D3] hover:bg-[#D4C4A8] rounded-full flex items-center justify-center border transition-colors"
        title="Info"
      >
        <Info className="h-5 w-5 text-[#6B5B45]" />
      </button>

      <Handle type="source" position={Position.Right} id="right" />
      <Handle type="target" position={Position.Left} id="left" />
      <Handle type="source" position={Position.Bottom} id="bottom" />
      <Handle type="target" position={Position.Top} id="top" />
    </div>
  );
});

FamilyNode.displayName = 'FamilyNode';