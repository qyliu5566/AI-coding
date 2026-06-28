import { Toaster as Sonner } from 'sonner'

export function Toaster(): React.JSX.Element {
  return (
    <Sonner
      position="bottom-right"
      toastOptions={{
        style: {
          background: 'var(--popover)',
          color: 'var(--popover-foreground)',
          border: '1px solid var(--border)'
        }
      }}
    />
  )
}
