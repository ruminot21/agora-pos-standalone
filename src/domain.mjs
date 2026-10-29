export const STORE_ID = 'default-store';
export const currencyDigits = currency => currency === 'CLP' || currency === 'PYG' || currency === 'COP' ? 0 : 2;
export function toMinor(input, currency = 'CLP') {
  const n = Number(input);
  if (!Number.isFinite(n) || n < 0) throw new Error('Introduce un importe válido (mayor o igual a cero).');
  const value = Math.round(n * (10 ** currencyDigits(currency)));
  if (!Number.isSafeInteger(value)) throw new Error('Importe fuera de rango.');
  return value;
}
export function fromMinor(value, currency = 'CLP') { return (value / (10 ** currencyDigits(currency))).toFixed(currencyDigits(currency)); }
export function money(value = 0, currency = 'CLP') {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency, minimumFractionDigits: currencyDigits(currency), maximumFractionDigits: currencyDigits(currency) }).format(value / (10 ** currencyDigits(currency)));
}
export function calcCart(items, discountPercent = 0) {
  if (!Number.isFinite(Number(discountPercent)) || +discountPercent < 0 || +discountPercent > 100) throw new Error('El descuento debe estar entre 0 y 100%.');
  let subtotal = 0;
  for (const item of items) {
    if (!Number.isSafeInteger(item.quantity) || item.quantity <= 0 || !Number.isSafeInteger(item.price) || item.price < 0) throw new Error('Línea de venta inválida.');
    subtotal += item.price * item.quantity;
  }
  if (!Number.isSafeInteger(subtotal)) throw new Error('Venta demasiado grande.');
  const discount = Math.round(subtotal * (+discountPercent / 100));
  return { subtotal, discount, total: subtotal - discount };
}
export function paymentBreakdown(method, total, values = {}) {
  let cash = 0, card = 0, transfer = 0, change = 0;
  if (method === 'efectivo') cash = values.cash == null ? total : values.cash;
  else if (method === 'tarjeta') card = total;
  else if (method === 'transferencia') transfer = total;
  else if (method === 'mixto') { cash = values.cash || 0; card = values.card || 0; transfer = values.transfer || 0; }
  else throw new Error('Método de pago inválido.');
  if ([cash,card,transfer].some(v => !Number.isSafeInteger(v) || v < 0)) throw new Error('Los importes de pago deben ser válidos.');
  const received = cash + card + transfer;
  if (received < total) throw new Error('El pago recibido no cubre el total.');
  if (method === 'mixto' && received !== total) throw new Error('En pago mixto los importes deben sumar exactamente el total.');
  if (method === 'efectivo') { change = received - total; cash -= change; }
  return { cash, card, transfer, change, received };
}
export function dateKey(iso) { return new Date(iso).toLocaleDateString('en-CA'); }
export function localDayKey(date = new Date()) {
  const y = date.getFullYear(); const m = String(date.getMonth() + 1).padStart(2,'0'); const d = String(date.getDate()).padStart(2,'0'); return `${y}-${m}-${d}`;
}
export function safeNumber(v, fallback = 0) { const n = Number(v); return Number.isFinite(n) ? n : fallback; }
