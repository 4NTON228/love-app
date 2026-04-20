import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useSubscription } from '../hooks/useSubscription'

const FEATURES = [
  {
    svg: <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/><path d="M8 12h8M12 8v8"/></svg>,
    title: 'ИИ-советник для пары',
    desc: 'Персональные рекомендации и анализ вашей связи',
  },
  {
    svg: <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>,
    title: 'Безлимитные воспоминания',
    desc: 'Фото и моменты без каких-либо ограничений',
  },
  {
    svg: <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2z"/><polyline points="22,6 12,13 2,6"/></svg>,
    title: 'Капсула времени',
    desc: 'Письма в будущее — откройте в нужный момент',
  },
  {
    svg: <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/></svg>,
    title: 'Синхро-зеркало',
    desc: 'Вопросы и игры для лучшего понимания друг друга',
  },
  {
    svg: <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>,
    title: 'Личный журнал',
    desc: 'Дневник настроения с ИИ-рефлексией',
  },
  {
    svg: <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>,
    title: 'Push-уведомления',
    desc: 'Мгновенные уведомления о сообщениях и датах',
  },
  {
    svg: <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
    title: 'Совместный календарь',
    desc: 'Планирование и напоминания о важных датах',
  },
]

const PLANS = [
  { id: 'premium',        label: 'Месяц',  price: '299',  suffix: '₽', per: '299 ₽ в месяц',  badge: null,          saving: null },
  { id: 'premium_yearly', label: 'Год',    price: '2 490', suffix: '₽', per: '207 ₽ в месяц', badge: 'Выгода 30%',  saving: 'Экономия 1 098 ₽' },
]

