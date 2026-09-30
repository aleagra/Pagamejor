# Regla: Principios de Diseño Visual y Accesibilidad (Senior-Friendly)

PagaMejor está pensada especialmente para ser utilizada sin fricciones por personas de todas las edades, con especial atención a adultos mayores y usuarios que prefieren interfaces serenas, claras y directas.

Toda propuesta visual o componente desarrollado por `frontend-agent` debe cumplir estas pautas por defecto, sin necesidad de recordarlo:

---

### 1. Paleta de Colores Serena y Cálida
- **Evitar**: Fondos negros puros (#000000), colores fluorescentes, contrastes estridentes o degradados agresivos.
- **Adoptar**:
  - Fondos cálidos: crema suave (`#FDFBF7`), lino (`#F7F4EE`), marfil.
  - Textos de alto contraste pero descansados: carbón cálido (`#1E2229`), pizarra profunda (`#2D3748`).
  - Colores de acento amables: verde oliva/salvia (`#2E6A4F` o `#388E3C`), terracota cálido (`#C85A32`), azul sereno (`#1B4965`).
  - Tarjetas con bordes suaves y sombras muy sutiles o flat con bordes claros (`1px solid #E2DCD5`).

---

### 2. Tipografía Grande y Altamente Legible
- **Fuente**: Tipografía sans-serif moderna con excelente legibilidad y apertura (ej. *Inter*, *Plus Jakarta Sans* o *Outfit*).
- **Escala de tamaños**:
  - Texto secundario / leyendas: mínimo `1rem` (16px).
  - Cuerpo de texto principal: `1.125rem` a `1.25rem` (18px a 20px).
  - Subtítulos y etiquetas de botones: `1.25rem` a `1.35rem` (20px a 22px).
  - Titulares principales: `1.75rem` a `2.25rem` (28px a 36px).
- **Interlineado y peso**: `line-height` generoso (mínimo 1.5 en párrafos) y pesos legibles (evitar `font-weight: 300` o ultra-light; priorizar `400`, `500` y `600`).

---

### 3. Blancos Táctiles y Navegación Sin Errores
- **Botones y elementos interactivos**: Área táctil mínima de **48px x 48px** (idealmente **56px de altura** para botones principales de selección).
- **Espaciado generoso**: Margen suficiente entre botones para evitar pulsaciones erróneas involuntarias.
- **Iconografía intuitiva**: Los iconos deben estar siempre acompañados de texto explícito (nunca un icono flotante sin etiqueta de texto explicativa).

---

### 4. Movimiento con Presencia, pero Medido (uso diario)
- Las animaciones se notan y dan vida (entradas en cascada, contador del porcentaje, selectores que se deslizan, sheets con resorte), pero son cortas (menos de 1s), se ven una vez por acción y nunca obligan a esperar para tocar.
- Usar Motion (`motion/react`) con springs de rebote leve (`bounce` 0.15–0.25) y Lenis solo para rueda/trackpad. El detalle completo está en `.agents/prompts/rediseno-minimalista.md`.
- **Modo liviano obligatorio**: toda animación nueva tiene que apagarse con el modo liviano (`useModoLiviano()` en `MotionProvider`). En ese modo no se usan `layoutId`, Lenis ni `backdrop-filter`, y las sombras salen de las variables `--shadow-*` (que ese modo reemplaza por bordes). Se activa solo en equipos lentos, sin aceleración gráfica, con ahorro de datos o con "reducir movimiento" del sistema.
- Prohibidas las animaciones en bucle o parpadeantes, el parallax, los giros bruscos, los carruseles automáticos que se muevan solos y los modales invasivos no solicitados.

---

### 5. Claridad en la Información Financiera
- Los números importantes deben verse de inmediato:
  - El porcentaje de descuento en tamaño destacado (ej. **"20% de reintegro"**).
  - El tope en pesos claros (ej. **"Tope: $8.000 por mes"**).
  - La indicación exacta de cómo pagar: **"Pagando con QR desde la app Cuenta DNI"**.
