# Regla: Dominios y Delimitación de Archivos por Agente

En este repositorio está prohibido que un agente edite archivos fuera de su dominio asignado. El Orquestador supervisa y rechaza cualquier modificación que cruce estas fronteras.

---

### 1. `data-agent`
- **Ámbito exclusivo**:
  - `src/data/promos.json` (Catálogo maestro de promociones)
  - `src/data/schema.ts` (Definición TypeScript del esquema de promociones)
  - `src/data/bancos.json` (Listado normalizado de bancos y billeteras de Argentina)
  - `src/data/rubros.json` (Taxonomía de rubros comerciales)
  - `scripts/validate-data.ts` (Script de validación de consistencia y duplicados)
- **Límites**:
  - NO debe tocar componentes visuales (`src/components/**`).
  - NO debe implementar el algoritmo de búsqueda de mejor opción en runtime (`src/logic/**`).
  - Es el **ÚNICO** agente autorizado a modificar `src/data/promos.json`.

---

### 2. `frontend-agent`
- **Ámbito exclusivo**:
  - `src/app/**` (Páginas, layouts y rutas de Next.js)
  - `src/components/**` (Componentes de UI: Billetera, Rubros, Resultados, Tarjetas, Modales)
  - `src/styles/**` (Tokens CSS, estilos globales)
  - `public/**` (Iconos PWA, manifest.webmanifest, assets estáticos)
- **Límites**:
  - NO debe modificar `src/data/promos.json` ni alterar el esquema de datos.
  - NO debe programar lógica de negocio de comparación o cálculo de tops; debe consumir las funciones provistas por `logic-agent`.
  - Debe respetar estrictamente los principios de diseño para adultos mayores.

---

### 3. `logic-agent`
- **Ámbito exclusivo**:
  - `src/logic/engine.ts` (Motor de comparación y ordenamiento determinístico)
  - `src/logic/walletStorage.ts` (Lectura y persistencia de medios de pago en localStorage)
  - `src/logic/types.ts` (Tipos auxiliares para el cruce de datos)
  - `tests/logic/**` (Pruebas unitarias de cálculo, vigencia y filtros)
- **Límites**:
  - NO debe importar ni manejar elementos de JSX/React/HTML ni estilos.
  - NO debe modificar el archivo de datos `promos.json`.
  - Cero llamadas a APIs de IA; la lógica es 100% matemática y determinística.

---

### 4. `monitor-agent`
- **Ámbito exclusivo**:
  - `scripts/monitors/**` (Scrapers o verificadores de páginas de bancos)
  - `scripts/reports/**` (Reportes de vigencia o cambios detectados)
- **Límites**:
  - Vive fuera del bundle de la aplicación web.
  - No tiene dependencias de UI ni de runtime de cliente.
  - Si detecta cambios, emite reportes para que `data-agent` realice las actualizaciones correspondientes.
