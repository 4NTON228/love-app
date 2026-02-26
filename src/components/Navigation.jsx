import { Home, CalendarHeart, Heart, ListChecks, MessageCircleHeart } from 'lucide-react'

export default function Navigation({ activeTab, setActiveTab, darkMode, toggleDarkMode }) {
  const tabs = [
    { id: 'home', label: 'Главная', icon: Home },
    { id: 'chat', label: 'Чат', icon: MessageCircleHeart },
    { id: 'calendar', label: 'Календарь', icon: CalendarHeart },
    { id: 'moments', label: 'Моменты', icon: Heart },
    { id: 'plans', label: 'Планы', icon: ListChecks },
  ]

  return (
    <nav className="nav">
      {tabs.map(tab => (
        <button
          key={tab.id}
          className={`nav-item ${activeTab === tab.id ? 'active' : ''}`}
          onClick={() => setActiveTab(tab.id)}
        >
          <tab.icon size={24} strokeWidth={activeTab === tab.id ? 2.5 : 1.8} />
          <span>{tab.label}</span>
        </button>
      ))}
      <button
        className="nav-item nav-theme-btn"
        onClick={toggleDarkMode}
        aria-label="Сменить тему"
      >
        <span style={{ fontSize: 22, lineHeight: 1 }}>{darkMode ? '☀️' : '🌙'}</span>
        <span>{darkMode ? 'Светлая' : 'Тёмная'}</span>
      </button>
    </nav>
  )
}
