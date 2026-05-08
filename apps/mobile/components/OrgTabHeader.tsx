import { View, Text, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppTheme } from "@/lib/useAppTheme";
import { useOrgStore } from "@/lib/orgStore";

export function OrgTabHeader({ title }: { title: string }) {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const { orgName } = useOrgStore();

  return (
    <View style={[styles.container, { paddingTop: insets.top + 8, backgroundColor: theme.bg }]}>
      {orgName && (
        <Text style={[styles.orgName, { color: theme.primary }]}>{orgName}</Text>
      )}
      <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 20, paddingBottom: 12 },
  orgName: { fontSize: 12, fontWeight: "600", letterSpacing: 0.5, marginBottom: 2 },
  title: { fontSize: 26, fontWeight: "700" },
});
