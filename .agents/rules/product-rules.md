# Regla: Principios de Producto y Determinismo

Toda funcionalidad desarrollada para PagaMejor debe acatar de forma estricta los siguientes mandatos:

---

### 1. Filtro Estricto de Billetera (Regla No Negociable)

- La aplicación responde a la pregunta del usuario: *"¿Con qué me conviene pagar hoy?"* considerando **únicamente** los bancos, billeteras y tarjetas que el usuario marcó en su perfil ("Mi Billetera").
- **Prohibido**: Mostrar promociones generales de bancos que el usuario no tiene (por ejemplo, nunca sugerir "con Banco Macro tendrías 35%" si el usuario solo tiene Galicia y Cuenta DNI).
- Si el usuario no tiene ninguna promoción aplicable para el rubro y día actual con sus medios de pago seleccionados:
  - Se debe comunicar de forma transparente, reconfortante y clara: *"No encontramos descuentos para hoy con tus tarjetas en este rubro. Podés pagar con tu medio habitual sin perderte ninguna promo."*
  - Opcionalmente, se pueden listar los días próximos en que sus tarjetas sí tienen descuento en ese rubro (ej. *"Tu tarjeta Galicia tiene 20% los jueves"*).

---

### 2. Cero Llamadas a Modelos de IA en Tiempo de Ejecución (Runtime)

- La aplicación final que corre en el navegador del usuario debe ser 100% determinística y autónoma:
  - Cero llamadas a OpenAI, Gemini, Claude, Groq o cualquier API de IA en el cliente o servidor en runtime.
  - La selección de la mejor opción se realiza a través de un algoritmo algorítmico determinístico en `logic-agent` que evalúa:
    1. Coincidencia de `bancoBilletera` con la lista de IDs guardados en `localStorage`.
    2. Coincidencia del día actual (`new Date().getDay()`) en `diasSemana`.
    3. Vigencia temporal (`vigenciaDesde <= hoy <= vigenciaHasta`).
    4. Coincidencia de rubro.
    5. Ordenamiento por mayor `porcentajeDescuento` y en caso de empate, por mayor `montoTope`.

---

### 3. Persistencia en el Navegador (Sin Login en V1)

- La configuración de "Mi Billetera" se almacena en `localStorage` bajo la clave `pagamejor_wallet`.
- Si `localStorage` está vacío, la app redirige o abre amigablemente el onboarding para que el usuario elija sus bancos en un solo paso.
- No hay base de datos de usuarios, sesiones ni contraseñas en V1.
