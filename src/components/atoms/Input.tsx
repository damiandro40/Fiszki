import { forwardRef } from 'react'
import type { InputHTMLAttributes, ReactNode } from 'react'
import { tv, type VariantProps } from 'tailwind-variants'

// One focusable field inside one focusable-looking container. Decorations never draw
// their own borders or focus rings, avoiding the nested outline seen in search boxes.
const styles = tv({
  slots: {
    root: 'flex min-w-0 w-full items-center gap-2.5 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] text-[var(--muted)] transition-[border-color,box-shadow,background-color] duration-150 focus-within:border-[var(--accent)] focus-within:ring-2 focus-within:ring-[var(--accent-soft)] hover:border-[var(--scroll-hover)]',
    field: 'min-w-0 w-full flex-1 border-0 !bg-transparent p-0 text-[var(--text)] placeholder:text-[var(--faint)] focus:!outline-none focus:!ring-0 focus-visible:!outline-none disabled:cursor-not-allowed',
    decoration: 'inline-flex shrink-0 items-center text-[var(--muted)]',
    prefix: 'shrink-0 text-[var(--faint)]'
  },
  variants: {
    size: {
      sm: { root: 'min-h-9 px-3 text-xs', field: 'text-xs' },
      md: { root: 'min-h-11 px-3.5 text-sm', field: 'text-sm' },
      lg: { root: 'min-h-12 px-4 text-sm', field: 'text-sm' }
    },
    disabled: { true: { root: 'cursor-not-allowed opacity-50' }, false: {} },
    invalid: { true: { root: 'border-[var(--danger-border)] focus-within:border-[var(--red)] focus-within:ring-[var(--red-soft)]' }, false: {} }
  },
  defaultVariants: { size: 'md', disabled: false, invalid: false }
})

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size' | 'prefix'>, Omit<VariantProps<typeof styles>, 'disabled'> {
  icon?: ReactNode
  endIcon?: ReactNode
  prefix?: ReactNode
  suffix?: ReactNode
  trailing?: ReactNode
  containerClassName?: string
}

const Input = forwardRef<HTMLInputElement, InputProps>(({
  size = 'md', invalid = false, icon, endIcon, prefix, suffix, trailing,
  containerClassName, className, disabled, ...props
}, ref) => {
  const { root, field, decoration, prefix: prefixStyle } = styles({ size, disabled, invalid })
  return <div className={root({ className: containerClassName })}>
    {icon && <span className={decoration()} aria-hidden="true">{icon}</span>}
    {prefix && <span className={prefixStyle()}>{prefix}</span>}
    <input {...props} ref={ref} disabled={disabled} aria-invalid={invalid || undefined} className={field({ className })}/>
    {suffix && <span className={prefixStyle()}>{suffix}</span>}
    {endIcon && <span className={decoration()} aria-hidden="true">{endIcon}</span>}
    {trailing}
  </div>
})
Input.displayName = 'Input'

export default Input
