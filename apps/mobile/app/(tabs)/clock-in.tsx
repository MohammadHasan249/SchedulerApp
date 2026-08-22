import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  BackHandler,
  Alert,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useEffect, useRef, useState } from "react";
import { useNavigation } from "expo-router";
import { Lock, Unlock, Delete } from "lucide-react-native";
import { clockPunch, verifyExitPin, getBranches, type Branch } from "@/lib/api";
import { useAppTheme } from "@/lib/useAppTheme";
import { useKioskStore } from "@/lib/kioskStore";

const PAD_KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"];
const PIN_LENGTH = 4;

type ClockResult = {
  employeeName: string;
  clockType: "clock_in" | "clock_out";
};

export default function ClockInScreen() {
  const theme = useAppTheme();
  const styles = makeStyles(theme);
  const navigation = useNavigation();
  const { isLocked, branchSlug, setLocked, setBranchSlug, clearBranchSlug } =
    useKioskStore();

  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ClockResult | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Exit PIN modal state
  const [exitModalVisible, setExitModalVisible] = useState(false);
  const [exitPin, setExitPin] = useState("");
  const [exitError, setExitError] = useState<string | null>(null);
  const [exitLoading, setExitLoading] = useState(false);

  // Branch slug setup modal
  const [branchModalVisible, setBranchModalVisible] = useState(false);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchesLoading, setBranchesLoading] = useState(false);
  const [branchesError, setBranchesError] = useState<string | null>(null);

  const selectedBranch = branches.find((b) => b.slug === branchSlug);

  // Fetch the org's live branch list so the kiosk always reflects the
  // database instead of a slug typed in once and cached forever on-device.
  async function loadBranches() {
    setBranchesLoading(true);
    setBranchesError(null);
    try {
      const rows = await getBranches();
      setBranches(rows);
    } catch {
      setBranchesError("Unable to load branches. Check your connection.");
    } finally {
      setBranchesLoading(false);
    }
  }

  useEffect(() => {
    loadBranches();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-validate whenever we have both a persisted slug and a fresh branch
  // list (either may arrive after the other — hydration from SecureStore
  // and the network fetch race independently). The persisted slug may point
  // at a branch that was renamed/deleted since it was set — clear it so the
  // UI doesn't silently show stale data, and force re-selection.
  useEffect(() => {
    if (
      branchSlug &&
      branches.length > 0 &&
      !branches.some((b) => b.slug === branchSlug)
    ) {
      clearBranchSlug();
      setBranchModalVisible(true);
    }
  }, [branchSlug, branches, clearBranchSlug]);

  // Block navigation when locked
  useEffect(() => {
    if (!isLocked) return;
    const unsub = navigation.addListener("beforeRemove", (e) => {
      e.preventDefault();
    });
    const backHandler = BackHandler.addEventListener(
      "hardwareBackPress",
      () => true
    );
    return () => {
      unsub();
      backHandler.remove();
    };
  }, [isLocked, navigation]);

  // Auto-submit when PIN reaches length
  useEffect(() => {
    if (pin.length === PIN_LENGTH && !submitting) {
      handlePunch();
    }
  }, [pin]);

  // Clear result after 3 seconds
  useEffect(() => {
    if (!result) return;
    const t = setTimeout(() => setResult(null), 3000);
    return () => clearTimeout(t);
  }, [result]);

  // Clear error after 2.5 seconds (long enough to read a server message)
  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(null), 2500);
    return () => clearTimeout(t);
  }, [error]);

  async function handlePunch() {
    if (!branchSlug) {
      setPin("");
      setBranchModalVisible(true);
      return;
    }
    setSubmitting(true);
    try {
      const res = await clockPunch(pin, branchSlug);
      setResult({ employeeName: res.employeeName, clockType: res.clockType });
    } catch (e) {
      // Surface the real server error (wrong branch slug, inactive employee…)
      // instead of blaming the PIN for everything.
      const msg =
        e instanceof Error && e.message && !e.message.startsWith("Request failed")
          ? e.message
          : "Invalid PIN. Please try again.";
      setError(msg);
    } finally {
      setPin("");
      setSubmitting(false);
    }
  }

  function handlePadPress(key: string) {
    if (submitting || result) return;
    if (key === "⌫") {
      setPin((p) => p.slice(0, -1));
    } else if (key !== "" && pin.length < PIN_LENGTH) {
      setPin((p) => p + key);
    }
  }

  function handleEnableKiosk() {
    if (!branchSlug) {
      setBranchModalVisible(true);
      return;
    }
    setLocked(true);
  }

  async function handleExitSubmit() {
    if (exitPin.length < 4) return;
    setExitLoading(true);
    setExitError(null);
    try {
      const res = await verifyExitPin(exitPin);
      if (res.valid) {
        setLocked(false);
        setExitModalVisible(false);
        setExitPin("");
      } else if (!res.configured) {
        setExitError(
          "No exit PIN has been set yet. Ask an org admin to set one under Settings > Organization on the web dashboard."
        );
      } else {
        setExitError("Incorrect PIN.");
      }
    } catch {
      setExitError("Unable to verify. Try again.");
    } finally {
      setExitLoading(false);
    }
  }

  async function handleBranchSelect(slug: string) {
    await setBranchSlug(slug);
    setBranchModalVisible(false);
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      {/* Unlocked toolbar */}
      {!isLocked && (
        <View style={styles.toolbar}>
          <Text style={styles.branchLabel}>
            Branch: {selectedBranch?.name ?? branchSlug ?? "not set"}
          </Text>
          <TouchableOpacity
            style={styles.toolbarBtn}
            onPress={() => setBranchModalVisible(true)}
          >
            <Text style={[styles.toolbarBtnText, { color: theme.secondary }]}>
              Change
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toolbarBtn, styles.lockBtn]}
            onPress={handleEnableKiosk}
          >
            <Lock size={14} color={theme.primary} />
            <Text style={[styles.toolbarBtnText, { color: theme.primary }]}>
              Enable Kiosk
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Exit kiosk button — subtle, visible only when locked */}
      {isLocked && (
        <TouchableOpacity
          style={styles.exitBtn}
          onPress={() => {
            setExitPin("");
            setExitError(null);
            setExitModalVisible(true);
          }}
        >
          <Unlock size={16} color={theme.muted} />
        </TouchableOpacity>
      )}

      {/* Main kiosk UI */}
      <View style={styles.body}>
        {result ? (
          <View style={styles.resultBox}>
            <Text style={styles.resultName}>{result.employeeName}</Text>
            <Text
              style={[
                styles.resultAction,
                {
                  color:
                    result.clockType === "clock_in"
                      ? theme.primary
                      : theme.secondary,
                },
              ]}
            >
              {result.clockType === "clock_in" ? "Clocked In" : "Clocked Out"}
            </Text>
          </View>
        ) : (
          <>
            <Text style={styles.prompt}>Enter your PIN</Text>

            {/* PIN dots */}
            <View style={styles.dotsRow}>
              {Array.from({ length: PIN_LENGTH }).map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.dot,
                    {
                      backgroundColor:
                        i < pin.length ? theme.primary : theme.surface,
                    },
                  ]}
                />
              ))}
            </View>

            {error && <Text style={styles.errorText}>{error}</Text>}
          </>
        )}

        {/* PIN pad */}
        <View style={styles.pad}>
          {PAD_KEYS.map((key, i) => (
            <TouchableOpacity
              key={i}
              style={[
                styles.padKey,
                {
                  backgroundColor: key === "" ? "transparent" : theme.surface,
                  opacity: key === "" ? 0 : 1,
                },
              ]}
              onPress={() => handlePadPress(key)}
              disabled={key === ""}
              activeOpacity={0.7}
            >
              {key === "⌫" ? (
                <Delete size={20} color={theme.textSecondary} />
              ) : (
                <Text style={styles.padKeyText}>{key}</Text>
              )}
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Exit kiosk modal */}
      <Modal
        visible={exitModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setExitModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { backgroundColor: theme.surface }]}>
            <Text style={styles.modalTitle}>Exit Kiosk Mode</Text>
            <Text style={styles.modalSubtitle}>Enter admin PIN to continue</Text>
            <TextInput
              style={[
                styles.pinInput,
                {
                  backgroundColor: theme.bg,
                  color: theme.text,
                  borderColor: exitError ? theme.destructive : theme.surface2,
                },
              ]}
              value={exitPin}
              onChangeText={setExitPin}
              keyboardType="number-pad"
              maxLength={6}
              secureTextEntry
              placeholder="••••"
              placeholderTextColor={theme.muted}
              autoFocus
            />
            {exitError && (
              <Text style={styles.modalError}>{exitError}</Text>
            )}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: theme.bg }]}
                onPress={() => {
                  setExitModalVisible(false);
                  setExitPin("");
                  setExitError(null);
                }}
              >
                <Text style={[styles.modalBtnText, { color: theme.muted }]}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalBtn,
                  { backgroundColor: theme.primary },
                  exitLoading && { opacity: 0.6 },
                ]}
                onPress={handleExitSubmit}
                disabled={exitLoading || exitPin.length < 4}
              >
                <Text style={[styles.modalBtnText, { color: "#fff" }]}>
                  {exitLoading ? "Verifying…" : "Confirm"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Branch slug setup modal */}
      <Modal
        visible={branchModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setBranchModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.modalOverlay}
        >
          <View style={[styles.modalBox, { backgroundColor: theme.surface }]}>
            <Text style={styles.modalTitle}>Set Branch</Text>
            <Text style={styles.modalSubtitle}>
              Select the branch this device clocks in for
            </Text>

            {branchesLoading && (
              <Text style={[styles.modalSubtitle, { color: theme.muted }]}>
                Loading branches…
              </Text>
            )}
            {branchesError && (
              <Text style={styles.modalError}>{branchesError}</Text>
            )}
            {!branchesLoading && !branchesError && branches.length === 0 && (
              <Text style={[styles.modalSubtitle, { color: theme.muted }]}>
                No branches found for this organization.
              </Text>
            )}

            <View style={styles.branchList}>
              {branches.map((b) => (
                <TouchableOpacity
                  key={b.id}
                  style={[
                    styles.branchOption,
                    {
                      backgroundColor:
                        b.slug === branchSlug ? theme.primarySurface : theme.bg,
                    },
                  ]}
                  onPress={() => handleBranchSelect(b.slug)}
                >
                  <Text style={{ color: theme.text, fontWeight: "600" }}>
                    {b.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: theme.bg }]}
                onPress={loadBranches}
              >
                <Text style={[styles.modalBtnText, { color: theme.muted }]}>
                  Refresh
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: theme.bg }]}
                onPress={() => setBranchModalVisible(false)}
                disabled={!branchSlug}
              >
                <Text style={[styles.modalBtnText, { color: theme.muted }]}>
                  Cancel
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

