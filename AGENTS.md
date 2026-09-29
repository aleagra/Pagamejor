# PagaMejor (pagamejor.ar) - Guía Maestra y Reglas del Proyecto

Este proyecto opera bajo un modelo de **Agentes Especializados** coordinados por un Orquestador central. Toda interacción en este repositorio debe respetar estrictamente los dominios de responsabilidad y las reglas de producto aquí definidas.

---

## 1. Principios Inmutables de Producto

1. **Filtro Estricto de Billetera (No Negociable)**:
   - **NUNCA** se debe mostrar una promoción de un banco, tarjeta o billetera que el usuario no haya seleccionado explícitamente en "Mi Billetera".
   - Excepción explícita (MODO): MODO no es una tarjeta sino una app que se vincula a una tarjeta de un banco adherido. Las promos *generales* de MODO ("cualquier banco adherido") se muestran a quien tenga MODO **o** cualquier banco con `adheridoAModo: true` en `bancos.json`. Las promos exclusivas de un banco vía MODO (ej. Hipotecario, YOY) se muestran solo bajo ese banco, con el aviso de que se pagan con MODO.
   - Está terminantemente prohibido sugerir "la mejor opción del mercado" si el usuario no posee ese medio de pago. Si para el rubro y día seleccionado el usuario no tiene ninguna promoción aplicable con sus medios de pago, la aplicación debe indicarlo con total claridad y amabilidad (ej. *"Hoy no tenés promociones activas en este rubro con tus medios de pago actuales"*).

2. **Diseño Visual para Adultos Mayores**:
   - Estética serena, cálida y de baja estimulación (sin estridencias, sin animaciones llamativas ni micro-interacciones confusas).
   - Tipografía grande y de altísima legibilidad (mínimo 16px para texto secundario, 18-20px para cuerpo y 24px+ para titulares).
   - Elementos interactivos amplios (botones y tarjetas con target táctil mínimo de 48px a 56px).
   - Alto contraste accesible pero sin fondos negros puros; usar tonos cálidos y descansados (arena, crema, terracota suave, verdes salvia, azul petróleo profundo).

3. **Cero Inteligencia Artificial en Runtime (100% Determinístico)**:
   - En el camino crítico de producción no hay llamadas a modelos de lenguaje (LLMs).
   - La recomendación de "¿con qué tarjeta me conviene pagar hoy?" se calcula localmente en el navegador de manera 100% determinística y matemática cruzando:
     - Medios de pago activos en `localStorage`
     - Día de la semana actual (`Date.getDay()`)
     - Rubro seleccionado
     - Mayor porcentaje de reintegro y tope disponible.

4. **Privacidad y Cero Fricción (V1)**:
   - No requiere registro ni login. Las preferencias se guardan en el `localStorage` del dispositivo del usuario.

---

## 2. Mapa de Agentes Especializados

| Agente | Responsabilidad Principal | Archivos Permitidos | Archivos Prohibidos |
| :--- | :--- | :--- | :--- |
| **`data-agent`** | Esquema y catálogo de promociones bancarias argentinas | `src/data/**`, `scripts/validate-data.ts` | `src/app/**`, `src/components/**`, `src/logic/**` |
| **`frontend-agent`** | Vistas, componentes, estilos, diseño accesible y PWA | `src/app/**`, `src/components/**`, `src/styles/**`, `public/**` | `src/data/promos.json`, `src/logic/**` |
| **`logic-agent`** | Motor de filtrado y cálculo determinístico, persistencia local | `src/logic/**`, `tests/logic/**` | `src/app/**`, `src/components/**`, `src/data/promos.json` |
| **`monitor-agent`** | Auditoría y verificación periódica de sitios bancarios | `scripts/monitors/**`, `scripts/reports/**` | Todo el código de producción en `src/**` |
| **`orchestrator`** | Coordinación de tareas, asignación y control de límites | Todos (en rol supervisor) | Edición directa sin delegar al agente correspondiente |

---

## 3. Comportamiento en cada Turno

- Antes de modificar un archivo, verificar si la tarea corresponde al agente activo.
- Si una solicitud toca múltiples áreas (ej. agregar un campo a la promo y mostrarlo en la UI), el Orquestador debe secuenciar la tarea:
  1. `data-agent` actualiza el esquema y datos.
  2. `logic-agent` adapta el cálculo o tipado si aplica.
  3. `frontend-agent` implementa el componente visual.

