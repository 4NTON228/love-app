# Серверные пуш-напоминания (дни рождения / годовщина / события)

Эта инструкция включает фоновые push-уведомления, которые приходят **даже при закрытом приложении**:
- 🎂 день рождения партнёра (сегодня/завтра)
- 💍 годовщина пары (сегодня/завтра, с подсчётом лет)
- 📅 события из календаря (сегодня/завтра)

Всё делается в браузере на **supabase.com → проект `couple-app`**. Терминал не нужен.

Уже готово в проекте (трогать не надо): расширения `pg_cron`/`pg_net`, функция `send-notification`, таблица `push_subscriptions`.

---

## Шаг 1. Создать Edge Function `daily-reminders`

1. Слева **Edge Functions** → **Deploy a new function** → **Via editor** (редактор в браузере).
2. Имя: `daily-reminders`
3. **Verify JWT** → выключить (off).
4. Вставить весь код ниже, затем **Deploy**:

```ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

function mmdd(d){return `${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
function ymd(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
function md(s){const x=new Date(s);return `${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`}
function yw(n){const a=n%10,b=n%100;if(a===1&&b!==11)return 'год';if(a>=2&&a<=4&&(b<10||b>=20))return 'года';return 'лет'}

Deno.serve(async()=>{
  const now=new Date(),tomorrow=new Date(now.getTime()+86400000)
  const todayMD=mmdd(now),tomMD=mmdd(tomorrow),todayYMD=ymd(now),tomYMD=ymd(tomorrow)
  let sent=0
  try{
    const {data:profiles}=await supabase.from('profiles').select('id,name,birthday,partner_id,couple_start_date')
    const pmap=new Map();(profiles||[]).forEach(p=>pmap.set(p.id,p))
    const when=s=>md(s)===tomMD?'Завтра':md(s)===todayMD?'Сегодня':null
    for(const p of profiles||[]){if(!p.birthday||!p.partner_id)continue;const w=when(p.birthday);if(!w)continue;if(await push(p.partner_id,`🎂 ${w} день рождения`,`У ${p.name||'твоей половинки'} ${w.toLowerCase()} день рождения — не забудь поздравить!`))sent++}
    const {data:couples}=await supabase.from('couples').select('user_a,user_b,couple_start_date,status')
    const seen=new Set()
    for(const c of couples||[]){if(c.status&&c.status!=='active')continue;const start=c.couple_start_date||pmap.get(c.user_a)?.couple_start_date||pmap.get(c.user_b)?.couple_start_date;if(!start)continue;const k=`${c.user_a}-${c.user_b}`;if(seen.has(k))continue;seen.add(k);const w=when(start);if(!w)continue;const years=(w==='Завтра'?tomorrow:now).getFullYear()-new Date(start).getFullYear();const txt=years>0?`${w}: ${years} ${yw(years)} вместе 💕`:`${w} — ваша годовщина 💕`;for(const r of [c.user_a,c.user_b]){if(r&&await push(r,'💍 Годовщина',txt))sent++}}
    const {data:events}=await supabase.from('calendar_events').select('user_id,title,emoji,event_date').in('event_date',[todayYMD,tomYMD])
    for(const ev of events||[]){const w=ev.event_date===tomYMD?'Завтра':'Сегодня';const rec=new Set([ev.user_id]);const pn=pmap.get(ev.user_id)?.partner_id;if(pn)rec.add(pn);for(const r of rec){if(await push(r,`📅 ${w}: ${ev.title}`,`${ev.emoji||'📅'} Напоминание о событии`))sent++}}
    return new Response(JSON.stringify({ok:true,sent}),{headers:{'Content-Type':'application/json'}})
  }catch(err){console.error('[daily-reminders]',err);return new Response(JSON.stringify({error:String(err)}),{status:500,headers:{'Content-Type':'application/json'}})}
})

async function push(recipientId,title,body){
  const {data:sub}=await supabase.from('push_subscriptions').select('subscription').eq('user_id',recipientId).maybeSingle()
  if(!sub?.subscription)return false
  const url=`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-notification`
  const key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  await fetch(url,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${key}`},body:JSON.stringify({recipientId,title,body})}).catch(()=>{})
  return true
}
```

Дождаться статуса **Active**.

---

## Шаг 2. Расписание (раз в день, 09:00 UTC)

Слева **SQL Editor** → New query → вставить и **Run**:

```sql
select cron.schedule(
  'daily-reminders',
  '0 9 * * *',
  $CRON$
  select net.http_post(
    url := 'https://bqyisdgwtgxxomukozko.supabase.co/functions/v1/daily-reminders',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'apikey','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJxeWlzZGd3dGd4eG9tdWtvemtvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5NDcyNjUsImV4cCI6MjA4NjUyMzI2NX0.n7MpTU0-pM_093znX3mvZ4dc82bX5EwB7vnDi7GZ54c',
      'Authorization','Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJxeWlzZGd3dGd4eG9tdWtvemtvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5NDcyNjUsImV4cCI6MjA4NjUyMzI2NX0.n7MpTU0-pM_093znX3mvZ4dc82bX5EwB7vnDi7GZ54c'
    )
  );
  $CRON$
);
```

---

## Шаг 3. Проверка (сразу, не дожидаясь 09:00)

В **SQL Editor** выполнить вызов:

```sql
select net.http_post(
  url := 'https://bqyisdgwtgxxomukozko.supabase.co/functions/v1/daily-reminders',
  headers := '{"apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJxeWlzZGd3dGd4eG9tdWtvemtvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5NDcyNjUsImV4cCI6MjA4NjUyMzI2NX0.n7MpTU0-pM_093znX3mvZ4dc82bX5EwB7vnDi7GZ54c"}'::jsonb
);
```

Через пару секунд проверить ответ:

```sql
select id, status_code, content::text
from net._http_response
order by id desc limit 3;
```

Ожидается верхняя строка: `status_code = 200`, content `{"ok":true,"sent":N}`.

| status_code | что значит | что делать |
|---|---|---|
| **200** | всё работает ✅ | готово |
| **404** | функция не задеплоена | вернуться к Шагу 1 |
| **401** | плохой ключ | проверить, что `apikey` скопирован целиком, без лишних символов |

Пуш придёт только тем, у кого в приложении **включены уведомления** (Профиль → разрешить уведомления), и когда дата реально на сегодня/завтра.

---

## Удалить расписание (если нужно)
```sql
select cron.unschedule('daily-reminders');
```
