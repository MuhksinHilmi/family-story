import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { FamilyNodeData } from '@/types';
import { cn } from '@/lib/utils';
import { Info, RefreshCw } from 'lucide-react';

interface FamilyNodeProps {
  data: FamilyNodeData;
  selected: boolean;
  onInfoClick?: (nodeId: string) => void;
  onReload?: (nodeId: string) => void;
  showReloadButton?: boolean;
  isReloading?: boolean;
}

export const FamilyNode = memo(({ data, selected, onInfoClick, onReload, showReloadButton, isReloading }: FamilyNodeProps) => {
  const isDeceased = data.is_alive === false;
  const isPending = data.invitation_status === 'pending';
  const isSelected = selected;

  return (
    <div className="relative">
      <div
        className={cn(
          'w-36 h-44 rounded-2xl border border-[#D4C4A8]/60 flex flex-col items-center p-2.5 transition-all shadow-md hover:shadow-lg',
          // Gender-based subtle gradient
          data.gender === 'male'
            ? 'bg-gradient-to-br from-[#EAF4ED] to-[#FDFAF5]'
            : 'bg-gradient-to-br from-[#F5EDE4] to-[#FDFAF5]',
          // Selected state with glow
          isSelected && 'border-2 border-[#4A7C59] bg-[#EAF4ED] shadow-[0_0_0_3px_rgba(74,124,89,0.15)]',
          // Deceased
          isDeceased && 'grayscale opacity-70',
          // Pending with stripe pattern
          isPending && 'border-dashed border-[#C4922A] bg-[repeating-linear-gradient(45deg,#F5E8C8,#F5E8C8_4px,#FDFAF5_4px,#FDFAF5_12px)]'
        )}
      >
        {/* Deceased subtle cross overlay */}
        {isDeceased && (
          <div className="absolute inset-0 rounded-2xl bg-[repeating-linear-gradient(135deg,#00000010_0,#00000010_1px,transparent_1px,transparent_4px)] pointer-events-none" />
        )}

        {/* Status badge - top right */}
        {isPending && (
          <div className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-amber-500 rounded-full flex items-center justify-center text-white text-[10px] font-bold shadow-sm z-10">
            !
          </div>
        )}

        {!isPending && !isDeceased && (
          <span className="animate-pulse w-3 h-3 rounded-full bg-[#4A7C59] ring-2 ring-white absolute -top-1 -right-1 z-10" />
        )}

        {/* Reload button - top right (outside, only when needed) */}
        {showReloadButton && onReload && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onReload(data.id);
            }}
            disabled={isReloading}
            className="absolute -top-2 -right-2 w-6 h-6 bg-white shadow-sm border border-[#D4C4A8] hover:bg-[#F5F0E8] rounded-full flex items-center justify-center transition-colors z-10 disabled:opacity-70"
            title={isReloading ? "Memuat..." : "Muat relasi tambahan"}
          >
            {isReloading ? (
              <div className="w-3.5 h-3.5 border-2 border-[#4A7C59] border-t-transparent rounded-full animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5 text-[#4A7C59]" />
            )}
          </button>
        )}

        {/* Info button - INSIDE the node, top-left (away from reload on right) */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onInfoClick?.(data.id);
          }}
          className="absolute top-1.5 left-1.5 w-5 h-5 bg-white/90 shadow-sm border border-[#D4C4A8] hover:bg-white rounded-full flex items-center justify-center transition-colors z-10"
          title="Info"
        >
          <Info className="h-3 w-3 text-[#6B5B45]" />
        </button>

        {/* Avatar - larger with gender ring */}
        <div
          className={cn(
            'w-20 h-20 rounded-full overflow-hidden mb-2 border-2 border-white shadow-sm flex-shrink-0',
            data.gender === 'male'
              ? 'ring-2 ring-[#4A7C59] ring-offset-2 ring-offset-[#FDFAF5]'
              : 'ring-2 ring-[#C4922A] ring-offset-2 ring-offset-[#FDFAF5]'
          )}
        >
          {data.photo_url ? (
            <img
              src={data.photo_url}
              alt={data.full_name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-[#4A7C59] to-[#2E5239] flex items-center justify-center text-2xl font-bold text-white">
              {data.full_name.charAt(0).toUpperCase()}
            </div>
          )}
        </div>

        {/* Name */}
        <div className="text-[13px] font-semibold text-[#2C1A0E] tracking-tight text-center truncate w-full px-1 leading-tight">
          {data.full_name}
        </div>

        {/* Nasab line: "binti/bin" tegak, nama ayah (depan saja) italic */}
        {data.nasab_line && (
          <div className="text-[10px] text-[#A07850] text-center truncate w-full px-1 mt-0.5">
            {data.gender === 'male' ? (
              <>
                <span className="not-italic font-medium text-[#4A7C59]">bin </span>
                <span className="italic">{data.nasab_line.replace(/^bin\s*/i, '')}</span>
              </>
            ) : (
              <>
                <span className="not-italic font-medium text-[#4A7C59]">binti </span>
                <span className="italic">{data.nasab_line.replace(/^binti\s*/i, '')}</span>
              </>
            )}
          </div>
        )}

        {/* Gender pill badge - inside card at bottom */}
        <div className="mt-auto mb-1">
          <span
            className={cn(
              'text-[9px] px-2 py-0.5 rounded-full font-medium tracking-wide',
              data.gender === 'male'
                ? 'bg-[#4A7C59]/10 text-[#4A7C59]'
                : 'bg-[#C4922A]/10 text-[#C4922A]'
            )}
          >
            {data.gender === 'male' ? 'Laki-laki' : 'Perempuan'}
          </span>
        </div>

        {/* Pending label */}
        {isPending && (
          <div className="text-[10px] text-[#C4922A] font-medium -mt-0.5 mb-0.5">
            Menunggu
          </div>
        )}
      </div>

      {/* Connection Handles - positions unchanged */}
      <Handle type="source" position={Position.Right} id="right" />
      <Handle type="target" position={Position.Left} id="left" />
      <Handle type="source" position={Position.Bottom} id="bottom" />
      <Handle type="target" position={Position.Top} id="top" />
    </div>
  );
});

FamilyNode.displayName = 'FamilyNode';