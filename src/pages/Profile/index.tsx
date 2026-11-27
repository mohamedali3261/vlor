import { useEffect, useState, type FormEvent } from 'react';
import { useLang } from '@/i18n/LanguageContext';
import { governorates } from '@/lib/governorates';
import { clearProfile, deleteProfileAnalytics, emptyDetails, loadProfile, saveProfile, type LocalOrder, type ProfileDetails } from '@/lib/localProfile';
import { ProfileSetup } from '@/pages/Profile/ProfileSetup';
import { confirmationNotice, orderConfirmed, orderStatusLabel } from '@/lib/orderStatus';

type Status = { status:string; confirmed:boolean | number } | null;
export function ProfilePage() {
  const {lang,l} = useLang(); const ar = lang === 'ar';
  const [details,setDetails]=useState<ProfileDetails>(()=>loadProfile()?.details ?? emptyDetails());
  const [orders,setOrders]=useState<LocalOrder[]>(()=>loadProfile()?.orders ?? []);
  const [saved,setSaved]=useState(()=>!!loadProfile());
  const [displayName,setDisplayName]=useState(()=>loadProfile()?.displayName ?? '');
  const [setup,setSetup]=useState(false);const [deleting,setDeleting]=useState(false);
  const [message,setMessage]=useState('');
  const [statuses,setStatuses]=useState<Record<string,Status>>({});
  const [loading,setLoading]=useState(false); const [reload,setReload]=useState(0);
  useEffect(()=>{
    if (!orders.length) return;
    const controller=new AbortController(); setLoading(true);
    Promise.all(orders.map(async o=>{
      try { const r=await fetch('/api/track',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:o.token}),signal:controller.signal}); if(!r.ok) throw Error(); const data=await r.json(); return [o.id,{status:data.status,confirmed:data.confirmed}] as const; }
      catch { return [o.id,null] as const; }
    })).then(results=>{if(!controller.signal.aborted){setStatuses(Object.fromEntries(results));setLoading(false);}});
    return ()=>controller.abort();
  },[orders,reload]);
  const set=(key:keyof ProfileDetails,value:string)=>setDetails(prev=>({...prev,[key]:value}));
  const save=(e:FormEvent)=>{
    e.preventDefault(); const ok=saveProfile({...loadProfile(),details,orders});setSaved(ok);
    setMessage(ok ? (ar?'تم حفظ البروفيل على هذا المتصفح.':'Profile saved on this browser.') : (ar?'تعذر الحفظ على هذا المتصفح.':'This browser could not save the profile.'));
  };
  const clear=async()=>{
    if(!window.confirm(ar?'حذف بيانات البروفيل وروابط الطلبات من هذا المتصفح ونشاط البروفيل من التحليلات؟ لن تُحذف الطلبات من المتجر، وتبقى السلة والمفضلة في المتصفح.':'Remove profile details and tracking links from this browser and profile analytics? Store orders remain; cart and wishlist stay on this browser.')) return;
    const token=loadProfile()?.analyticsToken;
    if(token) {setDeleting(true);const deleted=await deleteProfileAnalytics(token);setDeleting(false);if(!deleted){setMessage(ar?'تعذر حذف نشاط البروفيل. تحقق من الاتصال وحاول مجددًا.':'Could not delete profile activity. Check your connection and retry.');return;}}
    if (!clearProfile()) { setMessage(ar?'تعذر حذف البيانات من المتصفح.':'Could not clear browser data.'); return; }
    setDetails(emptyDetails());setOrders([]);setStatuses({});setSaved(false);setDisplayName('');setMessage(ar?'تم حذف البروفيل من هذا المتصفح.':'Profile removed from this browser.');
  };
  return <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 sm:py-16">
    <p className="text-xs font-bold uppercase tracking-widest text-mist">VLOR · {ar?'بروفيل المتصفح':'Browser profile'}</p>
    <h1 className="font-display mt-2 text-4xl sm:text-5xl">{ar?'بروفايلي':'My profile'}</h1>
    <p className="mt-3 max-w-2xl text-sm leading-relaxed text-mist">{ar?'بيانات التوصيل وروابط الطلبات على هذا المتصفح فقط، بدون مزامنة. عند إنشاء بروفيل باسم يُستخدم اسمه ونشاطه الجديد للتحليلات. مسح بيانات المتصفح يحذف البيانات المحلية؛ لا تستخدم الحفظ على جهاز مشترك.':'Delivery details and tracking links stay on this browser without sync. A named profile shares its name and future activity for analytics. Clearing browser data removes local data; avoid saving on shared devices.'}</p>
    {displayName ? <p className="mt-4 text-sm font-bold">{ar?'اسم البروفيل':'Profile name'}: {displayName}</p> : <div className="mt-5">{setup ? <div className="max-w-lg rounded-2xl border border-ink/10 bg-surface p-5"><ProfileSetup onDone={()=>{setDisplayName(loadProfile()?.displayName ?? '');setSaved(true);setSetup(false)}} onSkip={()=>setSetup(false)}/></div> : <button type="button" onClick={()=>setSetup(true)} className="rounded-full border border-ink/20 px-4 py-2 text-xs font-bold">{ar?'إنشاء بروفيل باسم':'Create a named profile'}</button>}</div>}
    {message && <p role="status" className="mt-4 rounded-xl bg-acid/25 p-3 text-sm">{message}</p>}
    <div className="mt-7 grid items-start gap-5 md:grid-cols-2">
      <form onSubmit={save} className="space-y-4 rounded-2xl border border-ink/10 bg-surface p-5 sm:p-6">
        <h2 className="font-display text-2xl">{ar?'بيانات التوصيل':'Delivery details'}</h2>
        <label className="block text-sm font-bold">{ar?'الاسم':'Name'}<input className="field mt-1" maxLength={120} value={details.name} onChange={e=>set('name',e.target.value)} autoComplete="name" /></label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm font-bold">{ar?'رقم الموبيل':'Mobile number'}<input className="field mt-1" type="tel" dir="ltr" maxLength={30} value={details.phone} onChange={e=>set('phone',e.target.value)} autoComplete="tel" /></label>
          <label className="block text-sm font-bold">{ar?'رقم إضافي':'Additional phone'}<input className="field mt-1" type="tel" dir="ltr" maxLength={30} value={details.additionalPhone} onChange={e=>set('additionalPhone',e.target.value)} /></label>
        </div>
        <label className="block text-sm font-bold">{ar?'المحافظة':'Governorate'}<select className="field mt-1" value={details.city} onChange={e=>set('city',e.target.value)}><option value="">{ar?'اختر المحافظة':'Choose a governorate'}</option>{governorates.map(g=><option key={g.en} value={g.en}>{l(g)}</option>)}</select></label>
        <label className="block text-sm font-bold">{ar?'العنوان':'Address'}<textarea className="field mt-1" maxLength={500} rows={3} value={details.address} onChange={e=>set('address',e.target.value)} autoComplete="street-address" /></label>
        <div className="flex flex-wrap gap-2"><button className="rounded-full bg-ink px-5 py-2.5 text-sm font-bold text-bone">{ar?'حفظ البروفيل':'Save profile'}</button>{saved && <button type="button" disabled={deleting} onClick={clear} className="rounded-full border border-rose-200 px-5 py-2.5 text-sm font-bold text-rose-700">{ar?'حذف البروفيل':'Delete profile'}</button>}</div>
      </form>
      <section className="rounded-2xl border border-ink/10 bg-surface p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3"><h2 className="font-display text-2xl">{ar?'طلباتي المحفوظة':'Saved orders'}</h2>{orders.length>0 && <button type="button" disabled={loading} onClick={()=>setReload(v=>v+1)} className="rounded-full border border-ink/15 px-3 py-2 text-xs font-bold disabled:opacity-50">{ar?'تحديث':'Refresh'}</button>}</div>
        <p className="mt-2 text-xs text-mist">{ar?'تظهر هنا آخر 20 طلبًا اخترت حفظها على هذا المتصفح عند إتمامها.':'Your latest 20 orders saved on this browser at checkout appear here.'}</p>
        {orders.length===0 ? <p className="mt-5 text-sm text-mist">{ar?'لا توجد طلبات محفوظة.':'No saved orders.'}</p> : <ul className="mt-4 space-y-3">{orders.map(order=><li key={order.id} className="rounded-xl border border-ink/10 bg-bone p-4"><p className="text-xs text-mist">{ar?'رقم الطلب':'Order'}: <bdi>{order.id}</bdi></p>{statuses[order.id] ? <><p className="mt-2 text-sm font-bold">{orderStatusLabel(statuses[order.id]!.status,lang)}</p>{orderConfirmed(statuses[order.id]!.status,statuses[order.id]!.confirmed) && <p role="status" className="mt-2 rounded-lg bg-acid/25 p-2 text-sm">{confirmationNotice(lang)}</p>}</> : <p className="mt-2 text-sm text-mist">{loading ? (ar?'جاري تحديث الحالة…':'Loading status…') : (ar?'تعذر تحميل الحالة.':'Could not load status.')}</p>}<a className="mt-3 inline-block text-sm font-bold underline" href={`#/track/${order.token}`}>{ar?'تفاصيل تتبع الطلب':'Track order'}</a></li>)}</ul>}
      </section>
    </div>
  </div>;
}
