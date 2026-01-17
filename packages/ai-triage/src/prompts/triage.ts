/**
 * AI Triage Prompts
 * System prompts and templates for issue triage
 */

import type { AIAnalysisInput } from '@britepulse/shared';

/**
 * System prompt for issue triage
 */
export const TRIAGE_SYSTEM_PROMPT = `You are an expert software engineer and technical support analyst helping triage bug reports and user feedback for an internal web application.

Your role is to:
1. Analyze the issue based on provided evidence (error logs, user feedback, code excerpts)
2. Classify the issue type (bug, feature request, feedback, question)
3. Assess severity based on impact (P0=critical, P1=high, P2=medium, P3=low)
4. Identify the root cause with supporting evidence
5. Propose fix options with complexity assessments
6. Create test plans to verify fixes
7. Suggest rollout and rollback strategies

CRITICAL RULES:
- Every claim must reference specific evidence
- If evidence is insufficient, set confidence <= 0.5 and request more information
- Never make assumptions without explicitly stating them
- Never include secrets, PII, or sensitive data in your response
- Be conservative with severity - only mark P0/P1 for truly critical issues
- Prefer simpler fixes when multiple options exist

OUTPUT FORMAT:
You must respond with valid JSON matching this schema:
{
  "classification": "bug" | "feature" | "feedback" | "question",
  "severity": "P0" | "P1" | "P2" | "P3",
  "severity_rationale": "string explaining severity choice",
  "impact_summary": "1-2 sentence summary of user/business impact",
  "evidence_refs": [
    {
      "type": "event" | "stack_trace" | "code_excerpt" | "metric" | "feedback",
      "ref_id": "optional reference ID",
      "excerpt": "relevant snippet",
      "relevance": "why this evidence supports the analysis"
    }
  ],
  "root_cause_hypothesis": "detailed root cause explanation",
  "fix_plan": [
    {
      "option_number": 1,
      "description": "fix description",
      "files_likely_touched": ["file1.ts", "file2.ts"],
      "complexity": "low" | "medium" | "high",
      "confidence": 0.0-1.0
    }
  ],
  "test_plan": [
    {
      "test_type": "unit" | "integration" | "e2e" | "manual",
      "description": "what to test",
      "priority": "required" | "recommended" | "optional"
    }
  ],
  "rollout_plan": "deployment strategy recommendation",
  "rollback_plan": "rollback strategy if issues arise",
  "confidence": 0.0-1.0,
  "assumptions": ["assumption 1", "assumption 2"],
  "limitations": ["what couldn't be determined"],
  "next_action": "investigate" | "request_info" | "route_engineering" | "create_ticket" | "monitor_only",
  "next_action_rationale": "why this action is recommended",
  "additional_info_needed": ["info needed if confidence low"]
}`;

/**
 * Build user message for triage
 */
export function buildTriageUserMessage(input: AIAnalysisInput): string {
  const parts: string[] = [];

  parts.push('## Issue Information');
  parts.push(`**Title:** ${input.issue_title}`);
  parts.push(`**Description:** ${input.issue_description}`);
  parts.push(`**Type:** ${input.issue_type}`);
  parts.push(`**Current Severity:** ${input.current_severity}`);
  parts.push(`**App:** ${input.app_name} (${input.environment})`);
  parts.push('');

  parts.push('## Metrics');
  parts.push(`- Total occurrences: ${input.occurrences_total}`);
  parts.push(`- Last 24h occurrences: ${input.occurrences_24h}`);
  parts.push(`- Unique users (24h est): ${input.unique_users_24h_est}`);
  parts.push(`- Trend: ${input.trend_direction}`);
  parts.push('');

  if (input.affected_routes && input.affected_routes.length > 0) {
    parts.push('## Affected Routes');
    input.affected_routes.forEach((route) => parts.push(`- ${route}`));
    parts.push('');
  }

  if (input.affected_versions && input.affected_versions.length > 0) {
    parts.push('## Affected Versions');
    input.affected_versions.forEach((version) => parts.push(`- ${version}`));
    parts.push('');
  }

  if (input.sanitized_feedback && input.sanitized_feedback.length > 0) {
    parts.push('## User Feedback');
    input.sanitized_feedback.forEach((feedback, i) => {
      parts.push(`### Feedback ${i + 1}`);
      parts.push(feedback);
      parts.push('');
    });
  }

  if (input.sanitized_stack_traces && input.sanitized_stack_traces.length > 0) {
    parts.push('## Stack Traces');
    input.sanitized_stack_traces.forEach((stack, i) => {
      parts.push(`### Stack Trace ${i + 1}`);
      parts.push('```');
      parts.push(stack);
      parts.push('```');
      parts.push('');
    });
  }

  if (input.retrieved_code_excerpts && input.retrieved_code_excerpts.length > 0) {
    parts.push('## Relevant Code');
    input.retrieved_code_excerpts.forEach((excerpt) => {
      parts.push(`### ${excerpt.file_path} (lines ${excerpt.start_line}-${excerpt.end_line})`);
      parts.push(`_Relevance: ${excerpt.relevance}_`);
      parts.push('```');
      parts.push(excerpt.content);
      parts.push('```');
      parts.push('');
    });
  }

  parts.push('Please analyze this issue and provide your triage assessment in JSON format.');

  return parts.join('\n');
}

/**
 * Validate that AI analysis follows the rules
 */
export function validateAnalysis(analysis: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!analysis || typeof analysis !== 'object') {
    return { valid: false, errors: ['Analysis must be an object'] };
  }

  const a = analysis as Record<string, unknown>;

  // Check required fields
  const requiredFields = [
    'classification',
    'severity',
    'severity_rationale',
    'impact_summary',
    'root_cause_hypothesis',
    'fix_plan',
    'test_plan',
    'rollout_plan',
    'rollback_plan',
    'confidence',
    'next_action',
  ];

  for (const field of requiredFields) {
    if (!(field in a)) {
      errors.push(`Missing required field: ${field}`);
    }
  }

  // Validate evidence requirement
  if (a.root_cause_hypothesis && (!a.evidence_refs || (a.evidence_refs as unknown[]).length === 0)) {
    errors.push('Root cause hypothesis requires at least one evidence reference');
  }

  // Validate confidence when low
  if (typeof a.confidence === 'number' && a.confidence <= 0.5) {
    if (!a.additional_info_needed || (a.additional_info_needed as unknown[]).length === 0) {
      errors.push('Low confidence analysis must specify what additional info is needed');
    }
    if (a.next_action !== 'request_info' && a.next_action !== 'route_engineering') {
      errors.push('Low confidence analysis should have next_action of request_info or route_engineering');
    }
  }

  // Check for forbidden content (basic check)
  const jsonStr = JSON.stringify(a);
  const forbiddenPatterns = [
    /api[_-]?key\s*[:=]/i,
    /password\s*[:=]/i,
    /secret\s*[:=]/i,
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/, // email
  ];

  for (const pattern of forbiddenPatterns) {
    if (pattern.test(jsonStr)) {
      errors.push('Analysis may contain forbidden content (secrets or PII)');
      break;
    }
  }

  return { valid: errors.length === 0, errors };
}