---

## 4. Operación del `monitor-agent` y Auditorías

El `monitor-agent` es el encargado de auditar de forma autónoma las fuentes bancarias externas para detectar vigencias, cambios de topes y nuevas promociones.

### Scripts Especializados (`scripts/monitors/`):
Cada fuente tiene su método; la fuente de verdad es `scripts/monitors/sources.json`.
1. **`cuentadni.js`**: listado estático + API de detalle oficial (`GetBeneficioData2`). Vigencia del texto legal, variantes NFC/cuenta de las cláusulas numeradas.
2. **`uala.js`**: listado estático + detalle por promo (`/promociones/<comercio>`): días del selector `LMMJVSD`, tope, vigencia y T&C. Ignora promos de un solo uso/suscripción.
3. **`modo.js`**: API JSON pública de MODO (no requiere Playwright) + mapa de comercios para verificar presencia en Mar del Plata.
4. **`naranjax.js`**: API BFF JSON de Naranja X (Playwright es bloqueado por Cloudflare). Ignora cuotas y "Exclusiva Plan Turbo".
5. **`galicia.js`**: API BFF JSON con filtro `Localidad=MAR DEL PLATA` (endpoint identificado con DevTools > Network).
6. **`patagonia.js`**: estático por categoría; guarda los 3 niveles Clásica/Plus/Singular en `niveles`. Excluye Río Negro/otras provincias.
7. **`supervielle.js`**: sub-páginas estáticas por rubro (`__NEXT_DATA__`) y `/identite`; guarda Clásico/Identité en `niveles`.
8. **`mercadopago.js`**: sub-fuente PÚBLICA; la vigencia sale siempre del "Legales" de cada card. La sub-fuente logueada (app) es 100% manual.
- **`monthly-check.js`**: checklist con la última verificación de cada fuente, recordatorios de las fuentes manuales y corrida mensual (`npm run monitor:monthly`, `monitor:all`, `monitor:status`).
- Utilidades: `utils/common.js` (parseo de fechas/días/topes) y `utils/diff-reporter.js` (reporte de diferencias).

### Regla de Alcance Geográfico
Solo se cargan/activan promos que apliquen en **Mar del Plata**. Las de otras provincias se excluyen o quedan `activo:false` con nota. Donde la fuente no informa sucursales (Patagonia, Naranja X, Supervielle) solo se activan cadenas de presencia nacional (`PRESENCIA_MDP` en `utils/common.js`).

### Aplicación de Reportes (`data-agent`)
Tras aprobar el reporte: `node scripts/data/apply-extract.js <fuenteId> [--dry] [--deactivate-missing] [--only=ids]`. Actualiza los campos estructurados de `promos.json`, conserva los textos curados y corre `validate-data`.

### Protocolo de Datos y Reportes:
- Los scripts **NUNCA** modifican `src/data/promos.json` de forma directa.
- Generan reportes de diferencias estructurados en `scripts/reports/<fuente>-report.json` categorizando:
  - Promociones vigentes confirmadas
  - Modificaciones detectadas (cambio de tope o porcentaje)
  - Nuevas promociones detectadas
  - Promociones vencidas o no encontradas
- El `data-agent` toma estos reportes como insumo para actualizar el catálogo maestro.

### Cadencia Mensual
Las promos se renuevan el día 1: el primer día hábil de cada mes correr `npm run monitor:all` (o programar `npm run monitor:monthly`, que solo actúa ese día), revisar `scripts/reports/monthly-report.md` y aprobar. Las fuentes manuales (Mercado Pago logueado y promos sin extractor) requieren capturas nuevas ese mismo día: ver `scripts/reports/checklist.md`.

### Mejora Futura: Automatización Programada (Cron con GitHub Actions)
Actualmente, los scripts se ejecutan a demanda (`npm run monitor:all` o scripts individuales).
Como mejora futura para V2, se recomienda implementar un flujo de GitHub Actions con trigger `schedule` (cron) semanal o mensual:
```yaml
# .github/workflows/monitor-cron.yml (propuesta futura)
name: Monitor Bancario Periódico
on:
  schedule:
    - cron: '0 9 1,15 * *' # Días 1 y 15 de cada mes a las 9am UTC
  workflow_dispatch:

jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - run: npm run monitor:all
      - name: Generar Issue o PR si hay cambios
        # Script que detecta si los reportes contienen novedades y abre un Issue/PR para el data-agent
```

