import { Leaf, Rose } from 'lucide-react'

export default function ThemeToggle({ theme, onToggle }) {
  const verdant = theme === 'verdant'

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={onToggle}
      aria-label={verdant ? 'Switch to Rosé theme' : 'Switch to Verdant theme'}
      title={verdant ? 'Rosé' : 'Verdant'}
    >
      {verdant ? <Rose size={17} /> : <Leaf size={17} />}
    </button>
  )
}
