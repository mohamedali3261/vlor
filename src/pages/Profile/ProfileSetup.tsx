import { useState, type FormEvent } from 'react';
import { useLang } from '@/i18n/LanguageContext';
import { createNamedProfile } from '@/lib/localProfile';

export function ProfileSetup({onDone,onSkip}:{onDone:()=>void;onSkip:()=>void}) {
  const {lang}=useLang();const ar=lang==='ar';
  const [name,setName]=useState('');const [busy,setBusy]=useState(false);const [error,setError]=useState('');
  const submit=async(e:FormEvent)=>{
    e.preventDefault();if(busy || !name.trim())return;setBusy(true);setError('');
    const ok=await createNamedProfile(name);
    setBusy(false);if(ok)onDone();else setError(ar?'تعذر إنشاء البروفيل. تأكد من الاتصال والسماح بحفظ بيانات المتصفح ثم حاول مجددًا.':'Could not create your profile. Check your connection and browser storage, then try again.');
  };
  return <form onSubmit={submit} className="space-y-4">
    <h2 className="font-display text-2xl">{ar?'اعمل بروفيل للمتصفح':'Create a browser profile'}</h2>
    <p className="text-sm leading-relaxed text-mist">{ar?'ارجع من نفس المتصفح وهتلاقي السلة والمفضلة وآخر 20 طلب تحفظه وبياناتك المحفوظة. لا توجد مزامنة بين الأجهزة، ومسح بيانات المتصفح يحذف البيانات المحلية فقط. لا تستخدم الحفظ على جهاز مشترك.':'Return on this browser to find your cart, wishlist, latest 20 saved orders and saved details. There is no device sync; clearing browser data removes local data only. Avoid saving on shared devices.'}</p>
    <p className="text-xs leading-relaxed text-mist">{ar?'يُستخدم اسم البروفيل ونشاطه الجديد في تحليلات المتجر.':'Your profile name and future activity are used for store analytics.'}</p>
    <label className="block text-sm font-bold">{ar?'اسم البروفيل':'Profile name'}<input autoFocus required maxLength={80} value={name} onChange={e=>setName(e.target.value)} className="field mt-1" /></label>
    {error && <p role="alert" className="text-xs text-rose-700">{error}</p>}
    <div className="flex flex-wrap gap-2"><button disabled={busy || !name.trim()} className="rounded-full bg-ink px-5 py-3 text-xs font-bold text-bone disabled:opacity-40">{busy?(ar?'جاري الحفظ…':'Saving…'):(ar?'إنشاء البروفيل':'Create profile')}</button><button type="button" disabled={busy} onClick={onSkip} className="rounded-full border border-ink/15 px-5 py-3 text-xs font-bold">{ar?'ليس الآن':'Not now'}</button></div>
  </form>;
}
