# PagaMejor (pagamejor.ar)

> **¿Con qué tarjeta o billetera virtual te conviene pagar hoy en Argentina para maximizar tu descuento bancario?**

PagaMejor es una Progressive Web App (PWA) de consulta rápida y accesible diseñada con especial cuidado en la legibilidad, contraste y calma visual para adultos mayores. 

---

## Principios Inmutables del Proyecto

1. **Filtro Estricto de Billetera**: NUNCA se sugiere un banco o tarjeta que el usuario no haya marcado previamente en *"Mi Billetera"*.
2. **Cero Inteligencia Artificial en Runtime**: El cálculo del mejor beneficio es 100% determinístico y corre en el navegador del usuario.
3. **Diseño para Adultos Mayores**: Tipografía generosa (18px+), blancos táctiles amplios (56px en botones), paleta cálida y sin animaciones distractoras.
4. **Privacidad Total**: Todo se almacena localmente en `localStorage`. No requiere registro ni login.

---

## Arquitectura de Agentes Especializados

Este proyecto se desarrolla mediante 4 agentes coordinados por un Orquestador:

- **`data-agent`**: Catálogo de promociones (`src/data/promos.json`), bancos y rubros. Mantiene el esquema y la consistencia.
- **`frontend-agent`**: Interfaz de usuario en Next.js, diseño accesible, estilos y componentes visuales.
- **`logic-agent`**: Motor determinístico de recomendación (`src/logic/engine.ts`), cruce con `localStorage` y tests unitarios.
- **`monitor-agent`**: Scripts de auditoría periódica de vigencias y términos bancarios (`scripts/monitors/**`).

---

## Comandos Disponibles

```bash
# Iniciar servidor de desarrollo
npm run dev

# Compilar para producción
npm run build

# Validar integridad y consistencia de datos (data-agent)
npm run validate-data

# Ejecutar pruebas unitarias determinísticas (logic-agent)
npm run test:logic

# Ejecutar auditoría periódica de vigencias (monitor-agent)
node scripts/monitors/check-promos.js
```