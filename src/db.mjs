import { STORE_ID, calcCart, paymentBreakdown } from './domain.mjs';
export const DB_NAME = 'pos-universal-v1';
export const TABLES = ['settings','products','sales','saleLines','stockMovements','cashSessions','cashMovements','outbox'];
const SCHEMA = {
  settings: { keyPath: 'id' }, products: { keyPath: 'id', indexes: ['storeId','barcode','sku','category'] },
  sales: { keyPath: 'id', indexes: ['storeId','sessionId','createdAt'] },
  saleLines: { keyPath: 'id', indexes: ['saleId','productId'] },
  stockMovements: { keyPath: 'id', indexes: ['productId','createdAt'] },
  cashSessions: { keyPath: 'id', indexes: ['storeId','status'] },
  cashMovements: { keyPath: 'id', indexes: ['sessionId'] },
  outbox: { keyPath: 'id', indexes: ['createdAt','entity'] }
};
const uid = () => crypto.randomUUID();
export function request(req) { return new Promise((resolve,reject) => { req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); }); }
let cached;
export function openDB() {
  if (cached) return cached;
  cached = new Promise((resolve,reject) => {
    const r = indexedDB.open(DB_NAME, 1);
    r.onupgradeneeded = () => { const db = r.result; for (const [table, def] of Object.entries(SCHEMA)) { const store = db.createObjectStore(table, {keyPath: def.keyPath}); for (const index of def.indexes || []) store.createIndex(index, index, {unique:false}); } };
    r.onsuccess = () => { const db = r.result; db.onversionchange = () => { db.close(); cached = undefined; }; resolve(db); };
    r.onerror = () => { cached = undefined; reject(r.error); };
  }); return cached;
}
export async function transaction(tables, mode, fn) {
  const db = await openDB(); const tx = db.transaction(tables, mode);
  const completion = new Promise((resolve,reject) => { tx.oncomplete = resolve; tx.onabort = () => reject(tx.error || new Error('Operación anulada.')); tx.onerror = () => {}; });
  try { const result = await fn(tx); await completion; return result; }
  catch(err) { if (tx.readyState === 'active') try { tx.abort(); } catch {} await completion.catch(()=>{}); throw err; }
}
export async function initDB() {
  await transaction(['settings'], 'readwrite', async tx => {
    const store = tx.objectStore('settings'); if (!await request(store.get('store'))) store.put({ id:'store', name:'Mi negocio', currency:'CLP', address:'', phone:'', receiptFooter:'¡Gracias por su compra!', createdAt:new Date().toISOString() });
    if (!await request(store.get('counter'))) store.put({ id:'counter', nextSale:1 });
  });
}
export async function list(table) { return transaction([table], 'readonly', tx => request(tx.objectStore(table).getAll())); }
export async function getSettings() { return transaction(['settings'], 'readonly', tx => request(tx.objectStore('settings').get('store'))); }
export async function saveSettings(info) {
  const validCurrencies = ['CLP','USD','EUR','COP','MXN','PEN','ARS','BOB','PYG'];
  if (!validCurrencies.includes(info.currency)) throw new Error('Moneda no admitida.');
  await transaction(['settings','products','sales'], 'readwrite', async tx => {
    const old = await request(tx.objectStore('settings').get('store'));
    const products = await request(tx.objectStore('products').count());
    const sales = await request(tx.objectStore('sales').count());
    if (old.currency !== info.currency && (products || sales)) throw new Error('Para cambiar la moneda, utiliza una instalación sin productos ni ventas; no se convierten importes automáticamente.');
    tx.objectStore('settings').put({ ...old, name:info.name.trim().slice(0,90) || 'Mi negocio', address:info.address.trim().slice(0,160), phone:info.phone.trim().slice(0,60), receiptFooter:info.receiptFooter.trim().slice(0,160), currency:info.currency });
  });
}
function outboxRecord(entity, entityId, eventType, payload, now) { return { id:uid(), entity, entityId, eventType, payload, createdAt:now, syncStatus:'pending' }; }
export async function saveProduct(product) {
  const name = String(product.name || '').trim(); if (!name) throw new Error('Escribe el nombre del producto.');
  if (name.length > 120) throw new Error('Nombre demasiado largo.');
  if (![product.price,product.cost,product.stock,product.minStock].every(Number.isSafeInteger)) throw new Error('Los importes y existencias deben ser números válidos.');
  if ([product.price,product.cost,product.stock,product.minStock].some(v=>v<0)) throw new Error('No se permiten valores negativos.');
  const now = new Date().toISOString(); const id = product.id || uid();
  await transaction(['products','outbox','stockMovements'], 'readwrite', async tx => {
    const products = tx.objectStore('products');
    const previous = await request(products.get(id));
    const barcode = String(product.barcode || '').trim(); const sku = String(product.sku || '').trim();
    if (barcode) { const matches = await request(products.index('barcode').getAll(barcode)); if (matches.some(p=>p.id!==id && p.storeId===STORE_ID)) throw new Error('Este código de barras ya pertenece a otro producto.'); }
    if (sku) { const matches = await request(products.index('sku').getAll(sku)); if (matches.some(p=>p.id!==id && p.storeId===STORE_ID)) throw new Error('El SKU ya pertenece a otro producto.'); }
    const record = { id, storeId:STORE_ID, name, category:String(product.category||'General').trim().slice(0,60)||'General', sku, barcode, price:product.price, cost:product.cost, stock:previous ? previous.stock : product.stock, minStock:product.minStock, trackStock: Boolean(product.trackStock), active: product.active !== false, createdAt:previous?.createdAt || now, updatedAt:now };
    products.put(record);
    if (!previous && record.stock !== 0) tx.objectStore('stockMovements').put({id:uid(), storeId:STORE_ID, productId:id, delta:record.stock, reason:'stock_inicial', createdAt:now});
    tx.objectStore('outbox').put(outboxRecord('product',id,previous?'updated':'created',record,now));
  }); return id;
}
export async function adjustStock(id, delta, reason) {
  if (!Number.isSafeInteger(delta) || delta === 0) throw new Error('Introduce una cantidad distinta de cero.');
  const now = new Date().toISOString();
  await transaction(['products','stockMovements','outbox'], 'readwrite', async tx => {
    const store = tx.objectStore('products'); const p = await request(store.get(id)); if (!p) throw new Error('Producto inexistente.');
    if (p.stock + delta < 0) throw new Error('El inventario no puede ser negativo.');
    const updated = {...p, stock:p.stock+delta, updatedAt:now}; store.put(updated);
    const movement = {id:uid(),storeId:STORE_ID,productId:id,delta,reason:String(reason||'ajuste').slice(0,120),createdAt:now};
    tx.objectStore('stockMovements').put(movement); tx.objectStore('outbox').put(outboxRecord('stockMovement',movement.id,'created',movement,now));
  });
}
export async function getOpenSession() { const all = await list('cashSessions'); return all.find(s=>s.storeId===STORE_ID && s.status==='open') || null; }
export async function openCash(amount) {
  if (!Number.isSafeInteger(amount) || amount < 0) throw new Error('Saldo inicial inválido.');
  const now = new Date().toISOString(); const id=uid();
  await transaction(['cashSessions','outbox'], 'readwrite', async tx=>{
    const active=await request(tx.objectStore('cashSessions').index('status').getAll('open'));
    if (active.some(s=>s.storeId===STORE_ID)) throw new Error('Ya existe una caja abierta.');
    const data={id,storeId:STORE_ID,openingAmount:amount,status:'open',openedAt:now,closedAt:null,closingCounted:null};
    tx.objectStore('cashSessions').put(data);tx.objectStore('outbox').put(outboxRecord('cashSession',id,'opened',data,now));
  });return id;
}
export function calculateExpectedCash(session, sales, movements) {
  return session.openingAmount + sales.filter(s=>s.sessionId===session.id).reduce((a,s)=>a+s.cashAmount,0) + movements.filter(m=>m.sessionId===session.id).reduce((a,m)=>a+m.delta,0);
}
export async function addCashMovement(sessionId, delta, reason) {
  if (!Number.isSafeInteger(delta) || delta===0) throw new Error('Monto inválido.');
  const now = new Date().toISOString();
  await transaction(['cashSessions','cashMovements','outbox'], 'readwrite', async tx=>{
    const session=await request(tx.objectStore('cashSessions').get(sessionId)); if (!session || session.status!=='open') throw new Error('Caja cerrada.');
    const movement={id:uid(),sessionId,storeId:STORE_ID,delta,reason:String(reason||'Movimiento manual').slice(0,120),createdAt:now};
    tx.objectStore('cashMovements').put(movement);tx.objectStore('outbox').put(outboxRecord('cashMovement',movement.id,'created',movement,now));
  });
}
export async function closeCash(sessionId, counted) {
  if (!Number.isSafeInteger(counted) || counted<0) throw new Error('Conteo inválido.');
  const now = new Date().toISOString();
  await transaction(['cashSessions','sales','cashMovements','outbox'], 'readwrite', async tx=>{
    const st=tx.objectStore('cashSessions'); const session=await request(st.get(sessionId)); if(!session||session.status!=='open') throw new Error('La caja ya está cerrada.');
    const sales=await request(tx.objectStore('sales').index('sessionId').getAll(sessionId));
    const movements=await request(tx.objectStore('cashMovements').index('sessionId').getAll(sessionId));
    const expected=calculateExpectedCash(session,sales,movements);
    const updated={...session,status:'closed',closedAt:now,closingCounted:counted,closingExpected:expected,difference:counted-expected};
    st.put(updated);tx.objectStore('outbox').put(outboxRecord('cashSession',session.id,'closed',updated,now));
  });
}
export async function createSale(cart, discountPercent, method, amounts = {}) {
  if(!Array.isArray(cart)||!cart.length) throw new Error('El carrito está vacío.');
  if (new Set(cart.map(i=>i.id)).size !== cart.length) throw new Error('El carrito contiene productos duplicados.');
  const now=new Date().toISOString(); const saleId=uid();
  return transaction(['products','sales','saleLines','stockMovements','cashSessions','settings','outbox'], 'readwrite', async tx=>{
    const sessions=await request(tx.objectStore('cashSessions').index('status').getAll('open'));
    const session=sessions.find(s=>s.storeId===STORE_ID); if (!session) throw new Error('Abre la caja antes de vender.');
    const store=tx.objectStore('products'); const lines=[];
    for (const item of cart) {
      if (!Number.isSafeInteger(item.quantity)||item.quantity<1) throw new Error('Cantidad inválida.');
      const p=await request(store.get(item.id)); if(!p||!p.active) throw new Error('Un producto ya no está disponible.');
      if(p.trackStock && p.stock<item.quantity) throw new Error(`Stock insuficiente para ${p.name}. Quedan ${p.stock}.`);
      lines.push({id:uid(),saleId,productId:p.id,description:p.name,sku:p.sku,quantity:item.quantity,unitPrice:p.price,lineTotal:p.price*item.quantity,cost:p.cost,trackStock:p.trackStock});
    }
    const totals=calcCart(lines.map(l=>({price:l.unitPrice,quantity:l.quantity})),discountPercent);
    if (totals.total <= 0) throw new Error('La venta debe tener un total positivo.');
    const payment=paymentBreakdown(method,totals.total,amounts);
    const counterStore=tx.objectStore('settings');const counter=await request(counterStore.get('counter'));
    const number=counter?.nextSale || 1;counterStore.put({id:'counter',nextSale:number+1});
    const settings=await request(counterStore.get('store'));
    const sale={id:saleId,number,storeId:STORE_ID,sessionId:session.id,createdAt:now,subtotal:totals.subtotal,discount:totals.discount,discountPercent:Number(discountPercent),total:totals.total,method,cashAmount:payment.cash,cardAmount:payment.card,transferAmount:payment.transfer,change:payment.change,currency:settings.currency,status:'completed'};
    tx.objectStore('sales').put(sale);
    for (const line of lines){
      tx.objectStore('saleLines').put(line);
      if(line.trackStock){ const p=await request(store.get(line.productId));const upd={...p,stock:p.stock-line.quantity,updatedAt:now};store.put(upd);
        const movement={id:uid(),storeId:STORE_ID,productId:p.id,delta:-line.quantity,reason:`venta #${number}`,saleId,createdAt:now};tx.objectStore('stockMovements').put(movement);
        tx.objectStore('outbox').put(outboxRecord('stockMovement',movement.id,'created',movement,now));
      }
    }
    tx.objectStore('outbox').put(outboxRecord('sale',saleId,'created',{sale,lines},now));
    return {sale,lines,settings};
  });
}
export async function exportBackup() {
  const db=await openDB(); const tx=db.transaction(TABLES,'readonly'); const done=new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error);});
  const data={format:'pos-universal-backup',version:1,exportedAt:new Date().toISOString(),tables:{}};
  for(const name of TABLES) data.tables[name]=await request(tx.objectStore(name).getAll());
  await done;return data;
}
export async function restoreBackup(backup) {
  if (!backup || backup.format!=='pos-universal-backup' || backup.version!==1 || !backup.tables || TABLES.some(t=>!Array.isArray(backup.tables[t]))) throw new Error('Archivo no compatible con esta versión.');
  if (backup.tables.products.length>100000 || backup.tables.sales.length>1000000) throw new Error('Archivo demasiado grande.');
  // A restore replaces every local table atomically, never merging or duplicating sales.
  await transaction(TABLES,'readwrite',async tx=>{
    for (const name of TABLES) {
      await request(tx.objectStore(name).clear());
      for (const item of backup.tables[name]) {
        if(!item || typeof item!=='object'||typeof item.id!=='string') throw new Error(`Registro inválido en ${name}.`);
        tx.objectStore(name).put(item);
      }
    }
  });
}
