import { useState, useEffect } from 'react'

export default function ThemeToggle({ darkMode, toggleDarkMode }) {
  return (
    <button
      onClick={toggleDarkMode}
      style={{
        position: 'fixed',
        top: 'calc(var(--safe-top) + 16px)',
        right: '16px',
        zIndex: 150,
        width: '48px',
        height: '48px',
        borderRadius: '50%',
        border: 'none',
        background: darkMode 
          ? 'rgba(30, 27, 46, 0.8)' 
          : 'rgba(255, 255, 255, 0.8)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: `1px solid ${darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.5)'}`,
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '22px',
        transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
        transform: 'scale(1)',
      }}
      onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.1) rotate(15deg)'}
      onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1) rotate(0deg)'}
      onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.95)'}
      onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
    >
      <span style={{ 
        display: 'inline-block',
        transition: 'transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
        transform: darkMode ? 'rotate(360deg)' : 'rotate(0deg)'
      }}>
        {darkMode ? '🌙' : '☀️'}
      </span>
    </button>
  )
}
