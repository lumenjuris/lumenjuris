import React from 'react'

const loaderStyles = `
  @keyframes ljSpin  { to { transform: rotate(360deg); } }
  @keyframes ljFade  { 0%,100%{opacity:.45} 50%{opacity:1} }
  @keyframes ljDot   { 0%,80%,100%{background:#d1d5db;transform:scale(1)} 40%{background:#1a6cf5;transform:scale(1.35)} }
    @keyframes pulse {  
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.25); }
  }
`

interface LoaderProps {
    label?: string
    color?: string //Défaut : "#1a6cf5"
    showLogo?: boolean
    fullScreen?: boolean
    fadeOut?: boolean
}

/**
 * 
 * @param LoaderProps
 * @returns 
 */
export const Loader: React.FC<LoaderProps> = ({
    label = 'Chargement...',
    color = '#1a6cf5',
    showLogo = true,
    fullScreen = true,
}) => (
    <div
        role="status"
        aria-label={label}
        style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: fullScreen ? '100vh' : '240px',
            background: '#ffffff',
            fontFamily: 'Inter, system-ui, sans-serif',

        }}
    >
        <style>{loaderStyles.replace(/#1a6cf5/g, color)}</style>

        {showLogo && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 40 }}>
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="22 20 24 36"
                    height="30"
                    aria-label="LumenJuris"
                    role="img"
                    style={{
                        animation: 'pulse 1s ease-in-out infinite'
                    }}
                >
                    <circle cx="34" cy="40" fill="none" r="9" stroke="#0D6EFD" stroke-width="2"></circle>
                    <circle cx="34" cy="40" fill="#0D6EFD" r="4"></circle>
                </svg>
                <span style={{ fontSize: 24, fontWeight: 600, color: '#111827', letterSpacing: '-0.3px' }}>
                    Lumen Juris
                </span>
            </div>
        )}

        <div style={{ width: 56, height: 56, marginBottom: 28 }}>
            <div style={{
                width: 56,
                height: 56,
                borderRadius: '50%',
                border: '2.5px solid #e5e9f0',
                borderTopColor: color,
                animation: 'ljSpin 0.85s linear infinite',
            }} />
        </div>

        <span style={{
            fontSize: 14,
            fontWeight: 500,
            color: '#6b7280',
            animation: 'ljFade 1.8s ease-in-out infinite',
        }}>
            {label}
        </span>

        <div style={{ display: 'flex', gap: 6, marginTop: 20 }} aria-hidden="true">
            {[0, 0.2, 0.4].map((delay, i) => (
                <div key={i} style={{
                    width: 5,
                    height: 5,
                    borderRadius: '50%',
                    animation: `ljDot 1.4s ease-in-out ${delay}s infinite`,
                }} />
            ))}
        </div>
    </div>
)

