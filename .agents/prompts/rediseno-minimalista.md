# Prompt: Rediseño minimalista de PagaMejor

> Construido con el método "producto → stack → estética → lenguaje visual → movimiento → secciones → referencias → vara de calidad".
> Destinatario: `frontend-agent`. Alcance: `src/app/**`, `src/components/**`, `src/styles/**`, `public/**`.

---

Rediseñá por completo la interfaz de **PagaMejor** (pagamejor.ar). Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS v4 con tokens en `@theme`, **Motion (Framer Motion, `motion/react`) para todas las transiciones**, Phosphor Icons (`@phosphor-icons/react`) para todos los íconos (peso `regular`, `fill` en lo elegido y `duotone` en los acentos), logos oficiales de las apps bancarias en `public/logos/<id>.webp`, Inter vía `next/font` como respaldo de SF Pro. **Lenis para el scroll con inercia**, solo con rueda o trackpad (`syncTouch: false`): en el celular queda el táctil nativo, que ya tiene inercia.

**Producto.** PagaMejor responde una sola pregunta: *"¿con qué tarjeta o billetera me conviene pagar hoy?"*. La persona marca sus bancos y billeteras ("Mi billetera", guardado en `localStorage`), elige un rubro y un día, y ve sus promociones ordenadas por porcentaje de reintegro y tope. Público: todas las edades, con foco en adultos mayores de Mar del Plata. Sin registro y sin IA en runtime.

**Estética.** Minimalismo de Apple aplicado a un producto financiero sereno: la información *es* la interfaz. Diseñá la pantalla como si fuera la app Wallet de Apple, pero hecha para tu abuela: se entiende en tres segundos y se usa con un pulgar.

## Lenguaje visual

- **Superficies.** Fondo lino cálido (`#F6F4EF`, la versión cálida del `#F5F5F7` de Apple). Tarjetas blancas **sin borde**, radio 24px, con una sombra casi imperceptible (dos capas, opacidad ≤ 6%). Nada de fondos negros puros.
- **Un solo acento.** Verde bosque (`#1E6B48`) solo para lo que importa: el porcentaje, la selección y la acción principal. Terracota (`#B44D25`) únicamente para advertencias (pagar con MODO, compra mínima). Todo lo demás en tinta cálida y grises cálidos.
- **Jerarquía editorial.** El porcentaje es el protagonista: 80px, peso 700, tracking −0.04em, números tabulares, al lado de una etiqueta de 18px "de reintegro". Titulares de 36 a 44px en semibold con tracking negativo. Etiquetas de sección de 16px en gris cálido y en minúsculas; nada de mayúsculas gritonas. **Ningún texto por debajo de 16px.**
- **Listas agrupadas estilo iOS (inset grouped).** Una fila por banco, de 76 a 88px, separadas por líneas finas de 1px que arrancan después del logo. Se acabaron las tarjetas dentro de tarjetas y los bordes de 2px.
- **Controles nativos.** Control segmentado para los días (riel gris, segmento elegido blanco con sombra suave), pills para los rubros y sheets que suben desde abajo en el celular.
- **Silencio visual.** Sin gradientes, texturas, badges en mayúsculas ni emojis gigantes (los rubros usan íconos de Phosphor, no emojis). Íconos de Phosphor con un trazo uniforme en lugar de emojis (rubros incluidos), siempre acompañados de texto. Cada banco se muestra con el ícono oficial de su app.
- **Aire.** Margen lateral de 20px en el celular y de 40 a 48px entre secciones. El espacio vacío también es parte del diseño.

### Terminaciones (actualización del 30/09)

Clima cálido y pulido, con el verde de siempre como acento:

- **Tipografía:** Instrument Sans (`next/font`). Los titulares van en semibold y con tracking bien negativo (−0.045em).
- **Fondo:** piedra liso (`#EEEDE8`), sin degradés ni cuadrícula: contrasta con las tarjetas blancas y hace resaltar el verde.
- **Pie:** franja de ancho completo en tinta casi negra (`--color-pie`, `#131517`, la de los botones) con texto claro y detalles en menta (`--color-pie-acento`): marca, tres datos de confianza y la aclaración de los reintegros. Marca dónde termina la página.
- **Tarjetas** (`.tarjeta`): blancas, borde neutro de 1px y radio de 24 a 28px. Al pasar el mouse suben 2px, el borde se marca un poco y la sombra crece. Sin halos ni brillos de color.
- **Color con significado:** el verde es solo para la plata: porcentajes, "Tu mejor opción" y el panel del reintegro. Los botones principales, el rubro y el filtro elegidos, las marcas de verificación y los íconos de datos van en tinta (`--color-action`) o en gris. El ícono de "QR MODO" va en el mismo gris que el resto.
- **Logos:** en círculo, con un aro menta (`BankBadge aro`).
- **Porcentajes:** pill verde suave con borde fino. Acción principal en pill verde con sombra verde.

