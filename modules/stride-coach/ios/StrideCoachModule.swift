import ExpoModulesCore

public final class StrideCoachModule: Module {
  public func definition() -> ModuleDefinition {
    Name("StrideCoach")

    Function("availability") { () -> [String: Any] in
      let (status, reason) = InsightGenerator.availability()
      return ["status": status, "reason": reason ?? NSNull()]
    }

    AsyncFunction("generateInsight") { (instructions: String, prompt: String) async throws -> [String: Any] in
      try await InsightGenerator.generate(instructions: instructions, prompt: prompt)
    }
  }
}

final class ModelUnavailableException: GenericException<String>, @unchecked Sendable {
  override var code: String { "ERR_MODEL_UNAVAILABLE" }
  override var reason: String { "Apple Foundation Models is not available: \(param)." }
}

final class GenerationFailedException: GenericException<String>, @unchecked Sendable {
  override var code: String { "ERR_GENERATION_FAILED" }
  override var reason: String { "Insight generation failed: \(param)." }
}
