import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Platform } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import MapView, { UrlTile, Marker, PROVIDER_DEFAULT } from "react-native-maps";
import { useTheme } from "../contexts/ThemeContext";
import { Theme } from "../theme";
import { api, Report, ApiError } from "../api/client";
import { STRATEGIC_SITES, STRATEGIC_KIND_META } from "../constants/strategicSites";

// Região inicial: Bahia (mesma área usada nos mockups aprovados). O usuário
// pode dar zoom out livremente pro Brasil inteiro / mundo.
const INITIAL_REGION = {
  latitude: -12.5,
  longitude: -41.7,
  latitudeDelta: 8,
  longitudeDelta: 8,
};

type Layer = "cases" | "sources" | "flights" | "strategic";

export default function TerritorialMapScreen() {
  const theme = useTheme();
  const { color } = theme;
  const styles = useMemo(() => buildStyles(theme), [theme]);
  const navigation = useNavigation<any>();

  const [layer, setLayer] = useState<Layer>("cases");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [flights, setFlights] = useState<any[]>([]);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await api.listReports();
      // Confirmado em routes/reports.js: coordenadas vêm como
      // operationLatitude/operationLongitude, nunca lat/lng.
      setReports((res.reports || []).filter((r) => r.operationLatitude != null && r.operationLongitude != null));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Sem conexão com o servidor.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const loadFlights = useCallback(async () => {
    try {
      const res = await api.getFlights({ lamin: -20, lomin: -48, lamax: -6.5, lomax: -35 });
      setFlights(res.flights || []);
    } catch {
      setFlights([]);
    }
  }, []);

  useEffect(() => {
    if (layer === "flights") loadFlights();
  }, [layer, loadFlights]);

  return (
    <View style={styles.container}>
      <MapView
        style={StyleSheet.absoluteFill}
        provider={PROVIDER_DEFAULT}
        initialRegion={INITIAL_REGION}
        mapType={Platform.OS === "android" ? "none" : "standard"}
      >
        {Platform.OS === "android" && (
          <UrlTile
            urlTemplate="https://a.tile.opentopomap.org/{z}/{x}/{y}.png"
            maximumZ={17}
            flipY={false}
          />
        )}

        {layer === "cases" &&
          reports.map((r) => (
            <Marker
              key={r.id}
              coordinate={{ latitude: r.operationLatitude as number, longitude: r.operationLongitude as number }}
              pinColor={r.classification === "SECRETO" ? color.danger : color.primary}
              title={r.title || r.displayName}
              onPress={() => navigation.navigate("ReportDetail", { reportId: r.id })}
            />
          ))}

        {layer === "flights" &&
          flights.map((f: any) => (
            <Marker
              key={f.icao24}
              coordinate={{ latitude: f.latitude, longitude: f.longitude }}
              title={f.callsign}
              description={`${f.baro_altitude ?? "?"} m · ${f.velocity ?? "?"} m/s`}
              rotation={f.true_track ?? 0}
              flat
            >
              <Ionicons name="airplane" size={18} color="#0F2A4D" />
            </Marker>
          ))}

        {layer === "strategic" &&
          STRATEGIC_SITES.map((s) => {
            const meta = STRATEGIC_KIND_META[s.kind];
            return (
              <Marker
                key={s.id}
                coordinate={{ latitude: s.latitude, longitude: s.longitude }}
                title={s.name}
                description={s.description}
              >
                <View style={[styles.strategicPin, { backgroundColor: meta.color }]}>
                  <Ionicons name={meta.icon as any} size={13} color="#fff" />
                </View>
              </Marker>
            );
          })}
      </MapView>

      {/* Header sobreposto */}
      <View style={styles.headerOverlay}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => navigation.goBack()} style={styles.iconButton}>
            <Ionicons name="chevron-back" size={18} color={color.text} />
          </Pressable>
          <View style={styles.searchBox}>
            <Ionicons name="search" size={16} color={color.textFaint} />
            <Text style={styles.searchPlaceholder}>Buscar local ou caso</Text>
          </View>
        </View>

        <View style={styles.layerRow}>
          <LayerChip theme={theme} active={layer === "cases"} label="Casos ativos" onPress={() => setLayer("cases")} />
          <LayerChip theme={theme} active={layer === "sources"} label="Fontes monitoradas" onPress={() => setLayer("sources")} />
          <LayerChip theme={theme} active={layer === "flights"} label="Voos ao vivo" icon="airplane" onPress={() => setLayer("flights")} />
          <LayerChip theme={theme} active={layer === "strategic"} label="Infraestrutura estratégica" icon="business" onPress={() => setLayer("strategic")} />
        </View>
      </View>

      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator color={color.primary} />
        </View>
      )}

      {/* Painel inferior */}
      <View style={styles.bottomSheet}>
        <View style={styles.grabber} />
        {layer === "cases" ? (
          <>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Acervo de casos no mapa</Text>
              <Text style={styles.sheetCount}>{reports.length} casos</Text>
            </View>
            {reports.length === 0 ? (
              <Text style={styles.emptyText}>Nenhum caso georreferenciado ainda.</Text>
            ) : (
              reports.slice(0, 6).map((r: any) => (
                <Pressable key={r.id} style={styles.caseRow} onPress={() => navigation.navigate("ReportDetail", { reportId: r.id })}>
                  <View style={[styles.dot, { backgroundColor: r.classification === "SECRETO" ? color.danger : color.primary }]} />
                  <Text style={styles.caseRowTitle} numberOfLines={1}>{r.title || r.displayName}</Text>
                  <Ionicons name="chevron-forward" size={14} color={color.textFaint} />
                </Pressable>
              ))
            )}
          </>
        ) : layer === "flights" ? (
          <>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Cobertura de voo</Text>
            </View>
            <Text style={styles.sourceCaption}>fonte: OpenSky Network, via /public-data/flights</Text>
            {flights.length === 0 ? (
              <Text style={styles.emptyText}>Nenhuma aeronave na área no momento.</Text>
            ) : (
              flights.slice(0, 6).map((f: any) => (
                <View key={f.icao24} style={styles.flightRow}>
                  <Text style={styles.flightCallsign}>{f.callsign || f.icao24}</Text>
                  <Text style={styles.flightMeta}>{f.origin_country}</Text>
                </View>
              ))
            )}
          </>
        ) : layer === "strategic" ? (
          <>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Infraestrutura estratégica</Text>
              <Text style={styles.sheetCount}>{STRATEGIC_SITES.length} locais</Text>
            </View>
            <Text style={styles.sourceCaption}>informação pública — INB, usinas nucleares, hidrelétricas, base de lançamento</Text>
            {STRATEGIC_SITES.map((s) => {
              const meta = STRATEGIC_KIND_META[s.kind];
              return (
                <View key={s.id} style={styles.caseRow}>
                  <View style={[styles.dot, { backgroundColor: meta.color }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.caseRowTitle} numberOfLines={1}>{s.name}</Text>
                    <Text style={styles.flightMeta}>{meta.label} · {s.state}</Text>
                  </View>
                </View>
              );
            })}
          </>
        ) : (
          <Text style={styles.emptyText}>Selecione um monitoramento pra ver detalhes.</Text>
        )}
      </View>
    </View>
  );
}

