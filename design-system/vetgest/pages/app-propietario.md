# App del propietario (Expo) y vistas de propietario en la web

Manda sobre MASTER para `mobile/` y para Inicio/Citas/Mascotas del propietario en la web.

## Navegación

Pestañas inferiores (máximo 4): **Inicio · Citas · Mascotas · Perfil**. Botón de acción principal «Pedir turno» en Inicio y en Citas (no una pestaña). Atrás predecible; enlaces profundos a una cita (`/citas/{id}`).

## Inicio: «qué pasa con mi mascota»

Orden fijo, de lo urgente a lo útil:
1. **Próxima cita** (tarjeta grande): mascota, servicio, día y hora, veterinaria, línea de 5 pasos con el estado actual y su texto para el propietario (MASTER §3). Si está en sala de espera o en consulta, la tarjeta pasa a primer plano con refresco cada 30 s.
2. **Recordatorios**: vencidos primero (rojo + `TriangleAlert`), luego próximos 30 días. Cada uno con botón **«Agendar»** que abre la reserva con mascota y veterinaria preseleccionadas y el servicio sugerido (Vacunación, Desparasitación o Control). Es la palanca de retorno: no lo escondas.
3. **Mis mascotas** en fila horizontal con acceso a su historia.
Vacío: «Agrega a tu mascota para pedir su primer turno».

## Pedir turno: ≤ 4 pasos con progreso «Paso X de 4»

1. **Mascota** (preseleccionada si hay una sola o viene de un recordatorio).
2. **Veterinaria y servicio**: tarjetas con **precio y duración visibles** («Consulta general · 30 min · S/ 65»). Recordar la última veterinaria usada.
3. **Día y hora**: tira de 14 días (cerrados deshabilitados con texto «Cerrado»), turnos en rejilla de botones ≥ 44 px; ocupados deshabilitados y tachados con lector «no disponible». Atajo **«Primer turno libre»**.
4. **Resumen y motivo** (opcional, ayuda: «¿Qué le pasa? Ayuda a preparar la consulta») → «Solicitar turno».
Después: pantalla de éxito con la cita en estado **Por confirmar** y el texto «La veterinaria confirmará tu turno. Revisa su estado aquí». Si el servidor responde 409: «Ese horario se acaba de ocupar» y volver al paso 3 con los turnos recargados, sin perder lo demás.

## Mis citas

Segmentos **Próximas / Anteriores**. Cada fila: estado (badge), fecha relativa, mascota, servicio, veterinaria y, si está atendida, «Pagado S/ X · método» o «Pago en la veterinaria». Cancelar solo si está Por confirmar o Confirmada y no llegó; hoja de confirmación: «¿Cancelar el turno de Luna del jue 12 a las 10:00? El horario quedará libre para otra mascota». Botón destructivo «Cancelar turno» y secundario «Mantener».

## Mascota

Cabecera con especie (icono), edad calculada y peso. Pestañas **Historia · Vacunas y cuidados**. Vacunas como carnet: nombre, fecha, próxima dosis con estado (Al día / Por vencer / Vencida). Alergias o notas importantes arriba, en `danger`.

## Específico de la app

- `Pressable` con feedback (opacidad o ripple), `hitSlop` en iconos, `SafeAreaView` en cabecera, pestañas y botón inferior fijo.
- Texto dinámico: nada se corta con la letra más grande; listas con `FlatList`.
- Modo oscuro con los tokens de MASTER §2, probado aparte.
- Primer arranque: API dormida de Render puede tardar ~1 min → mostrar «Despertando el servidor…» en vez de un error genérico.
