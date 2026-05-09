import { Stack, useRouter } from "expo-router";
import { TouchableOpacity } from "react-native";
import { ChevronLeft } from "lucide-react-native";
import { useAppTheme } from "@/lib/useAppTheme";

export default function AdminLayout() {
  const theme = useAppTheme();
  const router = useRouter();

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: theme.surface },
        headerTintColor: theme.primary,
        headerTitleStyle: { color: theme.text, fontWeight: "600" },
        contentStyle: { backgroundColor: theme.bg },
        headerLeft: () => (
          <TouchableOpacity onPress={() => router.back()} style={{ padding: 4, marginRight: 8 }}>
            <ChevronLeft size={24} color={theme.primary} />
          </TouchableOpacity>
        ),
      }}
    />
  );
}
