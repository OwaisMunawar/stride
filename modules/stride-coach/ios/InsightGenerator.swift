import Foundation

#if canImport(FoundationModels)
import FoundationModels
#endif

enum InsightGenerator {
  /// `available`, `unavailable` or `unsupported`, plus a machine-readable reason the
  /// settings screen can explain.
  static func availability() -> (status: String, reason: String?) {
    #if canImport(FoundationModels)
    if #available(iOS 26.0, *) {
      switch SystemLanguageModel.default.availability {
      case .available:
        return ("available", nil)
      case .unavailable(.deviceNotEligible):
        return ("unavailable", "deviceNotEligible")
      case .unavailable(.appleIntelligenceNotEnabled):
        return ("unavailable", "appleIntelligenceNotEnabled")
      case .unavailable(.modelNotReady):
        return ("unavailable", "modelNotReady")
      case .unavailable:
        return ("unavailable", "unknown")
      }
    }
    return ("unsupported", "requiresIOS26")
    #else
    return ("unsupported", "sdkWithoutFoundationModels")
    #endif
  }

  static func generate(instructions: String, prompt: String) async throws -> [String: Any] {
    let (status, reason) = availability()
    guard status == "available" else {
      throw ModelUnavailableException(reason ?? status)
    }
    #if canImport(FoundationModels)
    if #available(iOS 26.0, *) {
      return try await respond(instructions: instructions, prompt: prompt)
    }
    #endif
    throw ModelUnavailableException("requiresIOS26")
  }
}

#if canImport(FoundationModels)

@available(iOS 26.0, *)
@Generable(description: "A short coaching note about one training session")
struct GeneratedInsight {
  @Guide(description: "At most two sentences summarising the session, using only the given facts")
  var summary: String

  @Guide(description: "Short one-sentence observations about the session", .count(2...4))
  var highlights: [String]

  var nextRun: GeneratedNextRun
}

@available(iOS 26.0, *)
@Generable(description: "The suggested next session")
struct GeneratedNextRun {
  @Guide(description: "Type of session", .anyOf(["recovery", "easy", "long", "tempo", "intervals"]))
  var kind: String

  @Guide(description: "Distance in kilometres, close to the baseline plan")
  var distanceKm: Double

  // Integer seconds keep the small model from emitting "5:30" into a number field.
  @Guide(description: "Target pace in whole seconds per kilometre, close to the baseline plan")
  var targetPaceSecPerKm: Int

  @Guide(description: "One sentence explaining why this session comes next")
  var rationale: String
}

@available(iOS 26.0, *)
extension InsightGenerator {
  fileprivate static func respond(instructions: String, prompt: String) async throws -> [String: Any] {
    let session = LanguageModelSession(instructions: instructions)
    do {
      let response = try await session.respond(
        to: prompt,
        generating: GeneratedInsight.self,
        options: GenerationOptions(temperature: 0.3)
      )
      let insight = response.content
      return [
        "summary": insight.summary,
        "highlights": insight.highlights,
        "nextRun": [
          "kind": insight.nextRun.kind,
          "distanceKm": insight.nextRun.distanceKm,
          "targetPaceSecPerKm": insight.nextRun.targetPaceSecPerKm,
          "rationale": insight.nextRun.rationale,
        ],
      ]
    } catch let error as LanguageModelSession.GenerationError {
      throw GenerationFailedException(String(describing: error))
    }
  }
}

#endif
