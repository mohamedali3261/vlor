import {useEffect,useState} from 'react';
import {useRoute} from '@/lib/router';
import {useLang} from '@/i18n/LanguageContext';
import {confirmationNotice, orderConfirmed, orderStatusLabel} from '@/lib/orderStatus';
export function TrackOrder(){
 const {segments}=useRoute();const {lang}=useLang();const token=segments[1];
 const [state,setState]=useState<{id:string;status:string;created_at:string;confirmed:boolean | number}|null>(null);const [error,setError]=useState(false);
 useEffect(()=>{const controller=new AbortController();setState(null);setError(false);fetch('/api/track',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token}),signal:controller.signal}).then(async r=>{if(!r.ok)throw Error();const data=await r.json();if(!controller.signal.aborted)setState(data);}).catch(()=>{if(!controller.signal.aborted)setError(true)});return ()=>controller.abort();},[token]);
 return <div className="mx-auto max-w-xl px-6 py-20"><h1 className="font-display text-4xl">{lang==='ar'?'تتبع الطلب':'Track order'}</h1>{error?<p className="mt-4">{lang==='ar'?'الرابط غير صالح أو الطلب غير موجود.':'Invalid link or order not found.'}</p>:state?<div className="mt-4"><p>{lang==='ar'?'رقم الطلب':'Order'}: <bdi>{state.id}</bdi></p><p className="mt-2">{lang==='ar'?'الحالة':'Status'}: {orderStatusLabel(state.status,lang)}</p>{orderConfirmed(state.status,state.confirmed) && <p role="status" className="mt-4 rounded-xl bg-acid/25 p-4 font-bold">{confirmationNotice(lang)}</p>}<p className="mt-2 text-sm text-mist">{state.created_at} UTC</p></div>:<p className="mt-4">{lang==='ar'?'جاري التحميل…':'Loading…'}</p>}</div>;
}
