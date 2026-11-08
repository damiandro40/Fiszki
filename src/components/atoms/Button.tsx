import { forwardRef } from 'react'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { tv, type VariantProps } from 'tailwind-variants'
import Tooltip from './Tooltip'

// Intent controls the treatment; color controls the semantic meaning.
// Context menus, navigation, modal footers and destructive actions all share this recipe.
const styles = tv({
  slots: {
    button: [
      'group inline-flex shrink-0 items-center justify-center gap-2 rounded-[9px] border font-semibold whitespace-nowrap',
      'transition-[background-color,border-color,color,box-shadow] duration-150 ease-out',
      'enabled:cursor-pointer disabled:cursor-not-allowed disabled:opacity-45',
      'focus-visible:!outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-ink)]',
      'focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface)]'
    ],
    icon: 'inline-flex shrink-0 items-center justify-center opacity-75 transition-opacity duration-150 group-hover:opacity-100 group-active:opacity-100 group-focus-visible:opacity-100',
    label: 'inline-flex min-w-0 items-center justify-center gap-2'
  },
  variants: {
    intent: { solid: {}, outline: {}, soft: {}, ghost: {} },
    color: { primary: {}, neutral: {}, danger: {} },
    layout: {
      default: {},
      row: {
        button: 'w-full min-w-0 justify-start rounded-lg text-left font-medium whitespace-normal',
        label: 'flex-1 justify-start text-left'
      }
    },
    size: {
      sm: { button: 'min-h-[33px] px-2.5 text-[11px]' },
      md: { button: 'min-h-[41px] px-[17px] text-[12.5px]' },
      lg: { button: 'min-h-[46px] px-5 text-sm' }
    },
    iconOnly: { true: { button: '!min-h-0 !size-[33px] !p-0 rounded-lg' }, false: {} },
    selected: { true: {}, false: {} },
    fullWidth: { true: { button: 'w-full' }, false: {} }
  },
  compoundSlots: [
    { slots: ['button'], intent: 'solid', color: 'primary', class: 'border-transparent bg-[var(--accent)] text-[var(--accent-text)] enabled:hover:bg-[var(--accent-hover)] enabled:active:bg-[var(--accent-active)]' },
    { slots: ['button'], intent: 'outline', color: 'primary', class: 'border-[var(--accent-ink)]/50 bg-transparent text-[var(--accent-ink)] enabled:hover:bg-[var(--accent-soft)] enabled:active:bg-[var(--blue-soft)]' },
    { slots: ['button'], intent: 'soft', color: 'primary', class: 'border-transparent bg-[var(--accent-soft)] text-[var(--accent-ink)] enabled:hover:bg-[var(--blue-soft)] enabled:active:bg-[var(--accent-soft)]' },
    { slots: ['button'], intent: 'ghost', color: 'primary', class: 'border-transparent bg-transparent text-[var(--accent-ink)] enabled:hover:bg-[var(--accent-soft)] enabled:active:bg-[var(--blue-soft)]' },
    { slots: ['button'], intent: 'solid', color: 'neutral', class: 'border-[var(--surface-3)] bg-[var(--surface-3)] text-[var(--text)] enabled:hover:bg-[var(--interactive-hover-bg)] enabled:active:bg-[var(--interactive-active-bg)]' },
    { slots: ['button'], intent: 'outline', color: 'neutral', class: 'border-[var(--border)] bg-[var(--surface)] text-[var(--text)] enabled:hover:bg-[var(--interactive-hover-bg)] enabled:active:bg-[var(--interactive-active-bg)]' },
    { slots: ['button'], intent: 'soft', color: 'neutral', class: 'border-transparent bg-[var(--surface-2)] text-[var(--text)] enabled:hover:bg-[var(--interactive-hover-bg)] enabled:active:bg-[var(--interactive-active-bg)]' },
    { slots: ['button'], intent: 'ghost', color: 'neutral', class: 'border-transparent bg-transparent text-[var(--muted)] enabled:hover:bg-[var(--interactive-hover-bg)] enabled:hover:text-[var(--text)] enabled:active:bg-[var(--interactive-active-bg)]' },
    { slots: ['button'], intent: 'solid', color: 'danger', class: 'border-transparent bg-[var(--danger-solid)] text-white enabled:hover:bg-[var(--danger-solid-hover)] enabled:active:bg-[var(--danger-solid-active)]' },
    { slots: ['button'], intent: 'outline', color: 'danger', class: 'border-[var(--danger-border)] bg-transparent text-[var(--danger-ink)] enabled:hover:bg-[var(--danger-hover-bg)] enabled:active:bg-[var(--danger-active-bg)]' },
    { slots: ['button'], intent: 'soft', color: 'danger', class: 'border-transparent bg-[var(--danger-rest-bg)] text-[var(--danger-ink)] enabled:hover:bg-[var(--danger-hover-bg)] enabled:active:bg-[var(--danger-active-bg)]' },
    { slots: ['button'], intent: 'ghost', color: 'danger', class: 'border-transparent bg-transparent text-[var(--danger-ink)] enabled:hover:bg-[var(--danger-hover-bg)] enabled:active:bg-[var(--danger-active-bg)]' },
    { slots: ['button'], layout: 'row', selected: true, color: ['neutral', 'primary'], class: 'bg-[var(--accent-soft)] text-[var(--accent-ink)] enabled:hover:bg-[var(--blue-soft)] enabled:active:bg-[var(--accent-soft)]' },
    { slots: ['button'], layout: 'row', selected: true, color: 'danger', class: 'bg-[var(--danger-rest-bg)] text-[var(--danger-ink)] enabled:hover:bg-[var(--danger-hover-bg)]' }
  ],
  defaultVariants: { intent: 'outline', color: 'neutral', layout: 'default', size: 'md' }
})

