# Reglas del proyecto

## Contexto general
Este proyecto usa Google Apps Script con HTMLService.
La prioridad es mejorar la interfaz visual sin romper la logica existente ni la compatibilidad con Apps Script.

## Reglas tecnicas
- Mantener compatibilidad con Google Apps Script HTMLService.
- No introducir build steps ni bundlers salvo que se pidan explicitamente.
- Preferir HTML, CSS y JavaScript vanilla.
- No reemplazar funciones existentes del lado servidor sin necesidad.
- No alterar la logica de negocio salvo instruccion explicita.
- Mantener separados, cuando corresponda, los bloques HTML, CSS y JavaScript.

## Reglas de UI
- Preferir Bootstrap 5 por CDN para mejoras visuales rapidas y consistentes.
- Preferir Bootstrap Icons por CDN para iconografia.
- Mejorar jerarquia visual, espaciado, densidad de informacion y legibilidad.
- Reducir espacio muerto en layouts.
- Usar grid responsive.
- Usar cards compactas, badges, paneles laterales, divisiones claras y botones con jerarquia visual.
- Cuando exista una seleccion de elementos, convertirla en un panel funcional con resumen y acciones.
- Evitar interfaces visualmente planas o excesivamente vacias.
- Mantener un estilo limpio, profesional y moderno, orientado a operacion.

## Reglas de diseno para esta app
- Priorizar paneles operativos mas que diseno decorativo.
- El layout debe sentirse eficiente para un flujo de laboratorio/registro.
- Las tarjetas deben compactar la informacion sin perder legibilidad.
- Las acciones principales deben ser evidentes.
- Los contenedores no deben dejar grandes areas vacias sin funcion.

## Que entregar cuando se solicite una mejora UI
- HTML refactorizado.
- CSS mejorado.
- Explicacion breve de la nueva estructura.
- No tocar backend si no es necesario.
