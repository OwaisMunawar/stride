import { requireOptionalNativeModule, type NativeModule } from 'expo';

export type ModelAvailability = {
  status: 'available' | 'unavailable' | 'unsupported';
  /** Machine-readable, e.g. `appleIntelligenceNotEnabled` or `requiresIOS26`. */
  reason: string | null;
};

declare class StrideCoachNativeModule extends NativeModule {
  availability(): ModelAvailability;
  /** Resolves to the raw structured output; the app validates it before use. */
  generateInsight(instructions: string, prompt: string): Promise<unknown>;
}

/** Null on Android, in Jest and anywhere the native module is not linked. */
export const StrideCoach = requireOptionalNativeModule<StrideCoachNativeModule>('StrideCoach');
