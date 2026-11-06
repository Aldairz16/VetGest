import { useEffect, useState } from 'react'
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ApiError } from '@/lib/api'
import { AuthProvider, useAuth } from '@/lib/auth'
import { View } from 'react-native'
import { Loading, ServerWakeBanner } from '@/components/ui'
import { useTheme } from '@/theme'

void SplashScreen.preventAutoHideAsync().catch(() => undefined)

function makeClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 15_000,
        // No reintentar errores del cliente (401/403/404/409/422): mostrar el mensaje de una vez.
        retry: (count, error) => !(error instanceof ApiError && error.status >= 400 && error.status < 500) && count < 2,
      },
    },
  })
}

function RootNavigator() {
  const { status } = useAuth()
  const theme = useTheme()
  // La pantalla de arranque se oculta enseguida: si la API está dormida, se ve «Despertando el servidor…».
  useEffect(() => { void SplashScreen.hideAsync().catch(() => undefined) }, [])
  if (status === 'loading') return <View style={{ flex: 1, justifyContent: 'center', backgroundColor: theme.background }}><Loading label="Abriendo VetGest…" /></View>
  const signedIn = status === 'signedIn'
  const navTheme = theme.scheme === 'dark' ? DarkTheme : DefaultTheme
  return <ThemeProvider value={{ ...navTheme, colors: { ...navTheme.colors, primary: theme.primary, background: theme.background, card: theme.card, text: theme.text, border: theme.border } }}>
    <StatusBar style={theme.scheme === 'dark' ? 'light' : 'dark'} />
    <Stack screenOptions={{
      headerStyle: { backgroundColor: theme.card }, headerTintColor: theme.primary, headerTitleStyle: { color: theme.text },
      headerBackButtonDisplayMode: 'minimal', contentStyle: { backgroundColor: theme.background },
    }}>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="ingresar" options={{ headerShown: false, title: 'Ingresar' }} />
        <Stack.Screen name="registro" options={{ title: 'Crear cuenta' }} />
      </Stack.Protected>
      <Stack.Protected guard={signedIn}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="mascotas/nueva" options={{ title: 'Nueva mascota' }} />
        <Stack.Screen name="mascotas/[id]/index" options={{ title: 'Mascota' }} />
        <Stack.Screen name="mascotas/[id]/editar" options={{ title: 'Editar mascota' }} />
        <Stack.Screen name="veterinarias" options={{ title: 'Veterinarias' }} />
        <Stack.Screen name="veterinaria/[id]" options={{ title: 'Veterinaria' }} />
        <Stack.Screen name="citas/nueva" options={{ title: 'Pedir turno' }} />
        <Stack.Screen name="citas/[id]" options={{ title: 'Tu turno' }} />
      </Stack.Protected>
    </Stack>
    <ServerWakeBanner />
  </ThemeProvider>
}

export default function RootLayout() {
  const [client] = useState(makeClient)
  return <SafeAreaProvider>
    <QueryClientProvider client={client}>
      <AuthProvider><RootNavigator /></AuthProvider>
    </QueryClientProvider>
  </SafeAreaProvider>
}
