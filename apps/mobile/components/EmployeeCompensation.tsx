import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { useEffect, useState } from "react";
import { format } from "date-fns";
import { usePayRatesQuery, useCreatePayRate } from "@/hooks/usePayRates";
import type { PayType } from "@scheduler/types";
import { useAppTheme } from "@/lib/useAppTheme";

function formatAmount(cents: number, currency: string, payType: PayType): string {
  const formatted = new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency,
    minimumFractionDigits: payType === "hourly" ? 2 : 0,
    maximumFractionDigits: payType === "hourly" ? 2 : 0,
  }).format(cents / 100);
  return `${formatted}${payType === "hourly" ? "/hr" : "/yr"}`;
}

// "YYYY-MM-DD" -> local Date (avoids UTC-parse off-by-one).
function parseDateOnly(d: string): Date {
  return new Date(`${d}T00:00:00`);
}

export function EmployeeCompensation({
  employeeId,
  canEdit,
}: {
  employeeId: string;
  canEdit: boolean;
}) {
  const theme = useAppTheme();
  const styles = makeStyles(theme);

  const ratesQuery = usePayRatesQuery(employeeId);
  const createMutation = useCreatePayRate();
  const rates = ratesQuery.data ?? null;
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const [payType, setPayType] = useState<PayType>("hourly");
  const [amount, setAmount] = useState("");
  const [effectiveDate, setEffectiveDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [note, setNote] = useState("");
  const submitting = createMutation.isPending;

  useEffect(() => {
    if (ratesQuery.error) {
      setError(ratesQuery.error instanceof Error ? ratesQuery.error.message : "Couldn't load compensation.");
    }
  }, [ratesQuery.error]);

  async function handleSubmit() {
    setError(null);
    const dollars = Number(amount);
    if (!Number.isFinite(dollars) || dollars <= 0) {
      setError("Enter a valid amount.");
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(effectiveDate)) {
      setError("Effective date must be YYYY-MM-DD.");
      return;
    }
    try {
      await createMutation.mutateAsync({
        employeeId,
        payload: {
          payType,
          amountCents: Math.round(dollars * 100),
          effectiveDate,
          note: note.trim() || null,
        },
      });
      setAmount("");
      setNote("");
      setShowForm(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save the rate.");
    }
  }

  const current = rates?.[0] ?? null; // API returns newest first

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.cardTitle}>Compensation</Text>
        {canEdit && (
          <TouchableOpacity onPress={() => setShowForm((s) => !s)}>
            <Text style={styles.toggle}>{showForm ? "Cancel" : "Add rate"}</Text>
          </TouchableOpacity>
        )}
      </View>

      {error && <Text style={styles.error}>{error}</Text>}

      <View style={styles.currentRow}>
        <Text style={styles.label}>Current rate</Text>
        <Text style={styles.currentValue}>
          {rates === null
            ? "…"
            : current
              ? formatAmount(current.amountCents, current.currency, current.payType)
              : "Not set"}
        </Text>
      </View>

      {canEdit && showForm && (
        <View style={styles.form}>
          <View style={styles.segment}>
            {(["hourly", "salary"] as PayType[]).map((t) => (
              <TouchableOpacity
                key={t}
                style={[styles.segmentBtn, payType === t && styles.segmentBtnActive]}
                onPress={() => setPayType(t)}
              >
                <Text style={[styles.segmentText, payType === t && styles.segmentTextActive]}>
                  {t === "hourly" ? "Hourly" : "Salary"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.fieldLabel}>
            Amount (CAD {payType === "hourly" ? "per hour" : "per year"})
          </Text>
          <TextInput
            style={styles.input}
            keyboardType="decimal-pad"
            placeholder={payType === "hourly" ? "e.g. 21.50" : "e.g. 55000"}
            placeholderTextColor={theme.muted}
            value={amount}
            onChangeText={setAmount}
          />

          <Text style={styles.fieldLabel}>Effective date</Text>
          <TextInput
            style={styles.input}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={theme.muted}
            autoCapitalize="none"
            value={effectiveDate}
            onChangeText={setEffectiveDate}
          />

          <Text style={styles.fieldLabel}>Note (optional)</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. annual raise"
            placeholderTextColor={theme.muted}
            value={note}
            onChangeText={setNote}
          />

          <TouchableOpacity
            style={[styles.saveBtn, submitting && styles.btnDisabled]}
            onPress={handleSubmit}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.saveBtnText}>Save rate</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {rates && rates.length > 0 && (
        <View style={styles.history}>
          <Text style={styles.historyTitle}>History</Text>
          {rates.map((r) => (
            <View key={r.id} style={styles.historyRow}>
              <Text style={styles.historyDate}>
                {format(parseDateOnly(r.effectiveDate), "MMM d, yyyy")}
              </Text>
              <Text style={styles.historyAmount}>
                {formatAmount(r.amountCents, r.currency, r.payType)}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function makeStyles(theme: ReturnType<typeof useAppTheme>) {
  return StyleSheet.create({
    card: { backgroundColor: theme.surface, borderRadius: 14, padding: 16, gap: 10 },
    headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    cardTitle: {
      fontSize: 12,
      fontWeight: "700",
      color: theme.muted,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    toggle: { color: theme.primary, fontSize: 13, fontWeight: "600" },
    error: { color: theme.destructive, fontSize: 13 },
    currentRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    label: { color: theme.muted, fontSize: 13 },
    currentValue: { color: theme.text, fontSize: 15, fontWeight: "700" },
    form: {
      gap: 8,
      borderTopWidth: 1,
      borderTopColor: theme.bg,
      paddingTop: 12,
    },
    segment: {
      flexDirection: "row",
      backgroundColor: theme.bg,
      borderRadius: 10,
      padding: 3,
      gap: 3,
    },
    segmentBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: "center" },
    segmentBtnActive: { backgroundColor: theme.primary },
    segmentText: { color: theme.textSecondary, fontSize: 13, fontWeight: "600" },
    segmentTextActive: { color: "#fff" },
    fieldLabel: { color: theme.muted, fontSize: 12, marginTop: 2 },
    input: {
      borderWidth: 1,
      borderColor: theme.bg,
      backgroundColor: theme.bg,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      color: theme.text,
      fontSize: 14,
    },
    saveBtn: {
      backgroundColor: theme.primary,
      borderRadius: 10,
      paddingVertical: 12,
      alignItems: "center",
      marginTop: 4,
    },
    saveBtnText: { color: "#fff", fontSize: 14, fontWeight: "600" },
    btnDisabled: { opacity: 0.6 },
    history: { gap: 6, borderTopWidth: 1, borderTopColor: theme.bg, paddingTop: 10 },
    historyTitle: {
      fontSize: 11,
      fontWeight: "700",
      color: theme.muted,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    historyRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    historyDate: { color: theme.muted, fontSize: 13 },
    historyAmount: { color: theme.text, fontSize: 14, fontWeight: "500" },
  });
}