export default function Premium({ session }) {
  const [plan, setPlan] = useState('premium_yearly')
  const [loadingPay, setLoadingPay] = useState(false)
  const [error, setError] = useState(null)
  const { isPremium, expiresAt } = useSubscription(session)

  async function handleSubscribe() {
    setLoadingPay(true)
    setError(null)
    try {
      const { data: { session: s } } = await supabase.auth.getSession()
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/yookassa?action=create`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${s?.access_token}` },
          body: JSON.stringify({ plan, returnUrl: window.location.origin + '/?tab=premium&payment=success' }),
        }
      )
      const data = await res.json()
      if (!res.ok || !data.confirmation_url) throw new Error(data.error || 'Ошибка создания платежа')
      window.location.href = data.confirmation_url
    } catch (e) {
      setError(e.message)
      setLoadingPay(false)
    }
  }

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg,#F6F3EE)', paddingBottom: 100 }}>
      <style>{`
        /* ── Hero ── */
        .pm-hero {
          background: linear-gradient(170deg, #0C0B09 0%, #151210 40%, #1C1510 100%);
          padding: 60px 24px 44px;
          text-align: center;
          position: relative;
          overflow: hidden;
        }
        .pm-hero::before {
          content:'';
          position:absolute; top:-60px; left:50%; transform:translateX(-50%);
          width:300px; height:300px;
          background:radial-gradient(ellipse, rgba(168,40,60,0.15) 0%, transparent 65%);
          pointer-events:none;
        }
        .pm-crown {
          display:inline-flex; align-items:center; justify-content:center;
          width:48px; height:48px; border-radius:50%;
          background:rgba(168,40,60,0.1);
          border:0.5px solid rgba(168,40,60,0.2);
          margin-bottom:16px; position:relative;
        }
        .pm-hero-title {
          font-family:var(--font-display,'Cormorant Garamond',Georgia,serif);
          font-size:34px; font-style:italic; font-weight:300;
          color:rgba(237,233,226,0.9); line-height:1.2; margin-bottom:10px; position:relative;
        }
        .pm-hero-title span { color:rgba(207,85,104,0.9); }
        .pm-hero-sub {
          font-size:13px; color:rgba(255,255,255,0.3);
          letter-spacing:0.3px; position:relative; font-weight:300;
        }
        /* ── Active banner ── */
        .pm-active {
          margin:16px 16px 0;
          background:rgba(50,160,90,0.06);
          border:0.5px solid rgba(50,160,90,0.2);
          border-radius:14px; padding:14px 16px;
          display:flex; align-items:center; gap:12px;
        }
        .pm-active-dot {
          width:8px; height:8px; border-radius:50%; background:#32C864; flex-shrink:0;
        }
        /* ── Section ── */
        .pm-section { padding:28px 16px 0; }
        .pm-label {
          font-size:10px; font-weight:500; letter-spacing:1.2px;
          color:var(--muted); text-transform:uppercase; margin-bottom:14px;
        }
        /* ── Feature cards ── */
        .pm-features { display:flex; flex-direction:column; gap:1px; }
        .pm-feat {
          display:flex; align-items:center; gap:14px;
          padding:14px 16px;
          background:var(--surface,#fff);
          border-bottom:0.5px solid var(--border,rgba(0,0,0,0.06));
        }
        .pm-feat:first-child { border-radius:14px 14px 0 0; }
        .pm-feat:last-child  { border-radius:0 0 14px 14px; border-bottom:none; }
        .pm-feat-icon {
          width:36px; height:36px; border-radius:10px; flex-shrink:0;
          background:rgba(168,40,60,0.07);
          border:0.5px solid rgba(168,40,60,0.1);
          display:flex; align-items:center; justify-content:center;
          color:var(--rose,#A8283C);
        }
        .pm-feat-title { font-size:14px; font-weight:500; color:var(--text); margin-bottom:2px; }
        .pm-feat-desc  { font-size:12px; color:var(--text-muted); line-height:1.4; font-weight:300; }
        /* ── Plans ── */
        .pm-plans { display:flex; gap:10px; padding:0 16px; }
        .pm-plan {
          flex:1; border-radius:16px; padding:20px 12px; cursor:pointer;
          border:0.5px solid var(--border,rgba(0,0,0,0.07));
          background:var(--surface,#fff); text-align:center;
          transition:border-color 0.2s;
          position:relative;
        }
        .pm-plan.sel {
          border-color:var(--rose,#A8283C);
          background:rgba(168,40,60,0.03);
        }
        .pm-plan-badge {
          position:absolute; top:-10px; left:50%; transform:translateX(-50%);
          background:var(--rose,#A8283C);
          color:white; font-size:9px; font-weight:600; letter-spacing:0.5px;
          padding:3px 10px; border-radius:20px; white-space:nowrap; text-transform:uppercase;
        }
        .pm-plan-label { font-size:11px; color:var(--text-muted); margin-bottom:8px; font-weight:400; }
        .pm-plan-price {
          font-family:var(--font-display,'Cormorant Garamond',Georgia,serif);
          font-size:28px; font-weight:400; color:var(--text);
          line-height:1; margin-bottom:2px;
        }
        .pm-plan-price sup { font-size:13px; font-weight:400; vertical-align:top; margin-top:5px; }
        .pm-plan-per { font-size:11px; color:var(--rose,#A8283C); font-weight:400; margin-top:5px; }
        .pm-plan-save { font-size:10px; color:var(--text-muted); margin-top:2px; font-weight:300; }
        /* ── CTA ── */
        .pm-cta { padding:20px 16px 0; }
        .pm-btn {
          width:100%; padding:15px; border:none; border-radius:14px;
          font-size:15px; font-weight:500; letter-spacing:0.2px;
          background:var(--rose,#A8283C);
          color:white; cursor:pointer;
          transition:opacity 0.2s, transform 0.15s;
        }
        .pm-btn:active { transform:scale(0.98); opacity:0.9; }
        .pm-btn:disabled { opacity:0.5; }
        .pm-note {
          text-align:center; font-size:11px; color:var(--muted);
          margin-top:14px; line-height:1.7; font-weight:300;
        }
        .pm-error {
          margin:12px 0 0; background:rgba(200,30,30,0.06);
          border:0.5px solid rgba(200,30,30,0.2); border-radius:10px;
          padding:10px 14px; font-size:13px; color:#A03030; text-align:center;
        }
        .pm-divider {
          display:flex; align-items:center; gap:12px;
          padding:0 16px; margin-top:24px; margin-bottom:4px;
        }
        .pm-divider::before, .pm-divider::after {
          content:''; flex:1; height:0.5px; background:var(--border,rgba(0,0,0,0.07));
        }
        .pm-divider-text { font-size:10px; color:var(--muted); letter-spacing:1px; text-transform:uppercase; white-space:nowrap; }
      `}</style>

      {/* Hero */}
      <div className="pm-hero">
        <div className="pm-crown">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="rgba(207,85,104,0.8)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
          </svg>
        </div>
        <h1 className="pm-hero-title">
          Любовь<br/><span>без ограничений</span>
        </h1>
        <p className="pm-hero-sub">Одна подписка — для вас двоих</p>
      </div>

      {/* Active banner */}
      {isPremium && (
        <div className="pm-active">
          <div className="pm-active-dot" />
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#1C7A3C' }}>Premium активен</div>
            {expiresAt && (
              <div style={{ fontSize: 12, color: '#5A9A70', marginTop: 2 }}>
                Действует до {new Date(expiresAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Features */}
      <div className="pm-section">
        <div className="pm-label">Что входит</div>
        <div className="pm-features">
          {FEATURES.map(f => (
            <div key={f.title} className="pm-feat">
              <div className="pm-feat-icon">{f.svg}</div>
              <div>
                <div className="pm-feat-title">{f.title}</div>
                <div className="pm-feat-desc">{f.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Plans + CTA */}
      {!isPremium && (
        <>
          <div className="pm-divider"><span className="pm-divider-text">Выберите план</span></div>

          <div className="pm-plans">
            {PLANS.map(p => (
              <div key={p.id} className={`pm-plan${plan === p.id ? ' sel' : ''}`} onClick={() => setPlan(p.id)}>
                {p.badge && <div className="pm-plan-badge">{p.badge}</div>}
                <div className="pm-plan-label">{p.label}</div>
                <div className="pm-plan-price"><sup>₽</sup>{p.price}</div>
                <div className="pm-plan-per">{p.per}</div>
                {p.saving && <div className="pm-plan-save">{p.saving}</div>}
              </div>
            ))}
          </div>

          {error && <div className="pm-error" style={{ margin: '12px 16px 0' }}>{error}</div>}

          <div className="pm-cta">
            <button className="pm-btn" onClick={handleSubscribe} disabled={loadingPay}>
              {loadingPay ? 'Переходим к оплате…' : 'Оформить Premium'}
            </button>
          </div>

          <p className="pm-note">
            Безопасная оплата · Карты, SberPay, СБП, ЮMoney<br/>
            Отменить подписку можно в любой момент
          </p>
        </>
      )}
    </div>
  )
}
