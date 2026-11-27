import { Facebook, Instagram, TikTok, Whatsapp } from "@/components/ui/icons";
import { useStore } from "@/context/StoreContext";
import { useLang } from "@/i18n/LanguageContext";
import { cleanPhone, socialUrl, whatsappUrl } from "@/lib/messaging";
import "@/styles/social-links.css";

/** Shared by the home hero and footer, so every link uses the studio settings. */
export function SocialLinks({ variant = "footer" }: { variant?: "hero" | "footer" }) {
  const { settings } = useStore();
  const { x } = useLang();
  const links = [
    { name: "Facebook", icon: Facebook, href: socialUrl(settings.facebook, "facebook"), className: "social-link--facebook" },
    { name: "WhatsApp", icon: Whatsapp, href: cleanPhone(settings.whatsapp) ? whatsappUrl(settings.whatsapp, x("Hello VLOR 🌿", "مرحباً ڨلور 🌿")) : undefined, className: "social-link--whatsapp" },
    { name: "Instagram", icon: Instagram, href: socialUrl(settings.instagram, "instagram"), className: "social-link--instagram" },
    { name: "TikTok", icon: TikTok, href: socialUrl(settings.tiktok, "tiktok"), className: "social-link--tiktok" },
  ];
  return (
    <div className={`social-links social-links--${variant}`} aria-label={x("Social media", "التواصل الاجتماعي")}>
      {links.map(({ name, icon: Icon, href, className }) => href ? (
        <a key={name} className={`social-link ${className}`} href={href} target="_blank" rel="noopener noreferrer" aria-label={name} title={name}>
          <Icon className="social-link__icon" />
        </a>
      ) : (
        <span key={name} className={`social-link social-link--disabled ${className}`} role="img" aria-label={`${name} ${x("link not set", "الرابط غير متاح")}`} title={`${name} · ${x("link not set", "الرابط غير متاح")}`}>
          <Icon className="social-link__icon" />
        </span>
      ))}
    </div>
  );
}
