/**
 * Paywall — экран подписки
 *
 * Использование:
 *   import { useSubscription } from '../hooks/useSubscription'
 *   const { isPremium } = useSubscription()
 *   if (!isPremium) return <Paywall onClose={() => ...} />
 */
import { useState } from 'react'
import { supabase } from '../lib/supabase'

const FEATURES = [
  'ИИ-советник для пары',
  'Безлимитные воспоминания и фото',
  'Капсула времени — сообщения в будущее',
  'Синхро-зеркало — вопросы о совместимости',
  'Эмоциональный переводчик',
  'Журнал настроения',
  'Push-уведомления',
]

const PLANS = [
  { id: 'premium', label: 'Месяц', price: 299, per: '299 ₽/мес', badge: null },
  { id: 'premium_yearly', label: 'Год', price: 2490, per: '207 ₽/мес', badge: 'Выгода 30%' },
]

export default function Paywall({ onClose, session: _session }) {
  const [plan, setPlan] = useState('premium_yearly')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

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
          body: JSON.stringify({ plan, returnUrl: window.location.origin }),
        }
      )
      const data = await res.json()
      if (!res.ok || !data.confirmation_url) throw new Error(data.error || 'Ошибка')
      window.location.href = data.confirmation_url
    } catch (e) {
      setError(e.message)
      setLoading(false)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'rgba(14,3,8,0.85)', backdropFilter: 'blur(12px)',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    }} onClick={e => e.target === e.currentTarget && onClose?.()}>
      <style>{`
        .pw-sheet {
          width: 100%; max-width: 480px;
          background: linear-gradient(175deg, #1A0610 0%, #2D1018 50%, #1A0610 100%);
          border-radius: 28px 28px 0 0;
          padding: 28px 24px calc(var(--safe-bottom,0px) + 32px);
          animation: slideUp 0.35s cubic-bezier(0.34,1.56,0.64,1) both;
        }
        .pw-handle { width:36px; height:4px; background:rgba(255,255,255,0.2); border-radius:99px; margin:0 auto 24px; }
        .pw-badge { display:inline-flex; align-items:center; gap:6px; background:rgba(200,51,74,0.18); border:0.5px solid rgba(200,51,74,0.4); border-radius:20px; padding:5px 12px; font-size:12px; color:#FF8FA5; margin-bottom:14px; }
        .pw-title { font-family:var(--font-display); font-size:28px; color:white; margin-bottom:6px; font-style:italic; line-height:1.2; }
        .pw-sub { font-size:13px; color:rgba(255,255,255,0.55); margin-bottom:22px; }
        .pw-features { list-style:none; margin-bottom:24px; display:flex; flex-direction:column; gap:10px; }
        .pw-feature { display:flex; align-items:center; gap:10px; font-size:14px; color:rgba(255,255,255,0.85); }
        .pw-check { width:20px; height:20px; border-radius:50%; background:linear-gradient(135deg,#C8334A,#8B1A2C); display:flex; align-items:center; justify-content:center; flex-shrink:0; }
        .pw-plans { display:flex; gap:10px; margin-bottom:20px; }
        .pw-plan {
          flex:1; padding:14px 10px; border-radius:16px; cursor:pointer; position:relative;
          border:1.5px solid rgba(255,255,255,0.12); background:rgba(255,255,255,0.05);
          text-align:center; transition:all 0.2s; color:white;
        }
        .pw-plan.selected { border-color:#C8334A; background:rgba(200,51,74,0.15); }
        .pw-plan-name { font-size:14px; font-weight:600; margin-bottom:4px; }
        .pw-plan-price { font-size:22px; font-weight:700; color:#FF8FA5; }
        .pw-plan-per { font-size:11px; color:rgba(255,255,255,0.45); margin-top:2px; }
        .pw-plan-badge { position:absolute; top:-10px; left:50%; transform:translateX(-50%); background:#C8334A; color:white; font-size:10px; font-weight:700; padding:2px 8px; border-radius:10px; white-space:nowrap; }
        .pw-btn {
          width:100%; padding:16px; border:none; border-radius:16px; font-size:16px; font-weight:700;
          background:linear-gradient(135deg,#C8334A,#8B1A2C); color:white; cursor:pointer;
          box-shadow:0 8px 32px rgba(200,51,74,0.4); transition:opacity 0.2s,transform 0.15s;
          display:flex; align-items:center; justify-content:center; gap:8px;
        }
        .pw-btn:active { transform:scale(0.98); }
        .pw-btn:disabled { opacity:0.6; }
        .pw-note { text-align:center; font-size:11px; color:rgba(255,255,255,0.3); margin-top:12px; line-height:1.6; }
        .pw-error { background:rgba(255,80,80,0.12); border:0.5px solid rgba(255,80,80,0.3); border-radius:12px; padding:10px; font-size:13px; color:#FFB3B3; margin-bottom:12px; text-align:center; }
      `}</style>

      <div className="pw-sheet">
        <div className="pw-handle" />

        <div className="pw-badge">
          <svg viewBox="0 0 24 24" width="12" height="12" fill="#FF8FA5">
            <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/>
          </svg>
          Premium
        </div>

        <h2 className="pw-title">Любовь<br />без ограничений</h2>
        <p className="pw-sub">Одна подписка — для вас двоих</p>

        <ul className="pw-features">
          {FEATURES.map(f => (
            <li key={f} className="pw-feature">
              <div className="pw-check">
                <svg viewBox="0 0 12 12" width="10" height="10" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
                  <polyline points="2,6 5,9 10,3" />
                </svg>
              </div>
              {f}
            </li>
          ))}
        </ul>

        <div className="pw-plans">
          {PLANS.map(p => (
            <div key={p.id} className={`pw-plan ${plan === p.id ? 'selected' : ''}`} onClick={() => setPlan(p.id)}>
              {p.badge && <div className="pw-plan-badge">{p.badge}</div>}
              <div className="pw-plan-name">{p.label}</div>
              <div className="pw-plan-price">{p.price} ₽</div>
              <div className="pw-plan-per">{p.per}</div>
            </div>
          ))}
        </div>

        {error && <div className="pw-error">{error}</div>}

        <button className="pw-btn" onClick={handleSubscribe} disabled={loading}>
          {loading ? (
            <>Переходим к оплате...</>
          ) : (
            <>
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="white" strokeWidth="2">
                <rect x="1" y="4" width="22" height="16" rx="2"/>
                <line x1="1" y1="10" x2="23" y2="10"/>
              </svg>
              Оформить подписку
            </>
          )}
        </button>

        <p className="pw-note">
          Безопасная оплата через ЮKassa · Карты, SberPay, СБП, ЮMoney<br/>
          Отменить можно в любой момент в настройках
        </p>
      </div>
    </div>
  )
}
