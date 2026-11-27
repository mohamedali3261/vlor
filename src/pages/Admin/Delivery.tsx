import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useLang } from '@/i18n/LanguageContext';

type Rate = { city: string; amount: number; free_threshold: number | null };

export function Delivery() {
  const { lang } = useLang();
  const ar = lang === 'ar';
  const [rates, setRates] = useState<Rate[]>([]);
  const [city, setCity] = useState('');
  const [fee, setFee] = useState('');
  const [threshold, setThreshold] = useState('');
  const [message, setMessage] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);
  const [editingRate, setEditingRate] = useState<string | null>(null);
  const [editFee, setEditFee] = useState('');
  const [editThreshold, setEditThreshold] = useState('');

  const refresh = useCallback(async () => {
    const a = await fetch('/api/admin/shipping');
    if (!a.ok) throw Error();
    setRates(await a.json());
  }, []);

  useEffect(() => {
    void refresh().catch(() => setMessage(ar ? 'تعذر تحميل الإعدادات' : 'Could not load settings'));
  }, [refresh, ar]);

  const save = async (e: FormEvent, kind: 'shipping') => {
    e.preventDefault();
    const body = { city: city.trim(), amount: Number(fee), freeThreshold: threshold === '' ? null : Number(threshold) };
    try {
      const r = await fetch(`/api/admin/${kind}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!r.ok) throw Error();
      await refresh();
      setMessage(ar ? 'تم الحفظ ✓' : 'Saved ✓');
      setCity(''); setFee(''); setThreshold('');
      setTimeout(() => setMessage(''), 2500);
    } catch {
      setMessage(ar ? 'تعذر الحفظ، تحقق من البيانات' : 'Could not save; check the fields');
    }
  };

  const startEditRate = (r: Rate) => {
    setEditingRate(r.city);
    setEditFee(String(r.amount));
    setEditThreshold(r.free_threshold === null ? '' : String(r.free_threshold));
  };
  const saveEditRate = async (cityName: string) => {
    try {
      const r = await fetch('/api/admin/shipping', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ city: cityName, amount: Number(editFee), freeThreshold: editThreshold === '' ? null : Number(editThreshold) }) });
      if (!r.ok) throw Error();
      await refresh();
      setEditingRate(null);
      setMessage(ar ? 'تم تعديل الشحن ✓' : 'Shipping updated ✓');
      setTimeout(() => setMessage(''), 2000);
    } catch { setMessage(ar ? 'تعذر التعديل' : 'Could not update'); }
  };

  const remove = async (kind: 'shipping', value: string) => {
    if (deleting) return;
    const warning = ar ? `حذف شحن ${value}؟ لن يمكن إتمام طلبات هذه المحافظة حتى تضيف سعرًا جديدًا. الطلبات السابقة لن تتأثر.` : `Delete shipping for ${value}? New orders for this governorate will be unavailable until a rate is added. Existing orders are unchanged.`;
    if (!window.confirm(warning)) return;
    const key = `${kind}:${value}`;
    setDeleting(key);
    try {
      const response = await fetch(`/api/admin/${kind}/${encodeURIComponent(value)}`, {method:'DELETE'});
      if (!response.ok) throw Error();
      setRates(previous => previous.filter(rate => rate.city !== value));
      setMessage(ar ? 'تم الحذف بنجاح.' : 'Deleted successfully.');
    } catch { setMessage(ar ? 'تعذر الحذف. تحقق من الاتصال وحاول مجددًا.' : 'Could not delete. Check your connection and try again.'); }
    finally { setDeleting(null); }
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display text-2xl">{ar ? 'الشحن' : 'Delivery'}</h2>
        <p className="mt-1 text-xs leading-relaxed text-mist">{ar ? 'أضف أو عدّل أو احذف أسعار الشحن التلقائية من القائمة.' : 'Add, edit or delete shipping rates.'}</p>
      </div>

      {message && <p role="status" className="rounded-xl bg-ink px-4 py-2 text-sm font-medium text-bone">{message}</p>}

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Shipping */}
        <section className="rounded-2xl border border-ink/10 bg-surface p-4">
          <h3 className="text-sm font-bold">{ar ? 'الشحن' : 'Shipping'}</h3>
          <p className="mt-1 text-[11px] leading-relaxed text-mist">{ar ? 'اكتب اسم المحافظة بالإنجليزية (مثال: Cairo). المحافظات غير المسجلة لن تقبل الطلبات.' : 'Use English governorate name (e.g. Cairo). Unconfigured governorates reject orders.'}</p>
          <form onSubmit={(e) => void save(e, 'shipping')} className="mt-4 grid gap-2.5">
            <label className="block">
              <span className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-mist">{ar ? 'المحافظة' : 'Governorate'}</span>
              <input className="field h-10 text-sm" placeholder="Cairo" required value={city} onChange={(e) => setCity(e.target.value)} />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-mist">{ar ? 'رسوم الشحن (جنيه)' : 'Fee (EGP)'}</span>
                <input className="field h-10 text-sm" type="number" min={0} required placeholder="60" value={fee} onChange={(e) => setFee(e.target.value)} />
              </label>
              <label className="block">
                <span className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-mist">{ar ? 'حد المجاني (اختياري)' : 'Free threshold'}</span>
                <input className="field h-10 text-sm" type="number" min={0} placeholder="1000" value={threshold} onChange={(e) => setThreshold(e.target.value)} />
              </label>
            </div>
            <button className="mt-1 rounded-full bg-ink px-5 py-2.5 text-sm font-bold text-bone hover:bg-plum">{ar ? 'حفظ الشحن' : 'Save shipping'}</button>
          </form>

          <ul className="mt-4 space-y-2">
            {rates.length === 0 ? <li className="rounded-xl border border-dashed border-ink/10 p-3 text-center text-xs text-mist">{ar ? 'لا توجد محافظات مسجلة' : 'No rates yet'}</li> : rates.map((r) => (
              <li key={r.city} className="rounded-xl border border-ink/8 bg-bone-2/40 px-3 py-2.5">
                {editingRate === r.city ? (
                  <div className="space-y-2">
                    <p className="text-sm font-bold">{r.city}</p>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="block">
                        <span className="mb-1 block text-[10px] font-bold text-mist">{ar ? 'السعر الجديد' : 'New fee'}</span>
                        <input className="field h-9 text-sm" type="number" min={0} value={editFee} onChange={e=>setEditFee(e.target.value)} />
                      </label>
                      <label className="block">
                        <span className="mb-1 block text-[10px] font-bold text-mist">{ar ? 'حد مجاني' : 'Free threshold'}</span>
                        <input className="field h-9 text-sm" type="number" min={0} value={editThreshold} onChange={e=>setEditThreshold(e.target.value)} placeholder="—" />
                      </label>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={()=>void saveEditRate(r.city)} className="flex-1 rounded-full bg-ink px-3 py-2 text-xs font-bold text-bone hover:bg-plum">{ar ? 'حفظ التعديل' : 'Save'}</button>
                      <button onClick={()=>setEditingRate(null)} className="rounded-full border border-ink/10 px-4 py-2 text-xs font-bold hover:border-ink/30">{ar ? 'إلغاء' : 'Cancel'}</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-bold">{r.city}</span>
                    <span className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="rounded-full bg-ink px-2 py-1 font-bold text-bone">{r.amount} {ar ? 'ج.م' : 'EGP'}</span>
                      <span className="text-mist">{r.free_threshold === null ? '—' : `${ar ? 'مجاني فوق' : 'free ≥'} ${r.free_threshold}`}</span>
                      <button onClick={()=>startEditRate(r)} className="ms-1 rounded-full border border-ink/10 bg-surface px-3 py-1 text-[11px] font-bold hover:border-ink/30">{ar ? 'تعديل السعر' : 'Edit price'}</button>
                      <button type="button" disabled={!!deleting} onClick={()=>void remove('shipping',r.city)} aria-label={ar ? `حذف شحن ${r.city}` : `Delete shipping for ${r.city}`} className="rounded-full border border-rose-200 px-3 py-1 text-[11px] font-bold text-rose-700 hover:bg-rose-50 disabled:opacity-50">{ar ? 'حذف' : 'Delete'}</button>
                    </span>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>


      </div>
    </div>
  );
}