function LayerChip({
  theme,
  active,
  label,
  icon,
  onPress,
}: {
  theme: Theme;
  active: boolean;
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
}) {
  const { color, radius } = theme;
  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        borderRadius: radius.pill,
        paddingVertical: 7,
        paddingHorizontal: 12,
        backgroundColor: active ? color.primary : "rgba(255,255,255,0.94)",
      }}
    >
      {icon && <Ionicons name={icon} size={12} color={active ? "#fff" : color.text} />}
      <Text style={{ fontSize: 12, fontWeight: "600", color: active ? "#fff" : "#344054" }}>{label}</Text>
    </Pressable>
  );
}

function buildStyles(theme: Theme) {
  const { color, space, radius } = theme;
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: "#0B1E33" },
    headerOverlay: { position: "absolute", top: 44, left: 0, right: 0, paddingHorizontal: space.xl },
    headerRow: { flexDirection: "row", alignItems: "center", gap: 10 },
    iconButton: { width: 34, height: 34, borderRadius: 11, backgroundColor: color.surface, alignItems: "center", justifyContent: "center", ...theme.shadow.card },
    searchBox: { flex: 1, backgroundColor: color.surface, borderRadius: radius.xl, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 10, ...theme.shadow.card },
    searchPlaceholder: { fontSize: 13.5, color: color.textFaint },
    layerRow: { flexDirection: "row", gap: 8, marginTop: 12 },
    errorBanner: { position: "absolute", top: 110, left: space.xl, right: space.xl, backgroundColor: color.dangerTint, borderRadius: radius.md, padding: 10 },
    errorText: { color: color.danger, fontSize: 12 },
    loadingOverlay: { position: "absolute", top: 0, bottom: 0, left: 0, right: 0, alignItems: "center", justifyContent: "center" },
    bottomSheet: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: color.surface,
      borderTopLeftRadius: 22,
      borderTopRightRadius: 22,
      paddingHorizontal: space.xl,
      paddingTop: 12,
      paddingBottom: 24,
      maxHeight: 320,
    },
    grabber: { width: 36, height: 4, backgroundColor: color.border, borderRadius: 2, alignSelf: "center", marginBottom: 14 },
    sheetHeader: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginBottom: 12 },
    sheetTitle: { fontSize: 16, fontWeight: "700", color: color.text, letterSpacing: -0.2 },
    sheetCount: { fontSize: 12, color: color.textFaint },
    emptyText: { fontSize: 13, color: color.textFaint, paddingVertical: 12 },
    caseRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 11, borderRadius: 12, backgroundColor: color.bg, paddingHorizontal: 11, marginBottom: 10 },
    dot: { width: 10, height: 10, borderRadius: 5 },
    caseRowTitle: { flex: 1, fontSize: 13, fontWeight: "600", color: color.text },
    sourceCaption: { fontSize: 11, color: color.textFaint, marginBottom: 10 },
    flightRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#F2F4F7" },
    flightCallsign: { fontSize: 13, fontWeight: "700", color: color.text },
    flightMeta: { fontSize: 11.5, color: color.textFaint },
    strategicPin: {
      width: 26,
      height: 26,
      borderRadius: 13,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 2,
      borderColor: "#fff",
    },
  });
}
