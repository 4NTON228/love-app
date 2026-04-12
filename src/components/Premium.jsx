import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useSubscription } from '../hooks/useSubscription'

const FEATURES = [
  {
    icon: '🤖',
    title: 'ИИ-советник для пары',
    desc: 'Персональные советы и анализ отношений на основе ИИ',
  },
  {
    icon: '📸',
    title: 'Безлимитные воспоминания',
    desc: 'Сохраняйте фото и моменты без ограничений',
  },
  {
    icon: '💌',
    title: 'Капсула времени',
    desc: 'Отправляйте письма в будущее — себе и партнёру',
  },
  {
    icon: '🔮',
    title: 'Синхро-зеркало',
    desc: 'Совместные вопросы для лучшего понимания друг друга',
  },
  {
    icon: '📔',
    title: 'Журнал настроения',
    desc: 'Личный дневник с ИИ-рефлексией',
  },
  {
    icon: '🔔',
    title: 'Push-уведомления',
    desc: 'Получай уведомления о сообщениях и важных датах',
  },
  {
    icon: '📅',
    title: 'Умный календарь',
    desc: 'Совместное планирование и напоминания о датах',
  },
]

const PLANS = [
  { id: 'premium',        label: 'Месяц',  price: 299,  per: '299 ₽/мес',  badge: null,        saving: null },
  { id: 'premium_yearly', label: 'Год',    price: 2490, per: '207 ₽/мес',  badge: 'Выгода 30%', saving: 'Экономия 1098 ₽' },
]