Esto reemplaza "sin gradientes" y "sin borde" de más arriba.

## Movimiento

Movimiento **con presencia pero medido**: esto se abre todos los días para pagar, no es una landing de lanzamiento. Cada animación dura menos de un segundo, se ve una vez por acción y nunca bloquea el uso. Springs con un **rebote leve** (`bounce` entre 0.15 y 0.25, alrededor de 0.5s).

- **Primera carga:** marca, título, rubro y días suben 14px en cascada (70ms entre bloques), como un telón que se levanta.
- **El porcentaje protagonista cuenta hacia arriba** en 0.8s con salida suave y termina exacto. El lector de pantalla lee solo el valor final.
- **Tarjeta protagonista:** entra con escala 0.97 → 1 y un leve resorte cada vez que cambia el rubro o el día.
- **Otras opciones:** las tarjetas aparecen en cascada al entrar en pantalla (50ms entre tarjetas, tope de 5) y se vuelven a acomodar al cambiar de filtro.
- **Selectores:** el fondo verde de los pills de rubro y el segmento blanco de los días se deslizan hasta la opción elegida con un pequeño rebote. En el celular, el rubro nuevo entra desde abajo.
- **Título:** al cambiar el día, "¿Con qué pago hoy?" sale hacia arriba y el nuevo entra con un desenfoque que se aclara.
- **Sheets:** suben con resorte y el fondo se oscurece y se desenfoca. En el celular se cierran arrastrando el asa hacia abajo. El contenido se asienta un instante después que el contenedor y la salida es más rápida que la entrada.
- **Micro-interacciones:** al tocar, los botones escalan a 0.95–0.98; al pasar el mouse, los pills suben 2px y las flechas avanzan 4px. Las marcas de Mi billetera aparecen con un "pop" y los acordeones abren con resorte.
- **Detalle:** la ventana sube con resorte (hoja en el celular, centrada en escritorio). Las filas que agrega "Mostrar más" entran en cascada.
- **Modo liviano** (`src/components/modoLiviano.ts`): sin animaciones (`MotionConfig skipAnimations`), sin Lenis, sin `layoutId`, sin desenfoques y con las sombras difusas cambiadas por bordes finos. La página se ve igual, pero no se mueve.
  - **Se activa solo** si el sistema pide reducir movimiento, si hay ahorro de datos, con 2 núcleos o 2GB de RAM o menos, si el navegador dibuja por software (WebGL con `failIfMajorPerformanceCaveat` rechazado, o renderizador SwiftShader/llvmpipe), si al cargar se miden menos de 45fps, o si **2 de las últimas 3 interacciones se trabaron** (percentil 90 de cuadro > 40ms medido justo después de tocar algo: es lo que detecta un Android que va a 60 quieto pero se traba al abrir un acordeón). La medición lenta se recuerda 30 días.
  - **Sin control manual:** se decide solo. Solo se respeta un "desactivadas" guardado; un "activadas" del control viejo se borra porque anulaba la detección.
  - **Animaciones baratas en celular:** los acordeones van con CSS (`grid-template-rows` 0fr→1fr, 200ms), sin medir alturas con JavaScript; el fondo de las hojas no se desenfoca en celular.
- **Prohibido:** parallax, animaciones en bucle, carruseles automáticos, parpadeos, rebotes exagerados y cualquier animación que haga esperar para poder tocar.

## Secciones

