import React, { useMemo, useState } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useTheme } from "../contexts/ThemeContext";
import { Theme } from "../theme";
import { STRATEGIC_SITES, STRATEGIC_KIND_META } from "../constants/strategicSites";
import { useTerritorialMapData, MapLayer } from "../hooks/useTerritorialMapData";
import { clusterPoints } from "../utils/clusterPoints";

// react-native-maps não roda no navegador (é 100% nativo). Esta é a versão
// web do mesmo mapa territorial, usando Leaflet + tiles OpenStreetMap/
// OpenTopoMap (gratuitos, sem chave de API) em vez do Google Maps SDK.

function makeDivIcon(color: string, size = 22) {
  return L.divIcon({
    className: "",
    html: `<div style="width:${size}px;height:${size}px;border-radius:${size / 2}px;background:${color};border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.4)"></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

export default function TerritorialMapScreenWeb() {
  const theme = useTheme();
  const { color } = theme;
  const styles = useMemo(() => buildStyles(theme), [theme]);
  const navigation = useNavigation<any>();

  const [layer, setLayer] = useState<MapLayer>("cases");
  const { loading, error, reports, flights, flightsError, monitors, offline, cachedAt } = useTerritorialMapData(layer);

  const clusters = useMemo(
    () =>
      clusterPoints(
        reports.map((r) => ({ id: r.id, lat: r.operationLatitude as number, lng: r.operationLongitude as number }))
      ).filter((c) => c.items.length > 1),
    [reports]
  );

  const caseIcon = useMemo(() => makeDivIcon("#1B4B8F"), []);
  const secretIcon = useMemo(() => makeDivIcon("#D92D20"), []);
  const flightIcon = useMemo(
    () =>
      L.divIcon({
        className: "",
        html: `<div style="font-size:18px;transform:translate(-2px,-2px)">✈️</div>`,
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      }),
    []
  );

  return (
    <View style={styles.container}>
      <View style={StyleSheet.absoluteFill}>
        <MapContainer center={[-12.5, -41.7]} zoom={6} style={{ width: "100%", height: "100%" }}>
          <TileLayer
            attribution='&copy; OpenTopoMap, OpenStreetMap contributors'
            url="https://a.tile.opentopomap.org/{z}/{x}/{y}.png"
            maxZoom={17}
          />

          {layer === "cases" &&
            reports.map((r) => (
              <Marker
                key={r.id}
                position={[r.operationLatitude as number, r.operationLongitude as number]}
                icon={r.classification === "SECRETO" ? secretIcon : caseIcon}
                eventHandlers={{ click: () => navigation.navigate("ReportDetail", { reportId: r.id }) }}
              >
                <Popup>{r.title || r.displayName}</Popup>
              </Marker>
            ))}

          {layer === "flights" &&
            flights.map((f: any) => (
              <Marker key={f.icao24} position={[f.latitude, f.longitude]} icon={flightIcon}>
                <Popup>
                  {f.callsign || f.icao24}
                  <br />
                  {f.baro_altitude ?? "?"} m · {f.velocity ?? "?"} m/s
                </Popup>
              </Marker>
            ))}

          {layer === "strategic" &&
            STRATEGIC_SITES.map((s) => {
              const meta = STRATEGIC_KIND_META[s.kind];
              return (
                <Marker key={s.id} position={[s.latitude, s.longitude]} icon={makeDivIcon(meta.color)}>
                  <Popup>
                    <strong>{s.name}</strong>
                    <br />
                    {s.description}
                  </Popup>
                </Marker>
              );
            })}
        </MapContainer>
      </View>

      <View style={styles.headerOverlay} pointerEvents="box-none">
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

      {(error || offline) && (
        <View style={styles.errorBanner} pointerEvents="none">
          <Text style={styles.errorText}>
            {error || `Sem conexão — mostrando dados salvos ${cachedAt ? `de ${new Date(cachedAt).toLocaleString("pt-BR")}` : "localmente"}.`}
          </Text>
        </View>
      )}

      {loading && (
        <View style={styles.loadingOverlay} pointerEvents="none">
          <ActivityIndicator color={color.primary} />
        </View>
      )}

      <View style={styles.bottomSheet} pointerEvents="box-none">
        <View style={styles.grabber} />
        {layer === "cases" ? (
          <>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Acervo de casos no mapa</Text>
              <Text style={styles.sheetCount}>{reports.length} casos</Text>
            </View>
            {clusters.length > 0 && (
              <Text style={styles.sourceCaption}>
                {clusters.length} zona(s) de concentração — {clusters.map((c) => c.items.length).join(", ")} casos por zona
              </Text>
            )}
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
            {flightsError && <Text style={styles.errorText}>{flightsError}</Text>}
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
        ) : layer === "sources" ? (
          <>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Fontes monitoradas</Text>
              <Text style={styles.sheetCount}>{monitors.length} fontes</Text>
            </View>
            <Text style={styles.sourceCaption}>fontes não têm coordenada própria — exibidas só na lista</Text>
            {monitors.length === 0 ? (
              <Text style={styles.emptyText}>Nenhuma fonte monitorada ainda.</Text>
            ) : (
              monitors.slice(0, 8).map((m) => (
                <View key={m.id} style={styles.caseRow}>
                  <View style={[styles.dot, { backgroundColor: color.primary }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.caseRowTitle} numberOfLines={1}>{m.query}</Text>
                    <Text style={styles.flightMeta}>{m.kind}{m.tribunal ? ` · ${m.tribunal}` : ""}</Text>
                  </View>
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
    headerOverlay: { position: "absolute", top: 20, left: 0, right: 0, paddingHorizontal: space.xl, zIndex: 500 },
    headerRow: { flexDirection: "row", alignItems: "center", gap: 10 },
    iconButton: { width: 34, height: 34, borderRadius: 11, backgroundColor: color.surface, alignItems: "center", justifyContent: "center", ...theme.shadow.card },
    searchBox: { flex: 1, backgroundColor: color.surface, borderRadius: radius.xl, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 10, ...theme.shadow.card },
    searchPlaceholder: { fontSize: 13.5, color: color.textFaint },
    layerRow: { flexDirection: "row", gap: 8, marginTop: 12, flexWrap: "wrap" },
    errorBanner: { position: "absolute", top: 90, left: space.xl, right: space.xl, backgroundColor: color.dangerTint, borderRadius: radius.md, padding: 10, zIndex: 500 },
    errorText: { color: color.danger, fontSize: 12 },
    loadingOverlay: { position: "absolute", top: 0, bottom: 0, left: 0, right: 0, alignItems: "center", justifyContent: "center", zIndex: 500 },
    bottomSheet: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      maxWidth: 420,
      backgroundColor: color.surface,
      borderTopLeftRadius: 22,
      borderTopRightRadius: 22,
      paddingHorizontal: space.xl,
      paddingTop: 12,
      paddingBottom: 24,
      maxHeight: 320,
      zIndex: 500,
      overflow: "scroll" as any,
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
  });
}
