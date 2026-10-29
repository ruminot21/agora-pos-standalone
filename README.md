# ÁGORA POS — Versión ejecutable sin npm

Esta versión web usa JavaScript nativo y el backend transaccional IndexedDB. Se puede ejecutar en una PC sin descargar dependencias.

## Arrancar

Con Python 3 instalado, abre una terminal en esta carpeta y ejecuta:

```bash
python3 -m http.server 8000
```

Abre `http://localhost:8000` en Chrome/Chromium/Edge. El servidor local no necesita Internet. **No** hagas doble clic en `index.html` (`file://`), ya que el origen no es adecuado para IndexedDB.

## Cómo probar

1. En la pantalla inicial, el catálogo de 21 productos es una **vista previa**. Pulsa **Cargar catálogo demo** (datos ficticios de prueba) o crea productos reales desde el menú.
2. Abre la caja usando el botón de arriba.
3. Agrega artículos, haz clic en **COBRAR** y selecciona el método de pago.
4. Consulta productos, inventario, reportes e imprime el comprobante comercial.
5. Exporta regularmente respaldos JSON desde Configuración.

## Avisos

- IndexedDB conserva los datos por origen/perfil de navegador, pero se pueden perder si borras datos del sitio. Copia de seguridad fundamental.
- Sin multiusuario, sincronización, permisos, boleta electrónica fiscal, pasarela de pago, peso decimal/granel ni soporte directo de impresoras ESC/POS. No es apta aún para producción comercial.
- Recargo en pantalla es **solo visual**: se impide cobrar con valor distinto de cero.
- Fotografías recortadas de la captura de referencia del usuario para el catálogo de demostración.
- Esta entrega es el ejecutable web sin React; el proyecto React + TypeScript está en el ZIP de código fuente principal.