1. **Encabezado.** A la izquierda, la marca "PagaMejor"; a la derecha, una pill "Mi billetera" con la cantidad de medios. Debajo, un título grande en dos niveles: la fecha arriba en gris ("Hoy, martes 29 de septiembre") y "¿Con qué pago hoy?" en 40px. Si se elige otro día, el título cambia a "¿Con qué pago el jueves?".
2. **Rubro.** Los tres con promos en más bancos y billeteras (Supermercados, Gastronomía y Farmacias; ver `RUBROS_FRECUENTES`) más "Más", que abre el catálogo con buscador y muestra solo los rubros con al menos una promo activa (nada de categorías vacías). Si se elige otro rubro, el cuarto botón pasa a mostrarlo. En escritorio van en la barra de vidrio; en el celular, como cuatro botones con el ícono arriba (Súper, Comida, Farmacia, Más) debajo del título.
3. **Día.** La pantalla principal muestra siempre hoy: la fecha es texto, no un selector. Planificar otro día es una vista aparte ("Ver otro día" abre un sheet con los próximos 7 días); mientras se mira otro día aparece "Volver a hoy".
4. **Mejor opción.** Una franja horizontal a todo el ancho: el porcentaje grande a la izquierda sobre un fondo verde suave, en el medio la etiqueta "Tu mejor opción", logo, nombre, comercios, medio de pago y tope, y a la derecha la acción "Ver todos los detalles" (en el celular, abajo). En el celular no hay globito: la tarjeta cierra con un pie como el de las otras tarjetas (línea fina, "También 15% en Carrefour y 1 más" a la izquierda y un botón compacto "Ver todo →" a la derecha). Desde tablet, sobre el botón, un globito blanco fijo: "Mirá los detalles antes de pagar" y un lugar concreto que no se ve en la tarjeta ("También 20% en Comercios de cercanía y 4 más"), para que nadie crea que es un solo lugar. La primera vez, un tutorial de un paso (`TourDetalles`) oscurece la pantalla, ilumina "Ver todos los detalles" y explica que adentro están todos los lugares; se puede abrir el detalle desde ahí o cerrarlo, y no vuelve a aparecer (`pagamejor_tour_detalles`). Toda la tarjeta abre el detalle.
5. **Otras opciones.** Una grilla de tarjetas (1 columna en el celular, 2 en tablet, 3 en escritorio), **siempre de mayor a menor descuento** en el orden del motor (`src/logic/orden.ts`: alcance general antes que limitado, porcentaje, tope llevado a un mes, compra mínima; si empatan, más opciones y nombre). En el detalle, una promo de alcance limitado dice "Solo en algunos lugares puntuales". Cada tarjeta: logo en círculo con aro, nombre y porcentaje en la misma línea, comercios, medio de pago y, al pie, tope y "N opciones →". Si da el mismo porcentaje que otra de más arriba, una línea gris bajo el nombre explica por qué quedó detrás, sin recuadro ni ícono: "Mismo % y tope", "Mismo %, menor tope" o "Mismo %, pide mínimo" (el porcentaje ya está en la etiqueta verde). Nunca se nombra a otra tarjeta: se dice el dato. Si la mejor opción empata con otras, al lado de "Tu mejor opción hoy" dice en gris "Empata con 2 opciones más". Filtros "Todas / Billeteras virtuales / Bancos" con su cantidad. **En 1920x1080 entran las 6 primeras tarjetas sin scroll.**
6. **Detalle.** Hay un solo desglose por banco, sin panel aparte que repita la información. Tocar la mejor opción o una tarjeta lo abre en una hoja que sube desde abajo en el celular y en una ventana centrada de 880px en escritorio, así la grilla no se desarma. Cada nivel de reintegro es una sección ("30% de reintegro · 4 opciones") y cada comercio es una fila que muestra su medio de pago y tope, y se expande con cómo pagar, días, vigencia, niveles de cuenta y el enlace a las bases (en escritorio, los datos cortos van de a dos columnas). Si un nivel tiene más de 5 comercios, se muestran 5 y un botón "Mostrar N más".
7. **Sin promociones.** Un mensaje amable y la lista de los días en que sus tarjetas sí tienen descuento en ese rubro; tocar un día salta a ese día.
8. **Mi billetera.** Arriba, "¿Cómo podés pagar?" con tres opciones tildables (QR o app, tarjeta de plástico, celular Android con NFC): el motor no recomienda lo que la persona no puede pagar. Si todavía no respondió y hoy hay un descuento mejor con NFC, debajo de la mejor opción aparece "¿Tu celular es Android con NFC?" con "Sí, tengo NFC" y "No, o no sé". Después, un sheet con buscador y contador de elegidos fijos arriba, grupos colapsables "Billeteras virtuales" y "Bancos" (cada uno con "N de M elegidos"), marcas de verificación a la derecha como en Ajustes de iOS y "Guardar" fijo al pie. Todos los bancos y billeteras se muestran con el mismo componente, `BankBadge` (logo oficial o, si falta, siglas sobre su color, con la misma forma).

## Responsive (prioridad: celular)

