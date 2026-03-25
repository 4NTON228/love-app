import React from 'react'

export default function GlassButton({ 
  children, 
  onClick, 
  variant = 'primary', 
  size = 'md',
  disabled = false,
  style = {}
}) {
  const baseStyles = {
    border: 'none',
    borderRadius: '16px',
    fontFamily: 'var(--font-body)',
    fontWeight: 700,
    cursor: disabled ? 'not-allowed' : 'pointer',
    transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    position: 'relative',
    overflow: 'hidden',
  }
  
  const variants = {
    primary: {
      background: 'linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%)',
      color: 'white',
      boxShadow: '0 4px 20px rgba(232, 70, 106, 0.3)',
    },
    secondary: {
      background: 'var(--glass-bg)',
      backdropFilter: 'blur(20px)',
      border: '1px solid var(--glass-border)',
      color: 'var(--text)',
      boxShadow: 'var(--glass-shadow)',
    },
    ghost: {
      background: 'transparent',
      color: 'var(--text-light)',
    }
  }
  
  const sizes = {
    sm: { padding: '10px 16px', fontSize: '13px' },
    md: { padding: '16px 24px', fontSize: '15px' },
    lg: { padding: '20px 32px', fontSize: '17px' },
  }
  
  const combinedStyles = {
    ...baseStyles,
    ...variants[variant],
    ...sizes[size],
    ...style,
    opacity: disabled ? 0.5 : 1,
  }
  
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={combinedStyles}
      onMouseEnter={(e) => {
        if (!disabled) {
          e.currentTarget.style.transform = 'translateY(-2px) scale(1.02)'
          e.currentTarget.style.boxShadow = variant === 'primary' 
            ? '0 8px 30px rgba(232, 70, 106, 0.4)' 
            : 'var(--glass-shadow-lg)'
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0) scale(1)'
        e.currentTarget.style.boxShadow = variants[variant].boxShadow
      }}
      onMouseDown={(e) => {
        if (!disabled) e.currentTarget.style.transform = 'translateY(0) scale(0.98)'
      }}
      onMouseUp={(e) => {
        if (!disabled) e.currentTarget.style.transform = 'translateY(-2px) scale(1.02)'
      }}
    >
      {variant === 'primary' && (
        <span
          style={{
            position: 'absolute',
            top: 0,
            left: '-100%',
            width: '100%',
            height: '100%',
            background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)',
            transition: 'left 0.6s',
          }}
          className="shimmer"
        />
      )}
      <span style={{ position: 'relative', zIndex: 1 }}>{children}</span>
    </button>
  )
}
