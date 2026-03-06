import * as React from 'react'
import * as ToastPrimitives from '@radix-ui/react-toast'
import { X } from 'lucide-react'
import { cn } from '../../lib/utils'

export function useToast() {
  const [open, setOpen] = React.useState(false)
  const [message, setMessage] = React.useState('')

  const toast = React.useCallback((text: string) => {
    setMessage(text)
    setOpen(false)
    requestAnimationFrame(() => setOpen(true))
  }, [])

  return { open, setOpen, message, toast }
}

export function ToastRoot({ open, onOpenChange, message }: { open: boolean; onOpenChange: (value: boolean) => void; message: string }) {
  return (
    <ToastPrimitives.Provider>
      <ToastPrimitives.Root
        open={open}
        onOpenChange={onOpenChange}
        className={cn('rounded-xl border border-border bg-surface px-4 py-3 text-sm text-text shadow-soft')}
      >
        <ToastPrimitives.Title className="pr-6">{message}</ToastPrimitives.Title>
        <ToastPrimitives.Close className="absolute right-2 top-2 text-muted">
          <X className="h-4 w-4" />
        </ToastPrimitives.Close>
      </ToastPrimitives.Root>
      <ToastPrimitives.Viewport className="fixed bottom-4 right-4 z-[100] flex max-w-[320px] flex-col gap-2 outline-none" />
    </ToastPrimitives.Provider>
  )
}