| Ancho | Dispositivo de referencia | Cómo se ve |
| :-- | :-- | :-- |
| < 640px | Celular (360 a 430) | La fecha es el botón para elegir día; rubros como 4 botones bajo el título; la mejor opción con una franja menta arriba (banco a la izquierda, porcentaje grande a la derecha) y el botón a todo el ancho abajo; tarjetas en 1 columna; detalle en hoja desde abajo. |
| 640 a 799px | iPad mini vertical | Porcentaje como columna a la izquierda y el botón debajo de los datos; "Ver otro día" como botón aparte. |
| ≥ 768px (`md`) | | Rubros pasan a la barra; tarjetas en 2 columnas. |
| ≥ 800px (`ipad`) | iPad Air / Pro 11" vertical (820) | La mejor opción como franja horizontal con el botón a la derecha. |
| ≥ 1100px (`tab`) | iPad horizontal (1180), iPad Pro M4 13" horizontal (1376), notebooks | Tarjetas en 3 columnas; título y filtros en la misma fila; pie en dos columnas. El M4 vertical (1032) queda en 2 columnas. |
| Ancho ≥ 1024 y alto ≤ 760 (`bajo`) | Notebook 1366x600 | Menos aire vertical arriba y título más chico, para que la mejor opción y la primera fila de tarjetas entren sin scroll. |

Los breakpoints propios (`ipad`, `tab`) y la variante `bajo` están en `globals.css`; se escriben en rem para que Tailwind los ordene bien.

**Celular, reglas de texto:** ningún texto cortado con "…" en las pantallas principales; en las tarjetas el comercio va con su nombre corto (`nombreCorto`: hasta la primera coma) y el completo queda en el detalle. Mi billetera: descripción de una línea, sin contador junto al buscador (lo dice "Guardar N medios de pago"), "¿Cómo pagás?" con opciones de título corto. Rubros: grilla de fichas (ícono arriba, nombre abajo; 2 columnas en celular, 3 en pantallas grandes), sin descripciones. Detalle: sin el ícono circular repetido. Pie: en celular solo los títulos de los tres datos. Tutorial ("Hay más lugares con descuento"): en celular es una tarjeta fija abajo con dos botones lado a lado, el botón iluminado queda a un tercio de la pantalla y también se puede tocar.

## Un solo scroll

Un único scroll de página, con la barra estándar del navegador, en celular y escritorio (contenido de hasta 1280px de ancho). No hay contenedores con scroll propio fuera de los modales. Los modales sí scrollean por dentro, con el título y el buscador fijos arriba y la acción ("Guardar", "Cerrar") fija abajo. `scrollbar-gutter: stable` evita saltos al abrirlos.

## Jerarquía de texto

Un solo énfasis por línea. En las tarjetas, el porcentaje es el único dato grande; el nombre es el título; dónde, cómo pagar y tope van todos en el mismo tono y tamaño secundario (16px, gris). El medio de pago con MODO se distingue solo por el color de su ícono.

## Medio de pago siempre a la vista

Mucha gente no abre los acordeones. Toda promo (tarjeta principal, filas y opciones del detalle) muestra sin desplegar nada una línea con **cómo se paga**: la forma (NFC, QR, QR MODO, Clave DNI, transferencia, online o tarjeta) y con qué dinero (crédito, débito, dinero en cuenta o prepaga). Por ejemplo, "NFC · Crédito" o "QR o Clave DNI · Dinero en cuenta". Es lo que distingue dos opciones del mismo comercio. Se calcula con `metodoPago()` en `src/components/format.ts`. La primera opción del detalle, la de mayor reintegro, se muestra abierta.

## Reglas que no se negocian

- **Filtro estricto de billetera:** nunca se muestra un medio que la persona no eligió. La excepción de MODO para bancos adheridos ya viene resuelta en `page.tsx`.
- Toda recomendación sale de `findBestPromos` (`src/logic/engine.ts`). La UI no filtra ni ordena promociones.
- Texto de 16px como mínimo, áreas táctiles de 48px como mínimo (56px en las acciones principales) y contraste AA.
- Todo ícono va acompañado de texto; el cierre de un sheet es un botón "Cerrar" con texto, no una X sola.
- No se tocan `src/data/**` ni `src/logic/**`.

## Referencias

Apple Wallet (tarjeta y detalle de un movimiento), Ajustes de iOS (listas agrupadas y marcas de verificación), la app Apple Store, Things 3 (calma y jerarquía), y Monzo y N26 en modo claro (claridad para mostrar plata).

## Vara de calidad

Que parezca una app nativa de Apple diseñada para adultos mayores: los números se leen a un brazo de distancia, nada se mueve sin motivo y ninguna pantalla obliga a buscar. Cada píxel es deliberado y cada animación tiene una razón.
