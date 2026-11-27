import type { Lang } from '@/types';
export function orderStatusLabel(status:string, lang:Lang):string {
  const labels:Record<string,{ar:string;en:string}> = {
    new:{ar:'جديد — بانتظار التأكيد',en:'New — awaiting confirmation'},
    confirmed:{ar:'مؤكد',en:'Confirmed'}, shipped:{ar:'تم الشحن',en:'Shipped'},
    completed:{ar:'مكتمل',en:'Completed'}, cancelled:{ar:'ملغى',en:'Cancelled'},
  };
  return labels[status]?.[lang] ?? (lang === 'ar' ? 'غير معروف' : 'Unknown');
}
export function orderConfirmed(status:string, confirmed:boolean | number = false):boolean { return status === 'confirmed' || (Boolean(confirmed) && ['shipped','completed'].includes(status)); }
export function confirmationNotice(lang:Lang):string { return lang === 'ar' ? 'تم تأكيد طلبك، وسيتم التواصل معك قريبًا.' : 'Your order has been confirmed. We will contact you soon.'; }
