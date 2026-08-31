import { Platform } from "react-native";
import structuredClone from "@ungap/structured-clone";
import { polyfillGlobal } from "react-native/Libraries/Utilities/PolyfillFunctions";
import { TextEncoderStream, TextDecoderStream } from "@stardazed/streams-text-encoding";

// The AI SDK (used by the AI Schedule Assistant) relies on structuredClone and
// TextEncoderStream/TextDecoderStream, which aren't available in the Hermes
// runtime on native platforms. Applied synchronously at module load (static
// imports, not dynamic `import()`) so the polyfills are guaranteed to be in
// place before any screen — including the AI chat's streaming transport —
// can possibly run, instead of racing an async setup step.
if (Platform.OS !== "web") {
  if (!("structuredClone" in global)) {
    polyfillGlobal("structuredClone", () => structuredClone);
  }

  polyfillGlobal("TextEncoderStream", () => TextEncoderStream);
  polyfillGlobal("TextDecoderStream", () => TextDecoderStream);
}

export {};
