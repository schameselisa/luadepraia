/**
 * Store configuration — single source of truth for the Lua de Praia WhatsApp number.
 *
 * IMPORTANT: Replace the placeholder number below with the real Lua de Praia
 * WhatsApp number before publishing. Use international format (country code +
 * area code + number), digits only, no spaces or special characters.
 * Example for Brazil: 5584991234567
 */
export const STORE_WHATSAPP_NUMBER = '5548991310845';

export const STORE_CONFIG = {
  whatsappNumber: STORE_WHATSAPP_NUMBER,
  storeName: 'Lua de Praia',
} as const;

export function buildWhatsAppUrl(number: string, message: string): string {
  const cleanNumber = number.replace(/\D/g, '');
  return `https://wa.me/${cleanNumber}?text=${encodeURIComponent(message)}`;
}