export default function Premium({ session }) {
  const [plan, setPlan] = useState('premium_yearly')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const { isPremium, expiresAt, refresh } = useSubscription(session)

  async function handleSubscribe() {
    setLoading(true)
    setError(null)
    try {
      const { data: { session: s } } = await supabase.auth.getSession()
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/yookassa?action=create`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${s?.access_token}`,
          },
          body: JSON.stringify({ plan, returnUrl: window.location.origin + '/?tab=premium&payment=success' }),
        }
      )
      const data = await res.json()
      if (!res.ok || !data.confirmation_url) throw new Error(data.error || 'Ошибка создания платежа')
      window.location.href = data.confirmation_url
    } catch (e) {
      setError(e.message)
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--page-bg, #FBF0F2)', paddingBottom: 100 }}>
      <style>{`
        .prem-hero {
          background: linear-gradient(175deg, #0D0305 0%, #220810 40%, #46101F 70%, #2E0C18 100%);
          padding: 60px 24px 40px;
          text-align: center;
          position: relative;
          overflow: hidden;
        }
        .prem-hero::before {
          content:''; position:absolute; top:-60px; left:50%; transform:translateX(-50%);
          width:320px; height:320px;
          background:radial-gradient(ellipse, rgba(200,51,74,0.4) 0%, transparent 68%);
          pointer-events:none;
        }
        .prem-star {
          display:inline-flex; align-items:center; gap:6px;
          background:rgba(200,51,74,0.2); border:0.5px solid rgba(200,51,74,0.5);
          border-radius:20px; padding:5px 14px; font-size:12px; color:#FF8FA5;
          font-weight:600; margin-bottom:16px; position:relative;
        }
        .prem-hero-title {
          font-family: var(--font-display, 'Cormorant Garamond', Georgia, serif);
          font-size: 36px; color: white; font-style: italic;
          line-height: 1.15; margin-bottom: 10px; position:relative;
        }
        .prem-hero-sub { font-size:14px; color:rgba(255,255,255,0.55); position:relative; }
        .prem-active-badge {
          display:flex; align-items:center; gap:10px;
          background:rgba(50,200,100,0.15); border:1px solid rgba(50,200,100,0.3);
          border-radius:16px; padding:14px 18px; margin:16px 16px 0;
        }
        .prem-section { padding: 24px 16px 0; }
        .prem-section-title { font-size:12px; font-weight:700; color:#9A6070; text-transform:uppercase; letter-spacing:1px; margin-bottom:14px; }
        .prem-features { display:flex; flex-direction:column; gap:12px; }
        .prem-feature {
          display:flex; align-items:flex-start; gap:14px;
          background:white; border-radius:16px; padding:14px 16px;
          box-shadow:0 2px 12px rgba(200,51,74,0.06);
          border:0.5px solid rgba(200,51,74,0.08);
        }
        .app.dark .prem-feature { background:#2C1018; border-color:rgba(200,51,74,0.15); }
        .prem-feature-icon { font-size:24px; line-height:1; }
        .prem-feature-title { font-size:14px; font-weight:600; color:var(--text,#1C0A0E); margin-bottom:2px; }
        .prem-feature-desc { font-size:12px; color:var(--text-muted,#9A6070); line-height:1.4; }
        .prem-plans { display:flex; gap:12px; padding:0 16px; margin-top:20px; }
        .prem-plan {
          flex:1; padding:18px 12px; border-radius:20px; cursor:pointer; position:relative;
          border:2px solid rgba(200,51,74,0.15); background:white;
          text-align:center; transition:all 0.2s;
          box-shadow:0 2px 12px rgba(200,51,74,0.06);
        }
        .app.dark .prem-plan { background:#2C1018; }
        .prem-plan.selected { border-color:#C8334A; background:rgba(200,51,74,0.05); }
        .prem-plan-badge {
          position:absolute; top:-11px; left:50%; transform:translateX(-50%);
          background:linear-gradient(135deg,#C8334A,#8B1A2C); color:white;
          font-size:10px; font-weight:700; padding:3px 10px; border-radius:10px; white-space:nowrap;
        }
        .prem-plan-name { font-size:13px; color:var(--text-muted,#9A6070); margin-bottom:6px; }
        .prem-plan-price { font-size:26px; font-weight:800; color:var(--text,#1C0A0E); }
        .prem-plan-price span { font-size:14px; font-weight:400; }
        .prem-plan-per { font-size:11px; color:#C8334A; margin-top:3px; font-weight:600; }
        .prem-plan-saving { font-size:10px; color:#9A6070; margin-top:2px; }
        .prem-cta { padding:20px 16px 0; }
        .prem-btn {
          width:100%; padding:17px; border:none; border-radius:18px;
          font-size:16px; font-weight:700; letter-spacing:0.3px;
          background:linear-gradient(135deg,#C8334A 0%,#8B1A2C 100%);
          color:white; cursor:pointer;
          box-shadow:0 8px 32px rgba(200,51,74,0.35);
          transition:opacity 0.2s, transform 0.15s;
        }
        .prem-btn:active { transform:scale(0.98); }
        .prem-btn:disabled { opacity:0.6; }
        .prem-note { text-align:center; font-size:11px; color:#9A6070; margin-top:12px; line-height:1.7; padding:0 16px; }
        .prem-error { margin:12px 16px 0; background:rgba(255,80,80,0.08); border:0.5px solid rgba(255,80,80,0.3); border-radius:12px; padding:10px 14px; font-size:13px; color:#C04040; text-align:center; }
      `}</style>

      {/* Hero */}
      <div className="prem-hero">
        <div className="prem-star">
          <svg viewBox="0 0 24 24" width="12" height="12" fill="#FF8FA5">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
          </svg>
          Premium
        </div>
        <h1 className="prem-hero-title">Любовь<br/>без ограничений</h1>
        <p className="prem-hero-sub">Одна подписка — для вас двоих</p>
      </div>

      {/* Active subscription banner */}
      {isPremium && (
        <div className="prem-active-badge">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#32C864" strokeWidth="2">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
            <polyline points="22 4 12 14.01 9 11.01"/>
          </svg>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#1C7A3C' }}>Подписка активна</div>
            {expiresAt && (
              <div style={{ fontSize: 12, color: '#5A9A6C' }}>
                Действует до {new Date(expiresAt).toLocaleDateString('ru-RU')}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Features */}
      <div className="prem-section">
        <div className="prem-section-title">Что входит в Premium</div>
        <div className="prem-features">
          {FEATURES.map(f => (
            <div key={f.title} className="prem-feature">
              <div className="prem-feature-icon">{f.icon}</div>
              <div>
                <div className="prem-feature-title">{f.title}</div>
                <div className="prem-feature-desc">{f.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Plans */}
      {!isPremium && (
        <>
          <div className="prem-section" style={{ paddingBottom: 0 }}>
            <div className="prem-section-title">Выберите план</div>
          </div>
          <div className="prem-plans">
            {PLANS.map(p => (
              <div key={p.id} className={`prem-plan${plan === p.id ? ' selected' : ''}`} onClick={() => setPlan(p.id)}>
                {p.badge && <div className="prem-plan-badge">{p.badge}</div>}
                <div className="prem-plan-name">{p.label}</div>
                <div className="prem-plan-price">{p.price}<span> ₽</span></div>
                <div className="prem-plan-per">{p.per}</div>
                {p.saving && <div className="prem-plan-saving">{p.saving}</div>}
              </div>
            ))}
          </div>

          {error && <div className="prem-error">{error}</div>}

          <div className="prem-cta">
            <button className="prem-btn" onClick={handleSubscribe} disabled={loading}>
              {loading ? 'Переходим к оплате...' : 'Оформить подписку'}
            </button>
          </div>

          <p className="prem-note">
            Безопасная оплата · Карты, SberPay, СБП, ЮMoney<br/>
            Отменить подписку можно в любой момент в настройках
          </p>
        </>
      )}
    </div>
  )
}
