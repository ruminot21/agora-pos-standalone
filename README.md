# ÁGORA POS v2 — Diseño visual inspirado en la referencia

Interfaz **React + TypeScript + Vite + Tailwind CSS v4**, con componentes visuales de catálogo, favoritos, filtros, venta actual, caja, productos, inventario, reportes, configuración y tickets. Basado en el motor de datos transaccional IndexedDB de Ágora POS v1.

## Arrancar (requiere Node.js 22.12+ y conexión para instalar dependencias una vez)

```bash
npm install
npm run dev
```

Abrir http://localhost:5173.

## Crear versión offline (PWA)

```bash
npm run build
npm run preview
```

El script `scripts/generate-sw.mjs` genera un service worker con los archivos reales del build para uso offline **después de la primera carga en HTTPS o localhost**. En navegador privado o después de limpiar datos, la base de datos puede desaparecer: exportar respaldos periódicos. `dist/` contiene la versión para publicar.

## Primer uso

1. Al iniciar sin productos, se ve un **catálogo de muestra claramente rotulado** (sin datos reales, no se pueden registrar ventas de esos artículos hasta importarlos).
2. Pulsa **Cargar catálogo demo** si deseas experimentar con esos artículos; también puedes ir a Productos y crear solo productos reales.
3. Pulsa **Caja cerrada** y abre caja (con monto inicial).
4. Agrega productos y entra a **COBRAR**. Usa pagos efectivo, tarjeta, transferencia o mixto. El cobro guarda la venta y descuenta existencias en una misma transacción local.
5. En Configuración exporta una copia de seguridad JSON periódicamente.

Atajos: `F2` busca producto; `F8` abre el diálogo de cobro.

## Android y escritorio

Las carpetas de integración nativa están preparadas, pero **no se incluyen APK ni instaladores compilados**. Requieren entornos de compilación propios (Android Studio + Java; Tauri CLI + Rust y bibliotecas del sistema).

```bash
npm run android:init
npm run android:sync
npm run android:open

npm run desktop:dev
npm run desktop:build
```

## Restricciones importantes

- Datos en IndexedDB local por navegador/perfil: **sin sincronización entre cajas**. El esquema `database/server-postgres.sql` es solo propuesta de fase 2.
- No hay facturación electrónica fiscal, usuarios y roles reales, integración directa de terminal bancaria ni control real de pantalla secundaria.
- Se admite producto por unidades enteras. Venta por kilogramos/decimales no está implementada pese a que el diseño incluya etiqueta “GRANEL”.
- El campo «Recargo» está visible por fidelidad visual pero se bloquea el cobro cuando es distinto de cero (no se calcula ni persiste silenciosamente).
- La tipografía y fotografías de ejemplo están empaquetadas localmente; las imágenes se recortaron de la captura suministrada por el usuario y pertenecen solo al catálogo demo.
- Sin dependencias instaladas no puede ejecutarse el proyecto React. Se incluye también **una vista previa independiente** para explorar el diseño, sin backend.

## Validación local

`npm test` prueba la aritmética y reglas del backend; `npm run build` verifica compilación de React. En el entorno de generación, el acceso al registro npm no estuvo disponible, por lo que la compilación React y las pruebas visuales integradas no pudieron completarse aquí. Evita usar el software para producción antes de realizarlas.
