# Archivos de ejemplo para tests

## ejemplo-airbnb.ics
iCal real de un anuncio de Airbnb (datos de julio 2026 a julio 2027).
Sirve como caso de test del parser de §2.12.

Casos que cubre:
- 37 eventos `Reserved` (reservas) — todas con código `HM`+8 en el DESCRIPTION
- 3 eventos `Airbnb (Not available)` (bloqueos) — sin código ni teléfono
- El código de reserva viene **partido por el plegado de líneas** RFC 5545
  (`...de\r\n tails/HM...`). El parser DEBE desdoblar antes de extraer, o
  encuentra cero códigos sin lanzar error.

Resultado esperado del parseo correcto:
- 37 reservas con código válido
- 3 bloqueos separados
- cada reserva con sus 4 últimos dígitos de teléfono
