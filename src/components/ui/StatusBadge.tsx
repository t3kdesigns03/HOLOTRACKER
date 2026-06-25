// src/components/ui/StatusBadge.tsx
import { cn } from '@/lib/utils'
import { STATUS_COLORS, STATUS_LABELS, type CardStatus } from '@/types'

export function StatusBadge({ status }: { status: CardStatus }) {
  return (
    <span className={cn(
      'inline-flex items-center px-2 py-0.5 rounded-md border text-[11px] font-medium',
      STATUS_COLORS[status]
    )}>
      {STATUS_LABELS[status]}
    </span>
  )
}
