---
name: pagamejor-governance
description: Guía y directrices de gobernanza de agentes, principios inmutables de producto y protocolo de trabajo en PagaMejor.
---

# Gobernanza y Protocolo Multi-Agente: PagaMejor

Esta skill contiene las directrices para operar el sistema multi-agente en el proyecto PagaMejor.

## 1. Principios de Oro de Producto
1. **Filtro Estricto de Billetera**: Jamás recomendar una promoción de un medio de pago que el usuario no seleccionó.
2. **Cero IA en Runtime**: Toda recomendación se basa en un algoritmo determinístico local en el cliente.
3. **Diseño para Adultos Mayores**: Tipografía grande (18px+ en cuerpo), colores cálidos descansados, zonas táctiles amplias (48px+), cero animaciones bruscas.
4. **Respeto a los Dominios**: Cada agente solo modifica los archivos bajo su responsabilidad.

## 2. Flujo de Trabajo para Nuevas Funcionalidades
1. El usuario solicita una tarea al **Orquestador**.
2. El Orquestador analiza a qué agente corresponde:
   - ¿Afecta datos o bancos? -> Asigna a `data-agent`.
   - ¿Afecta algoritmo de cálculo o localStorage? -> Asigna a `logic-agent`.
   - ¿Afecta interfaz o estilos? -> Asigna a `frontend-agent`.
   - ¿Afecta monitoreo de sitios externos? -> Asigna a `monitor-agent`.
3. Ningún agente debe realizar cambios cruzados fuera de su frontera.
