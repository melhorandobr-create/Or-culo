import React, { useEffect } from "react";
import { View, ActivityIndicator, Text } from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useFonts, NotoSans_400Regular, NotoSans_500Medium, NotoSans_600SemiBold, NotoSans_700Bold } from "@expo-google-fonts/noto-sans";
import { AuthProvider } from "./src/contexts/AuthContext";
import { ThemeProvider } from "./src/contexts/ThemeContext";
import { CasesProvider } from "./src/contexts/CasesContext";
import RootNavigator from "./src/navigation/RootNavigator";
import { initNetworkMode } from "./src/api/client";
import { OraculoWordmark } from "./src/components/OraculoLogo";
// Registra a task de geofencing no carregamento do módulo — precisa
// existir antes de qualquer tela, pro SO conseguir chamar de volta mesmo
// depois do app reiniciar em segundo plano.
import "./src/services/geofencing";

export default function App() {
  const [fontsLoaded] = useFonts({ NotoSans_400Regular, NotoSans_500Medium, NotoSans_600SemiBold, NotoSans_700Bold });

  useEffect(() => {
    initNetworkMode();
  }, []);

  useEffect(() => {
    // Aplica Noto Sans (tipografia oficial do gov.br Design System) como
    // fonte padrão em todo texto do app, sem precisar editar tela por
    // tela — mais próximo da identidade de portal institucional do que
    // da fonte de sistema genérica usada antes.
    if (fontsLoaded) {
      (Text as any).defaultProps = (Text as any).defaultProps || {};
      (Text as any).defaultProps.style = [{ fontFamily: "NotoSans_400Regular" }, (Text as any).defaultProps.style];
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#F5F6F7", gap: 20 }}>
        <OraculoWordmark size={44} textSize={22} />
        <ActivityIndicator color="#1351B4" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <CasesProvider>
            <StatusBar style="dark" />
            <RootNavigator />
          </CasesProvider>
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
