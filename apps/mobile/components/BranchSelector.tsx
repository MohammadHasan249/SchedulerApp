import { ScrollView, TouchableOpacity, Text, StyleSheet } from "react-native";
import { useAppTheme } from "@/lib/useAppTheme";
import type { Branch } from "@/lib/api";

type Props = {
  branches: Branch[];
  value: string | null;
  onChange: (branchId: string) => void;
};

/**
 * Branch picker for org admins who oversee multiple branches — everything
 * scoped by branch (schedule, reports, etc.) should read the selection from
 * here rather than assuming a single branch. Renders nothing for branch
 * managers/employees, who only ever have one branch.
 */
export function BranchSelector({ branches, value, onChange }: Props) {
  const theme = useAppTheme();
  const styles = makeStyles(theme);

  if (branches.length <= 1) return null;

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.row}>
      {branches.map((b) => (
        <TouchableOpacity
          key={b.id}
          style={[styles.chip, value === b.id && styles.chipActive]}
          onPress={() => onChange(b.id)}
        >
          <Text style={[styles.chipText, value === b.id && styles.chipTextActive]}>{b.name}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

function makeStyles(theme: ReturnType<typeof useAppTheme>) {
  return StyleSheet.create({
    row: { flexGrow: 0 },
    chip: {
      paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16,
      backgroundColor: theme.surface, marginRight: 8,
    },
    chipActive: { backgroundColor: theme.primary },
    chipText: { fontSize: 13, color: theme.muted, fontWeight: "500" },
    chipTextActive: { color: "#fff" },
  });
}
