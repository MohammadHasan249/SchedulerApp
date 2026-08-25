import { useState, useRef, useEffect } from "react";
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "expo-router";
import { Bot, Send } from "lucide-react-native";
import { chatScheduleAI } from "@/lib/api";
import { useAppTheme } from "@/lib/useAppTheme";
import type { ScheduleChatMessage, ScheduleChatAction } from "@scheduler/types";

type DisplayMessage = ScheduleChatMessage & { actions?: ScheduleChatAction[] };

const GREETING: ScheduleChatMessage = {
  role: "assistant",
  content:
    "Hi! I can help you assign employees to shifts. Tell me what you need — for example:\n\n• \"Assign 2 cooks and 1 waiter to Monday's morning shift\"\n• \"Who's available Friday afternoon?\"\n• \"Schedule the team for next week\"",
};

export default function ScheduleAIScreen() {
  const theme = useAppTheme();
  const styles = makeStyles(theme);
  const navigation = useNavigation();
  const listRef = useRef<FlatList>(null);

  const [messages, setMessages] = useState<DisplayMessage[]>([GREETING]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    navigation.setOptions({ title: "AI Schedule Assistant" });
  }, []);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: ScheduleChatMessage = { role: "user", content: text };
    const next = [...messages.filter((m) => m !== GREETING || messages.length > 1), userMsg];
    // Keep GREETING only as display; send only real conversation to API
    const apiMessages = next.filter((m) => m !== GREETING);

    setMessages([...messages, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const { reply, actions } = await chatScheduleAI(apiMessages);
      setMessages((prev) => [...prev, { role: "assistant", content: reply, actions }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Sorry, something went wrong. Please try again." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (messages.length > 1) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages]);

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={90}
      >
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(_, i) => String(i)}
          contentContainerStyle={styles.messageList}
          renderItem={({ item }) => <MessageBubble msg={item} />}
          ListFooterComponent={
            loading ? (
              <View style={styles.typingRow}>
                <Bot size={18} color={theme.muted} />
                <ActivityIndicator size="small" color={theme.muted} style={{ marginLeft: 8 }} />
              </View>
            ) : null
          }
        />

        <View style={styles.inputBar}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="Message the AI assistant..."
            placeholderTextColor={theme.inactive}
            multiline
            maxLength={500}
            returnKeyType="send"
            onSubmitEditing={send}
          />
          <TouchableOpacity
            testID="ai-chat-send-button"
            style={[styles.sendBtn, (!input.trim() || loading) && styles.sendBtnDisabled]}
            onPress={send}
            disabled={!input.trim() || loading}
          >
            <Send size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function MessageBubble({ msg }: { msg: DisplayMessage }) {
  const theme = useAppTheme();
  const styles = makeStyles(theme);
  const isUser = msg.role === "user";
  const assignCount = msg.actions?.filter((a) => a.type === "assign_employee").length ?? 0;

  return (
    <View style={[styles.bubbleRow, isUser && styles.bubbleRowUser]}>
      {!isUser && (
        <View style={styles.avatar}>
          <Bot size={16} color={theme.primary} />
        </View>
      )}
      <View style={{ flexShrink: 1, gap: 4 }}>
        <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAI]}>
          <Text style={[styles.bubbleText, isUser && styles.bubbleTextUser]}>{msg.content}</Text>
        </View>
        {assignCount > 0 && (
          <View style={styles.confirmChip} testID="ai-assign-confirmed">
            <Text style={styles.confirmChipText}>
              ✓ {assignCount === 1 ? "1 assignment made" : `${assignCount} assignments made`}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

function makeStyles(theme: ReturnType<typeof useAppTheme>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.bg },
    messageList: { padding: 16, gap: 12, paddingBottom: 8 },
    bubbleRow: { flexDirection: "row", alignItems: "flex-end", gap: 8, maxWidth: "90%" },
    bubbleRowUser: { alignSelf: "flex-end", flexDirection: "row-reverse" },
    avatar: {
      width: 30, height: 30, borderRadius: 15,
      backgroundColor: theme.surface, alignItems: "center", justifyContent: "center",
    },
    bubble: {
      borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10,
      flexShrink: 1,
    },
    bubbleAI: { backgroundColor: theme.surface, borderBottomLeftRadius: 4 },
    bubbleUser: { backgroundColor: theme.primary, borderBottomRightRadius: 4 },
    bubbleText: { fontSize: 15, color: theme.text, lineHeight: 21 },
    bubbleTextUser: { color: "#fff" },
    confirmChip: {
      alignSelf: "flex-start",
      backgroundColor: "#22c55e33",
      borderRadius: 10,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    confirmChipText: { fontSize: 12, fontWeight: "600", color: "#16a34a" },
    typingRow: {
      flexDirection: "row", alignItems: "center",
      paddingHorizontal: 16, paddingVertical: 8,
    },
    inputBar: {
      flexDirection: "row", alignItems: "flex-end", gap: 10,
      paddingHorizontal: 16, paddingVertical: 12,
      borderTopWidth: 1, borderTopColor: theme.surface,
      backgroundColor: theme.bg,
    },
    input: {
      flex: 1, backgroundColor: theme.surface, borderRadius: 20,
      paddingHorizontal: 16, paddingVertical: 10,
      fontSize: 15, color: theme.text, maxHeight: 120,
    },
    sendBtn: {
      width: 42, height: 42, borderRadius: 21,
      backgroundColor: theme.primary,
      alignItems: "center", justifyContent: "center",
    },
    sendBtnDisabled: { opacity: 0.4 },
  });
}
