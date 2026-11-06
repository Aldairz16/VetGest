import { useState } from 'react'
import { View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Icon } from '@/components/Icon'
import { Button, Card, ErrorState, Field, Notice, Screen, T } from '@/components/ui'
import { useAuth } from '@/lib/auth'
import { loginSchema, validate, type FieldErrors, type LoginValues } from '@/lib/schemas'
import { space, useTheme } from '@/theme'
import { group } from '@/lib/a11y'

export default function Login() {
  const { signIn, notice } = useAuth()
  const theme = useTheme()
  const insets = useSafeAreaInsets()
  const params = useLocalSearchParams<{ registrado?: string }>()
  const [values, setValues] = useState<LoginValues>({ email: '', password: '' })
  const [errors, setErrors] = useState<FieldErrors<LoginValues>>({})
  const [error, setError] = useState<unknown>(null)
  const [pending, setPending] = useState(false)
  const set = (key: keyof LoginValues) => (text: string) => setValues(v => ({ ...v, [key]: text }))

  async function submit() {
    setError(null)
    const result = validate(loginSchema, values)
    if (!result.ok) { setErrors(result.errors); return }
    setErrors({})
    setPending(true)
    // 403 para personal: el backend responde «La app es para propietarios…» y se muestra tal cual.
    try { await signIn(result.data) } catch (e) { setError(e) } finally { setPending(false) }
  }

  return <Screen>
    <View style={{ paddingTop: insets.top + space.lg, gap: space.xl }}>
      <View style={{ gap: space.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }} {...group('VetGest')}>
          <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: theme.accent, alignItems: 'center', justifyContent: 'center' }}><Icon name="pets" size={24} color={theme.onAccent} /></View>
          <T variant="heading" color={theme.primary}>VetGest</T>
        </View>
        <T variant="eyebrow">Bienvenido a su nuevo espacio</T>
        <T variant="title">Qué bueno verte de nuevo.</T>
        <T variant="muted">Tus compañeros y sus próximos cuidados te esperan.</T>
      </View>
      {params.registrado === '1' && <Notice>Tu cuenta está lista. Inicia sesión para registrar a tu mascota.</Notice>}
      {notice && !error && <Notice tone="info">{notice}</Notice>}
      <Card style={{ gap: space.lg }}>
        <Field label="Correo electrónico" value={values.email} onChangeText={set('email')} error={errors.email}
          placeholder="nombre@correo.com" keyboardType="email-address" autoCapitalize="none" autoComplete="email" textContentType="emailAddress" autoCorrect={false} returnKeyType="next" />
        <Field label="Contraseña" value={values.password} onChangeText={set('password')} error={errors.password}
          secureTextEntry autoComplete="current-password" textContentType="password" returnKeyType="go" onSubmitEditing={() => void submit()} />
        {!!error && <ErrorState error={error} />}
        <Button label="Iniciar sesión" onPress={() => void submit()} loading={pending} loadingLabel="Iniciando sesión…" />
      </Card>
      <View style={{ alignItems: 'center', gap: space.xs }}>
        <T variant="muted">¿Es tu primera visita?</T>
        <Button label="Crea tu cuenta" variant="ghost" onPress={() => router.push('/registro')} />
      </View>
      <T variant="small" style={{ textAlign: 'center' }}>La app es para propietarios de mascotas. El personal de las veterinarias entra desde la web.</T>
    </View>
  </Screen>
}
