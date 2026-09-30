import React, { useEffect } from "react";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "./src/contexts/AuthContext";
import { ThemeProvider } from "./src/contexts/ThemeContext";
import { CasesProvider } from "./src/contexts/CasesContext";
import RootNavigator from "./src/navigation/RootNavigator";
import { initNetworkMode } from "./src/api/client";
// Registra a task de geofencing no carregamento do módulo — precisa
// existir antes de qualquer tela, pro SO conseguir chamar de volta mesmo
// depois do app reiniciar em segundo plano.
import "./src/services/geofencing";

export default function App() {
  useEffect(() => {
    initNetworkMode();
  }, []);

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
