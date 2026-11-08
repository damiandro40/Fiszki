import { useEffect, useState } from 'react'
import { Search } from 'lucide-react'
import useDebouncedValue from '../../hooks/useDebouncedValue'
import Input from './Input'

interface DebouncedSearchInputProps {
  onSearchChange: (query: string) => void
  placeholder: string
  ariaLabel: string
  delay?: number
}

/** Owns keystroke state so large result lists don't re-render on every key. */
const DebouncedSearchInput = ({ onSearchChange, placeholder, ariaLabel, delay = 180 }: DebouncedSearchInputProps) => {
  const [value, setValue] = useState('')
  const settled = useDebouncedValue(value, delay)

  useEffect(() => onSearchChange(settled), [settled, onSearchChange])

  return <Input size="sm" containerClassName="min-h-10" icon={<Search size={16}/>} type="search" aria-label={ariaLabel}
    placeholder={placeholder} value={value} onChange={event => setValue(event.target.value)}/>
}

export default DebouncedSearchInput
