function analyzeDiffWithAI(fileName, diff) {
  const text = diff.toLowerCase();

  let riskLevel = "LOW";
  let areas = ["UNKNOWN"];
  const findings = [];

  if (
    text.includes("password") ||
    text.includes("secret") ||
    text.includes("token") ||
    text.includes("api_key") ||
    text.includes("apikey")
  ) {
    riskLevel = "HIGH";
    areas = ["SECURITY"];

    findings.push({
      title: "Hardcoded secret detected",
      evidence: "Password, secret, token or API key found in code change.",
      explanation:
        "Secrets stored directly in code can leak through version control and create security exposure.",
      recommendation:
        "Move the secret to environment variables or a secure secret manager before merging.",
      confidence: "HIGH",
    });
  }

  if (
    text.includes("customer") ||
    text.includes("email") ||
    text.includes("personal") ||
    text.includes("user_data") ||
    text.includes("customer_data")
  ) {
    if (riskLevel !== "HIGH") riskLevel = "MEDIUM";

    areas = [...new Set([...areas.filter((a) => a !== "UNKNOWN"), "GDPR"])];

    findings.push({
      title: "Potential personal data processing",
      evidence: "Customer, email, personal data or user data detected.",
      explanation:
        "The change may involve personal data processing and should be reviewed against GDPR.",
      recommendation:
        "Verify legal basis, data minimization, access control and retention policy.",
      confidence: "MEDIUM",
    });
  }

  if (
    text.includes("model.train") ||
    text.includes("train_model") ||
    text.includes("ai_model") ||
    text.includes("machine learning") ||
    text.includes("openai")
  ) {
    if (riskLevel === "LOW") riskLevel = "MEDIUM";

    areas = [...new Set([...areas.filter((a) => a !== "UNKNOWN"), "EU_AI_ACT"])];

    findings.push({
      title: "Potential AI system usage detected",
      evidence: "AI model training or AI service usage detected.",
      explanation:
        "AI-related functionality may require risk classification under the EU AI Act.",
      recommendation:
        "Document intended use, data source, human oversight and risk classification.",
      confidence: "MEDIUM",
    });
  }

  let action = "LOG";
  if (riskLevel === "HIGH") action = "BLOCK";
  if (riskLevel === "MEDIUM") action = "WARN";

  return {
    riskLevel,
    action,
    areas,
    findings,
    summary:
      findings.length > 0
        ? `Potential compliance risks detected in ${fileName}. Review before merging.`
        : `No obvious compliance risks detected in ${fileName}.`,
  };
}

module.exports = { analyzeDiffWithAI };