function makeStyles(theme: ReturnType<typeof useAppTheme>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.bg },
    toolbar: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingVertical: 10,
      gap: 8,
    },
    branchLabel: { fontSize: 12, color: theme.muted, flex: 1 },
    toolbarBtn: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 8,
      gap: 4,
    },
    lockBtn: { backgroundColor: theme.primarySurface },
    toolbarBtnText: { fontSize: 12, fontWeight: "600" },
    exitBtn: {
      position: "absolute",
      top: 56,
      right: 16,
      padding: 10,
      zIndex: 10,
      opacity: 0.4,
    },
    body: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 32,
      gap: 24,
    },
    prompt: {
      fontSize: 22,
      fontWeight: "600",
      color: theme.text,
      textAlign: "center",
    },
    dotsRow: {
      flexDirection: "row",
      gap: 16,
      marginVertical: 8,
    },
    dot: {
      width: 18,
      height: 18,
      borderRadius: 9,
    },
    errorText: {
      fontSize: 13,
      color: theme.destructive,
      textAlign: "center",
    },
    resultBox: {
      alignItems: "center",
      gap: 8,
    },
    resultName: {
      fontSize: 26,
      fontWeight: "700",
      color: theme.text,
      textAlign: "center",
    },
    resultAction: {
      fontSize: 18,
      fontWeight: "600",
      textAlign: "center",
    },
    pad: {
      flexDirection: "row",
      flexWrap: "wrap",
      width: 240,
      gap: 12,
      justifyContent: "center",
    },
    padKey: {
      width: 68,
      height: 68,
      borderRadius: 34,
      alignItems: "center",
      justifyContent: "center",
    },
    padKeyText: {
      fontSize: 24,
      fontWeight: "500",
      color: theme.text,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.6)",
      alignItems: "center",
      justifyContent: "center",
      padding: 24,
    },
    branchList: {
      gap: 8,
      maxHeight: 260,
    },
    branchOption: {
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderRadius: 10,
    },
    modalBox: {
      width: "100%",
      maxWidth: 360,
      borderRadius: 16,
      padding: 24,
      gap: 12,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: theme.text,
    },
    modalSubtitle: {
      fontSize: 13,
      color: theme.muted,
    },
    pinInput: {
      borderWidth: 1,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 16,
      marginTop: 4,
    },
    modalError: {
      fontSize: 13,
      color: theme.destructive,
    },
    modalActions: {
      flexDirection: "row",
      gap: 10,
      marginTop: 8,
    },
    modalBtn: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 10,
      alignItems: "center",
    },
    modalBtnText: {
      fontSize: 15,
      fontWeight: "600",
    },
  });
}
