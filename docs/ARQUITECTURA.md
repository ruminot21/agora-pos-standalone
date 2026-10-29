# ÁGORA POS — Arquitectura técnica v1.0

## Visión

- **Cliente web/PWA**: HTML/CSS/JavaScript ES Modules sin CDN. Service Worker precachea aplicación. Base IndexedDB en el navegador, accesible desde `localhost` o HTTPS.
- **Android**: Capacitor 8 carga el mismo bundle local dentro de WebView. Los datos residen en el almacenamiento propio de la aplicación (IndexedDB). Proyecto Android se genera con Android Studio.
- **Escritorio (Windows/Linux)**: Tauri 2 carga los mismos recursos web empaquetados localmente en WebView. Necesita Rust y prerrequisitos del sistema para compilar.
- **Servidor (fase 2)**: servicio HTTPS de autenticación + sincronización + PostgreSQL multi-tenant. La migración base está en `database/server-postgres.sql`, todavía **NO** existe la API ni hay sincronización real.

```
                       FASE 1 - instalada en cada dispositivo
       +-----------------+    +------------------+    +-----------------+
       | Windows / Linux |    | Android (APK)    |    | PWA navegador   |
       | Tauri WebView   |    | Capacitor        |    | Service Worker  |
       +--------+--------+    +---------+--------+    +--------+--------+
                |                       |                      |
                +-----------------------+----------------------+
                                        |
                              misma lógica JavaScript
                                        |
                              IndexedDB + Outbox local

               FASE 2 - POR IMPLEMENTAR
                 Dispositivo -> HTTPS -> API autenticada -> PostgreSQL
                                          ^  cursor seq / eventos idempotentes
```

## Datos locales (IndexedDB: pos-universal-v1)

| Objeto | Campos clave | Comentario |
|---|---|---|
| settings | id, name, currency, nextSale | Configuración comercial y contador |
| products | id UUID, storeId, name, category, sku, barcode, price, cost, stock, minStock, trackStock, active | Precios enteros en unidad mínima |
| sales | id UUID, number, sessionId, subtotal, discount, total, cashAmount, cardAmount, transferAmount, currency, createdAt | Venta cerrada e inmutable |
| saleLines | id UUID, saleId, productId, quantity, unitPrice, lineTotal, description | Foto del precio al vender |
| stockMovements | id UUID, productId, delta, reason, saleId, createdAt | Trazabilidad de existencias |
| cashSessions | id UUID, openedAt, openingAmount, status, closingCounted, closingExpected, difference | Apertura/cierre por dispositivo |
| cashMovements | id UUID, sessionId, delta, reason | Retiros/ingresos manuales |
| outbox | id UUID, entity, eventType, payload, createdAt, syncStatus | Eventos locales pendientes de enviar a fase 2 |

Todas las escrituras de una venta (venta, líneas, bajas de stock, contador, outbox) se hacen en **una transacción IndexedDB**. Si una línea no tiene stock, toda la operación falla. No se aplica IVA, descuentos fiscales, devoluciones ni facturación electrónica en MVP.

## Próximo mecanismo de sincronización (no implementado)

1. Cada dispositivo tiene identidad registrada y credenciales seguras, con autorización por organización/sucursal.
2. El cliente emite eventos con UUID inmutable en la `outbox`. El servidor ejecuta `POST /sync/push` idempotente: UUID ya visto => responde OK sin duplicar venta; operaciones nuevas se validan y aplican transaccionalmente.
3. `GET /sync/pull?cursor=<seq>` devuelve cambios de esa organización por número de secuencia. El cursor se actualiza únicamente tras aplicar cambios localmente.
4. Las ventas y movimientos de stock son **eventos inmutables**. Los datos editables de producto emplean `version` y detección de conflictos; no se usa `last-write-wins` silencioso para cambios de precios o cantidades.
5. No prometer inventario consolidado correcto para **dos cajas desconectadas vendiendo simultáneamente**: antes de operar varias cajas, hay que elegir (a) servidor local LAN con stock centralizado, o (b) cuotas de stock asignadas a cada dispositivo (reservas offline). Un simple outbox no evita sobreventa.
6. Diseñar reconciliación, devoluciones, control de permisos, cifrado de copias y resolución manual de eventos rechazados antes de producción multi-dispositivo.

## Seguridad y límites

- Los datos de la fase 1 están en el dispositivo y **no poseen autenticación fuerte**. No almacenar datos sensibles de tarjeta, contraseñas de clientes ni información privada innecesaria.
- Los respaldos JSON están **sin cifrar**; custodiar como datos sensibles. Verificar respaldos haciendo pruebas periódicas de restauración.
- Los navegadores pueden eliminar almacenamiento local en ciertas circunstancias. Pedir almacenamiento persistente en fase 2 y usar copias externas; no depender solamente de IndexedDB.
- Las cifras de inventario y caja de la fase 1 **solo** corresponden a este dispositivo. No compartir un mismo depósito entre varias cajas sin el nodo LAN o sincronización robusta.
- La moneda queda bloqueada tras crear productos o ventas para impedir corrupción de importes.
- La app NO reemplaza un sistema fiscal autorizado ni emite documentos tributarios electrónicos; el recibo imprimible es comercial.
- En despliegues HTTPS, usar CSP restringida, controlar orígenes y cifrar la sincronización; la CSP de Tauri se ha dejado en null por simplicidad del prototipo y se debe endurecer antes de publicar.

## Etapas

- **MVP 1 actual**: POS móvil y desktop adaptable, catálogo, stock, caja, venta, 3 pagos + mixto, ticket, informes, backup, PWA.
- **MVP 2**: usuarios/PIN seguro, permisos, devoluciones, productos por variante, clientes, proveedores, impuestos/localización fiscal, reportes avanzados, etiquetas, lector USB/HID probado, impresora térmica ESC/POS.
- **Versión 3**: backend, login, PostgreSQL, multi sucursal, cuotas offline o nodo LAN, sincronización con conflictos, auditoría, CI, actualizaciones firmadas, pruebas de estrés, cifrado.
