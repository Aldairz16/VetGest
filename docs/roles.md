# Perfiles y permisos

VetGest es una plataforma **multi-clínica**. El avance 2 (PDF) se tomó como referencia y se ajustó: los actores del diagrama de casos de uso se convirtieron en cinco perfiles con permisos verificados en el backend, no solo ocultos en la interfaz.

| Perfil | Cómo se crea | Qué puede hacer | Qué no puede hacer |
|---|---|---|---|
| **Propietario** | Registro público | Mascotas, solicitar/cancelar citas, ver historial clínico y recordatorios de sus mascotas, catálogo | Ver datos de otros propietarios o entrar al espacio de clínica |
| **Recepción** | Lo crea el administrador de su clínica | Agenda de su clínica: confirmar, asignar veterinario, reprogramar, cancelar, marcar inasistencia, notas internas; ver pacientes e historial | Registrar atenciones, vacunas o tratamientos; gestionar equipo o servicios |
| **Veterinario** | Lo crea el administrador de su clínica | Ver agenda (filtro «mis citas»), fichas e historial; registrar atenciones con vacunas, desparasitaciones y tratamientos | Cambiar estados de la agenda; gestionar equipo o servicios |
| **Administrador de clínica** | Lo crea el admin de plataforma al dar de alta la clínica (o otro admin de la clínica) | Todo lo de recepción y veterinario + equipo (altas, rol, desactivar), servicios (crear, editar, retirar) y datos públicos de la clínica | Modificar su propio rol o desactivarse (evita dejar la clínica sin administrador) |
| **Admin de plataforma** | Variable `BOOTSTRAP_ADMIN_*` al arrancar | Métricas globales, alta de clínicas con su primer administrador, suspender/reactivar clínicas | Ver historias clínicas o la agenda de una clínica |

## Reglas de negocio

- **Una clínica por cuenta de personal.** Simplifica permisos; una persona que trabaje en dos clínicas usa dos correos.
- **Contraseñas temporales.** Toda cuenta creada por un administrador debe cambiar su contraseña en el primer ingreso; la interfaz bloquea el resto hasta hacerlo. Cambiar la contraseña cierra las demás sesiones.
- **Acceso a pacientes.** Una clínica ve a una mascota desde que el propietario solicita una cita con ella o desde que la atiende. Ve **el historial completo** (todas las clínicas): es la continuidad de atención que justifica la plataforma (NG01, NG03). El propietario lo autoriza implícitamente al solicitar la cita; ver «Riesgos».
- **Ciclo de una cita:** `Pendiente → Confirmada → Atendida`; `Pendiente/Confirmada → Cancelada`; `Confirmada → No asistió` (solo después de la hora). `Atendida` solo se alcanza registrando la atención, así no hay citas «atendidas» sin historia clínica.
- **Historia clínica inmutable.** Atenciones y vacunas no se editan ni se borran; quedan firmadas por el veterinario y la clínica (trazabilidad). Una corrección se registra como nueva atención.
- **Recordatorios.** Se calculan a partir de la próxima dosis (vacunas, desparasitación, tratamiento), el próximo control de la última atención y las citas de los próximos 30 días. Una dosis más reciente del mismo producto reemplaza el recordatorio anterior.
- **Suspensión de clínica.** Cierra de inmediato las sesiones de su equipo y la oculta del catálogo; conserva el historial.
- **Servicios retirados** no se ofrecen, pero se mantienen en citas antiguas.

## Riesgos y pendientes

- **Consentimiento explícito** para compartir historial entre clínicas (hoy es implícito al reservar). Recomendado antes de producción real; requiere una tabla de consentimientos.
- **Recordatorios por correo/WhatsApp:** hoy se muestran en el panel del propietario. Enviar notificaciones requiere un proveedor externo y una tarea programada.
- **Atención sin cita (walk-in):** recepción no puede crear propietarios. Hoy el propietario debe registrarse y solicitar la cita (puede hacerlo en recepción desde su teléfono).
- **Disponibilidad de horarios:** la agenda no bloquea cruces de horario; recepción confirma o reprograma manualmente.
- **Recuperación de contraseña** por correo: pendiente (requiere proveedor de correo). Hoy un administrador puede desactivar y recrear la cuenta.
