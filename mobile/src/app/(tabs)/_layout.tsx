import { Tabs } from 'expo-router/js-tabs'
import type { ColorValue } from 'react-native'
import { Icon, type IconName } from '@/components/Icon'
import { useTheme } from '@/theme'

const tab = (title: string, icon: IconName, label = title) => ({
  title,
  tabBarAccessibilityLabel: label,
  tabBarIcon: ({ color }: { color: ColorValue }) => <Icon name={icon} color={color} size={24} />,
})

export default function TabsLayout() {
  const theme = useTheme()
  // Máximo 4 pestañas (design-system/vetgest/pages/app-propietario.md). «Pedir turno» es un botón, no una pestaña.
  return <Tabs screenOptions={{
    tabBarActiveTintColor: theme.primary,
    tabBarInactiveTintColor: theme.textSecondary,
    tabBarStyle: { backgroundColor: theme.card, borderTopColor: theme.border },
    tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
    tabBarItemStyle: { minHeight: 48 },
    headerStyle: { backgroundColor: theme.card },
    headerTitleStyle: { color: theme.text },
    headerTintColor: theme.primary,
    sceneStyle: { backgroundColor: theme.background },
  }}>
    <Tabs.Screen name="index" options={tab('Inicio', 'home')} />
    <Tabs.Screen name="citas" options={tab('Citas', 'calendar', 'Mis citas')} />
    <Tabs.Screen name="mascotas" options={tab('Mascotas', 'pets', 'Mis mascotas')} />
    <Tabs.Screen name="perfil" options={tab('Perfil', 'person', 'Mi perfil')} />
  </Tabs>
}
