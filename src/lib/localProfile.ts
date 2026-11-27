/** Delivery details and tracking links stay local; named analytics require explicit setup. */
export type ProfileDetails = { name:string; phone:string; additionalPhone:string; city:string; address:string };
export type LocalOrder = { id:string; token:string };
export type LocalProfile = { details:ProfileDetails; orders:LocalOrder[]; displayName?:string; analyticsToken?:string };
const KEY = 'vlor.local-profile.v1';
const idPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const emptyDetails = ():ProfileDetails => ({name:'',phone:'',additionalPhone:'',city:'',address:''});

export function loadProfile(): LocalProfile | null {
  try {
    const raw=localStorage.getItem(KEY); if (!raw) return null;
    const data=JSON.parse(raw); if (!data || typeof data !== 'object' || !data.details || typeof data.details !== 'object') return null;
    const details=emptyDetails();
    for (const key of Object.keys(details) as (keyof ProfileDetails)[]) {
      const value=data.details[key]; if (typeof value !== 'string' || value.length > 500) return null;
      details[key]=value;
    }
    const orders:LocalOrder[]=Array.isArray(data.orders) ? data.orders.filter((o:LocalOrder)=>o && typeof o.id==='string' && idPattern.test(o.id) && typeof o.token==='string' && idPattern.test(o.token)).slice(0,20) : [];
    const profile:LocalProfile = {details,orders};
    if (typeof data.displayName === 'string' && data.displayName.trim().length > 0 && data.displayName.length <= 80 && typeof data.analyticsToken === 'string' && idPattern.test(data.analyticsToken)) {
      profile.displayName=data.displayName;profile.analyticsToken=data.analyticsToken;
    }
    return profile;
  } catch { return null; }
}
export function saveProfile(profile:LocalProfile): boolean {
  try { localStorage.setItem(KEY,JSON.stringify(profile)); return true; } catch { return false; }
}
export function clearProfile(): boolean {
  try { localStorage.removeItem(KEY); return true; } catch { return false; }
}

/** Setup explicitly shares the display name and subsequent activity for analytics. */
export async function createNamedProfile(name:string):Promise<boolean> {
  const clean=name.trim(); if(!clean || clean.length>80)return false;
  const prior=loadProfile(); const token=prior?.analyticsToken ?? crypto.randomUUID();
  try {
    const response=await fetch('/api/analytics/profile',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token,name:clean})});
    if(!response.ok)return false;
    if(saveProfile({...prior,details:prior?.details ?? emptyDetails(),orders:prior?.orders ?? [],displayName:clean,analyticsToken:token}))return true;
    if(!prior?.analyticsToken) await fetch('/api/analytics/profile/delete',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token})}).catch(()=>{});
    return false;
  } catch { return false; }
}
export async function deleteProfileAnalytics(token:string):Promise<boolean> {
  try { const response=await fetch('/api/analytics/profile/delete',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token})});return response.ok; } catch {return false;}
}
