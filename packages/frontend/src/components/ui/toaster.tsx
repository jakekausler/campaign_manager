import { Toaster as Sonner } from 'sonner';

/**
 * Toast notification component for the application.
 * Uses sonner library for accessible, lightweight toast notifications.
 *
 * @example
 * ```tsx
 * import { Toaster } from '@/components/ui/toaster';
 *
 * // Add to root layout/app component
 * <Toaster />
 * ```
 *
 * @see https://sonner.emilkowal.ski/ for usage documentation
 */
export function Toaster() {
  return (
    <Sonner
      position="bottom-right"
      toastOptions={{
        classNames: {
          toast:
            'group toast group-[.toaster]:bg-white group-[.toaster]:text-slate-950 group-[.toaster]:border-slate-200 group-[.toaster]:shadow-lg',
          description: 'group-[.toast]:text-slate-500',
          actionButton: 'group-[.toast]:bg-slate-900 group-[.toast]:text-slate-50',
          cancelButton: 'group-[.toast]:bg-slate-100 group-[.toast]:text-slate-500',
          error:
            'group toast-error group-[.toaster]:bg-red-50 group-[.toaster]:text-red-900 group-[.toaster]:border-red-200',
          success:
            'group toast-success group-[.toaster]:bg-green-50 group-[.toaster]:text-green-900 group-[.toaster]:border-green-200',
          warning:
            'group toast-warning group-[.toaster]:bg-yellow-50 group-[.toaster]:text-yellow-900 group-[.toaster]:border-yellow-200',
          info: 'group toast-info group-[.toaster]:bg-blue-50 group-[.toaster]:text-blue-900 group-[.toaster]:border-blue-200',
        },
      }}
      richColors
    />
  );
}
