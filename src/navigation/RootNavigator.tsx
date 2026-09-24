import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import LoginScreen from "../screens/LoginScreen";
import PlaceholderScreen from "../screens/PlaceholderScreen";

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// Abas principais. Nomes batem com o inventário de telas extraído do bundle
// original (DashboardScreen, ReportDetailScreen, PublicSourcesScreen,
// TerritorialMapScreen, SecurityCenterScreen, ActivationCodesScreen,
// AccessRequestsScreen) — cada uma trocada de Placeholder pra implementação
// real conforme reconstruída (ver tarefas #4-#7 no plano).
function TabsScreen() {
  const { color } = useTheme();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: color.primary,
        tabBarInactiveTintColor: color.textFaint,
        tabBarIcon: ({ color: iconColor, size }) => {
          const icons: Record<string, keyof typeof Ionicons.glyphMap> = {
            Dashboard: "grid-outline",
            Intelligence: "search-outline",
            TerritorialMap: "map-outline",
            SecurityCenter: "shield-checkmark-outline",
          };
          return (
            <Ionicons name={icons[route.name] ?? "ellipse-outline"} size={size} color={iconColor} />
          );
        },
      })}
    >
      <Tab.Screen name="Dashboard" component={PlaceholderScreen} />
      <Tab.Screen name="Intelligence" component={PlaceholderScreen} />
      <Tab.Screen name="TerritorialMap" component={PlaceholderScreen} options={{ title: "Mapa" }} />
      <Tab.Screen name="SecurityCenter" component={PlaceholderScreen} options={{ title: "Segurança" }} />
    </Tab.Navigator>
  );
}

export default function RootNavigator() {
  const { isLoggedIn } = useAuth();

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {isLoggedIn ? (
          <>
            <Stack.Screen name="Tabs" component={TabsScreen} />
            <Stack.Screen name="ReportDetail" component={PlaceholderScreen} />
            <Stack.Screen name="ActivationCodes" component={PlaceholderScreen} />
            <Stack.Screen name="AccessRequests" component={PlaceholderScreen} />
            <Stack.Screen name="PublicSources" component={PlaceholderScreen} />
          </>
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
