import { useEffect, useState, type FormEvent } from 'react';
import { useLang } from '@/i18n/LanguageContext';

type Rule = { id: string; kind: 'quantity' | 'amount'; threshold: number; discountAmount: number | null; legacyPercent: number | null; enabled: number };

export function DiscountRules() {
  const { lang } = useLang(); const ar = lang === 'ar';
  const [rules, setRules] = useState<Rule[]>([]);
  const [kind, setKind] = useState<Rule['kind']>('quantity');
  const [threshold, setThreshold] = useState(''); const [discountAmount, setDiscountAmount] = useState('');
  const [enabled, setEnabled] = useState(true); const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState('');
  const refresh = async () => { const r = await fetch('/api/admin/discount-rules'); if (!r.ok) throw Error(); setRules(await r.json()); };
  useEffect(() => { void refresh().catch(() => setMessage(ar ? 'تعذر تحميل الخصومات.' : 'Could not load discounts.')); }, [ar]);
  const reset = () => { setEditing(null); setKind('quantity'); setThreshold(''); setDiscountAmount(''); setEnabled(true); };
  const save = async (e: FormEvent) => {
    e.preventDefault(); if (busy) return; setBusy(true); setMessage('');
    try {
      const response = await fetch('/api/admin/discount-rules', {method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify({id:editing || crypto.randomUUID(), kind, threshold:Number(threshold), discountAmount:Number(discountAmount), enabled})});
      if (!response.ok) throw Error(); await refresh(); window.dispatchEvent(new Event('vlor:discounts-changed')); reset(); setMessage(ar ? 'تم حفظ العرض.' : 'Offer saved.');
    } catch { setMessage(ar ? 'تعذر حفظ العرض، راجع البيانات وحاول مجددًا.' : 'Could not save the offer. Check the fields and retry.'); }
    finally { setBusy(false); }
  };
  const remove = async (id: string) => {
    if (busy || !window.confirm(ar ? 'حذف العرض؟ الطلبات السابقة لن تتأثر.' : 'Delete this offer? Previous orders will not change.')) return;
    setBusy(true); setMessage('');
    try { const response = await fetch(`/api/admin/discount-rules/${encodeURIComponent(id)}`, {method:'DELETE'}); if (!response.ok) throw Error(); await refresh(); window.dispatchEvent(new Event('vlor:discounts-changed')); if (editing === id) reset(); setMessage(ar ? 'تم حذف العرض.' : 'Offer deleted.'); }
    catch { setMessage(ar ? 'تعذر حذف العرض.' : 'Could not delete the offer.'); }
    finally { setBusy(false); }
  };
  return <section className="rounded-2xl border border-ink/10 bg-surface p-4">
    <h3 className="text-sm font-bold">{ar ? 'عروض الخصم التلقائية' : 'Automatic discount offers'}</h3>
    <p className="mt-1 text-xs leading-relaxed text-mist">{ar ? 'حدد حدًا أدنى لعدد الزجاجات أو قيمة المنتجات قبل الشحن. يطبق أكبر خصم مؤهل بالجنيه فقط، بدون كود، وبحد أقصى قيمة المنتجات. يظهر العرض المفعّل في الشريط العلوي. العروض السابقة بالنسبة موقوفة حتى تحدد قيمتها بالجنيه.' : 'Set a minimum bottle count or product subtotal before shipping. Only the highest eligible fixed discount applies, capped at the product subtotal. Enabled offers appear in the announcement bar. Previous percentage offers are paused until you set an amount.'}</p>
    {message && <p role="status" className="mt-2 text-sm">{message}</p>}
    <form onSubmit={save} className="mt-4 grid gap-3">
      <label className="block text-xs font-bold">{ar ? 'شرط العرض' : 'Offer condition'}<select className="field mt-1" value={kind} onChange={e=>setKind(e.target.value as Rule['kind'])}><option value="quantity">{ar ? 'عدد الزجاجات' : 'Number of bottles'}</option><option value="amount">{ar ? 'قيمة المنتجات (ج.م)' : 'Product subtotal (EGP)'}</option></select></label>
      <div className="grid grid-cols-2 gap-2"><label className="block text-xs font-bold">{ar ? 'الحد الأدنى' : 'Minimum'}<input className="field mt-1" type="number" min="1" max="10000000" step="1" required value={threshold} onChange={e=>setThreshold(e.target.value)} /></label><label className="block text-xs font-bold">{ar ? 'الخصم (ج.م)' : 'Discount (EGP)'}<input className="field mt-1" type="number" min="1" max="10000000" step="1" required value={discountAmount} onChange={e=>setDiscountAmount(e.target.value)} /></label></div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={enabled} onChange={e=>setEnabled(e.target.checked)} />{ar ? 'العرض مفعّل' : 'Offer enabled'}</label>
      <div className="flex gap-2"><button disabled={busy} className="rounded-full bg-acid px-5 py-2.5 text-sm font-bold text-ink disabled:opacity-50">{editing ? (ar ? 'حفظ التعديل' : 'Save changes') : (ar ? 'إضافة العرض' : 'Add offer')}</button>{editing && <button type="button" onClick={reset} className="rounded-full border px-4 py-2 text-sm">{ar ? 'إلغاء' : 'Cancel'}</button>}</div>
    </form>
    <ul className="mt-4 space-y-2">{rules.map(rule => <li key={rule.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-ink/10 bg-bone-2/40 p-3 text-sm"><span><b>{rule.discountAmount === null ? (ar ? `عرض سابق ${rule.legacyPercent}% — حدد قيمة بالجنيه لتفعيله` : `Previous ${rule.legacyPercent}% offer — set an amount to enable`) : (ar ? `${rule.discountAmount} ج.م` : `EGP ${rule.discountAmount}`)}</b> · {rule.kind === 'quantity' ? (ar ? `من ${rule.threshold} زجاجات` : `${rule.threshold}+ bottles`) : (ar ? `من ${rule.threshold} ج.م` : `EGP ${rule.threshold}+`)} · {rule.enabled ? (ar ? 'مفعّل' : 'Enabled') : (ar ? 'موقوف' : 'Disabled')}</span><span className="flex gap-2"><button type="button" disabled={busy} className="underline" onClick={()=>{setEditing(rule.id);setKind(rule.kind);setThreshold(String(rule.threshold));setDiscountAmount(rule.discountAmount === null ? '' : String(rule.discountAmount));setEnabled(Boolean(rule.enabled));}}>{ar ? 'تعديل' : 'Edit'}</button><button type="button" disabled={busy} className="text-rose-700 underline" onClick={()=>void remove(rule.id)}>{ar ? 'حذف' : 'Delete'}</button></span></li>)}</ul>
  </section>;
}
