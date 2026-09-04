import type { ExpoConfig } from "expo/config";

type Variant = "workplix" | "seaudecrabe";

const variant = (process.env.APP_VARIANT as Variant | undefined) ?? "workplix";

const BRANDS: Record<
  Variant,
  Pick<ExpoConfig, "name" | "slug" | "scheme"> & {
    bundleIdentifier: string;
    androidPackage: string;
    icon: string;
    adaptiveIconForeground: string;
    splashImage: string;
    backgroundColor: string;
    easProjectId?: string;
  }
> = {
  workplix: {
    name: "Workplix",
    slug: "workplix-mobile",
    scheme: "workplix",
    bundleIdentifier: "com.workplix.mobile",
    androidPackage: "com.workplix.mobile",
    icon: "./assets/icon.png",
    adaptiveIconForeground: "./assets/adaptive-icon.png",
    splashImage: "./assets/splash-icon.png",
    backgroundColor: "#2563EB",
    easProjectId: "7398c8a3-adf8-4182-871d-a8405d7221a1",
  },
  seaudecrabe: {
    name: "Seau de Crabe",
    slug: "seau-de-crabe-mobile",
    scheme: "seaudecrabe",
    bundleIdentifier: "com.seaudecrabe.mobile",
    androidPackage: "com.seaudecrabe.mobile",
    icon: "./assets/brands/seaudecrabe/icon.png",
    adaptiveIconForeground: "./assets/brands/seaudecrabe/adaptive-icon.png",
    splashImage: "./assets/brands/seaudecrabe/splash-icon.png",
    backgroundColor: "#d8191f",
    easProjectId: "74d97c70-81eb-49b7-adc0-13ad2d269e2a",
  },
};

const brand = BRANDS[variant];

const config: ExpoConfig = {
  name: brand.name,
  slug: brand.slug,
  version: "1.0.0",
  orientation: "portrait",
  icon: brand.icon,
  scheme: brand.scheme,
  userInterfaceStyle: "automatic",
  newArchEnabled: true,
  splash: {
    image: brand.splashImage,
    resizeMode: "contain",
    backgroundColor: brand.backgroundColor,
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: brand.bundleIdentifier,
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
      UISupportedInterfaceOrientations: ["UIInterfaceOrientationPortrait"],
      "UISupportedInterfaceOrientations~ipad": [
        "UIInterfaceOrientationPortrait",
        "UIInterfaceOrientationPortraitUpsideDown",
        "UIInterfaceOrientationLandscapeLeft",
        "UIInterfaceOrientationLandscapeRight",
      ],
    },
  },
  android: {
    adaptiveIcon: {
      foregroundImage: brand.adaptiveIconForeground,
      backgroundColor: brand.backgroundColor,
    },
    package: brand.androidPackage,
  },
  experiments: {
    typedRoutes: true,
  },
  plugins: [
    "expo-router",
    "expo-secure-store",
    "@react-native-community/datetimepicker",
    [
      "expo-notifications",
      {
        icon: brand.icon,
        color: brand.backgroundColor,
      },
    ],
  ],
  extra: {
    appVariant: variant,
    ...(brand.easProjectId ? { eas: { projectId: brand.easProjectId } } : {}),
  },
  ...(brand.easProjectId
    ? {
        updates: { url: `https://u.expo.dev/${brand.easProjectId}` },
        runtimeVersion: { policy: "appVersion" as const },
      }
    : {}),
};

export default config;
