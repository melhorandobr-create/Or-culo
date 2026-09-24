import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import LoginScreen from "../screens/LoginScreen";
import DashboardScreen from "../screens/DashboardScreen";
import IntelligenceScreen from "../screens/IntelligenceScreen";
import TerritorialMapScreen from "../screens/TerritorialMapScreen";
import SecurityCenterScreen from "../screens/SecurityCenterScreen";
import ReportDetailScreen from "../screens/ReportDetailScreen";
import ActivationCodesScreen from "../screens/ActivationCodesScreen";
import AccessRequestsScreen from "../screens/AccessRequestsScreen";
import PublicSourcesScreen from "../screens/PublicSourcesScreen";

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

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
      <Tab.Screen name="Dashboard" component={DashboardScreen} options={{ title: "Início" }} />
      <Tab.Screen name="Intelligence" component={IntelligenceScreen} options={{ title: "Inteligência" }} />
      <Tab.Screen name="TerritorialMap" component={TerritorialMapScreen} options={{ title: "Mapa" }} />
      <Tab.Screen name="SecurityCenter" component={SecurityCenterScreen} options={{ title: "Segurança" }} />
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
            <Stack.Screen name="ReportDetail" component={ReportDetailScreen} />
            <Stack.Screen name="ActivationCodes" component={ActivationCodesScreen} />
            <Stack.Screen name="AccessRequests" component={AccessRequestsScreen} />
            <Stack.Screen name="PublicSources" component={PublicSourcesScreen} />
          </>
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