type ButtonVariants = Omit<VariantProps<typeof styles>, 'iconOnly'>

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, ButtonVariants {
  icon?: ReactNode
  iconPosition?: 'start' | 'end'
}

export interface IconProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'>, Omit<ButtonVariants, 'layout' | 'fullWidth' | 'selected'> {
  label: string
  tooltip?: ReactNode | false
  children: ReactNode
  active?: boolean
}

const BaseButton = forwardRef<HTMLButtonElement, ButtonProps>(({
  className, intent = 'outline', color = 'neutral', layout = 'default', size = 'md', selected = false,
  fullWidth = false, icon, iconPosition = 'start', children, type = 'button', ...rest
}, ref) => {
  const { button, icon: iconStyle, label } = styles({ intent, color, layout, size, selected, fullWidth })
  const iconNode = icon && <span className={iconStyle()} aria-hidden="true">{icon}</span>

  return <button ref={ref} type={type} className={button({ className })} {...rest}>
    {iconPosition === 'start' && iconNode}
    <span className={label()}>{children}</span>
    {iconPosition === 'end' && iconNode}
  </button>
})
BaseButton.displayName = 'Button'

const IconButton = forwardRef<HTMLButtonElement, IconProps>(({
  label, tooltip, children, active = false, intent = 'ghost', color = 'neutral', size = 'md',
  className, type = 'button', disabled, ...rest
}, ref) => {
  const { button, icon } = styles({ intent, color: active ? 'primary' : color, size, iconOnly: true, selected: active })
  const element = <button ref={ref} type={type} aria-label={label} aria-pressed={active || undefined} disabled={disabled}
    className={button({ className: `${size === 'sm' ? '!size-[29px]' : ''} ${className || ''}` })} {...rest}>
    <span className={icon()} aria-hidden="true">{children}</span>
  </button>

  return tooltip === false || disabled ? element : <Tooltip label={tooltip ?? label}>{element}</Tooltip>
})
IconButton.displayName = 'Button.Icon'

const Button = Object.assign(BaseButton, { Icon: IconButton })
export default Button
