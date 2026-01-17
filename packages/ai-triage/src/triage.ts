/**
 * AI Triage Service
 * Main triage functionality
 */

import { v4 as uuidv4 } from 'uuid';
import type {
  Issue,
  Event,
  AIAnalysis,
  AIAnalysisInput,
  TriageResponse,
  Severity,
  CodeExcerpt,
} from '@britepulse/shared';
import { generateStructuredCompletion } from './client.js';
import { TRIAGE_SYSTEM_PROMPT, buildTriageUserMessage, validateAnalysis } from './prompts/triage.js';
import { buildAnalysisInput, validateContentForAI, sanitizeForAI } from './evidence.js';

/**
 * Triage eligibility configuration
 */
export interface TriageEligibility {
  minSeverity: Severity;
  minRecurrence: number;
}

const DEFAULT_ELIGIBILITY: TriageEligibility = {
  minSeverity: 'P1',
  minRecurrence: 5,
};

/**
 * Check if an issue is eligible for AI triage
 */
export function isEligibleForTriage(
  issue: Issue,
  eligibility: TriageEligibility = DEFAULT_ELIGIBILITY
): { eligible: boolean; reason?: string } {
  // Check severity threshold
  const severityOrder: Severity[] = ['P0', 'P1', 'P2', 'P3'];
  const issueSeverityIndex = severityOrder.indexOf(issue.severity);
  const minSeverityIndex = severityOrder.indexOf(eligibility.minSeverity);

  if (issueSeverityIndex > minSeverityIndex) {
    return {
      eligible: false,
      reason: `Severity ${issue.severity} below threshold ${eligibility.minSeverity}`,
    };
  }

  // Check recurrence threshold
  if (issue.counts.occurrences_24h < eligibility.minRecurrence) {
    return {
      eligible: false,
      reason: `Occurrences (${issue.counts.occurrences_24h}) below threshold (${eligibility.minRecurrence})`,
    };
  }

  // Check if already has recent analysis
  if (issue.ai_analysis) {
    const analysisAge = Date.now() - new Date(issue.ai_analysis.generated_at).getTime();
    const oneHour = 60 * 60 * 1000;
    if (analysisAge < oneHour) {
      return {
        eligible: false,
        reason: 'Recent analysis exists (less than 1 hour old)',
      };
    }
  }

  return { eligible: true };
}

/**
 * Run AI triage on an issue
 */
export async function runTriage(
  issue: Issue,
  events: Event[],
  appName: string,
  options: {
    codeExcerpts?: CodeExcerpt[];
    previousOccurrences24h?: number;
    force?: boolean;
    eligibility?: TriageEligibility;
  } = {}
): Promise<TriageResponse> {
  const { codeExcerpts = [], previousOccurrences24h, force = false, eligibility } = options;

  // Check eligibility unless forced
  if (!force) {
    const eligibilityCheck = isEligibleForTriage(issue, eligibility);
    if (!eligibilityCheck.eligible) {
      return {
        success: false,
        skipped_reason: eligibilityCheck.reason,
      };
    }
  }

  try {
    // Build analysis input
    const input = buildAnalysisInput(issue, events, appName, {
      codeExcerpts,
      previousOccurrences24h,
    });

    // Validate content is safe
    const userMessage = buildTriageUserMessage(input);
    const contentCheck = validateContentForAI(userMessage);
    if (!contentCheck.safe) {
      console.warn('[AI Triage] Content validation warnings:', contentCheck.issues);
      // Sanitize the content
      const sanitizedMessage = sanitizeForAI(userMessage);
      return await performTriage(input, sanitizedMessage);
    }

    return await performTriage(input, userMessage);
  } catch (error) {
    console.error('[AI Triage] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Perform the actual triage API call
 */
async function performTriage(
  _input: AIAnalysisInput,
  userMessage: string
): Promise<TriageResponse> {
  // Call Claude API
  const rawAnalysis = await generateStructuredCompletion<Record<string, unknown>>(
    TRIAGE_SYSTEM_PROMPT,
    userMessage,
    {
      maxTokens: 4096,
      temperature: 0.3,
    }
  );

  // Validate the analysis
  const validation = validateAnalysis(rawAnalysis);
  if (!validation.valid) {
    console.warn('[AI Triage] Analysis validation errors:', validation.errors);
    // Still return the analysis but note the issues
  }

  // Convert to AIAnalysis format
  const analysis: AIAnalysis = {
    analysis_id: uuidv4(),
    model_name: 'claude-sonnet-4-20250514',
    generated_at: new Date().toISOString(),
    classification: rawAnalysis.classification as AIAnalysis['classification'],
    severity: rawAnalysis.severity as Severity,
    severity_rationale: rawAnalysis.severity_rationale as string,
    impact_summary: rawAnalysis.impact_summary as string,
    evidence_refs: (rawAnalysis.evidence_refs as AIAnalysis['evidence_refs']) || [],
    root_cause_hypothesis: rawAnalysis.root_cause_hypothesis as string,
    fix_plan: (rawAnalysis.fix_plan as AIAnalysis['fix_plan']) || [],
    test_plan: (rawAnalysis.test_plan as AIAnalysis['test_plan']) || [],
    rollout_plan: rawAnalysis.rollout_plan as string,
    rollback_plan: rawAnalysis.rollback_plan as string,
    confidence: rawAnalysis.confidence as number,
    assumptions: (rawAnalysis.assumptions as string[]) || [],
    limitations: (rawAnalysis.limitations as string[]) || [],
    next_action: rawAnalysis.next_action as AIAnalysis['next_action'],
    next_action_rationale: rawAnalysis.next_action_rationale as string,
    additional_info_needed: rawAnalysis.additional_info_needed as string[] | undefined,
  };

  return {
    success: true,
    analysis,
  };
}

/**
 * Get triage summary for display
 */
export function getTriageSummary(analysis: AIAnalysis): string {
  const parts: string[] = [];

  parts.push(`**Classification:** ${analysis.classification}`);
  parts.push(`**Severity:** ${analysis.severity} (${analysis.severity_rationale})`);
  parts.push(`**Impact:** ${analysis.impact_summary}`);
  parts.push(`**Root Cause:** ${analysis.root_cause_hypothesis}`);
  parts.push(`**Confidence:** ${(analysis.confidence * 100).toFixed(0)}%`);
  parts.push(`**Next Action:** ${analysis.next_action}`);

  if (analysis.fix_plan.length > 0) {
    parts.push('\n**Fix Options:**');
    analysis.fix_plan.forEach((fix) => {
      parts.push(`  ${fix.option_number}. ${fix.description} (${fix.complexity} complexity)`);
    });
  }

  if (analysis.assumptions.length > 0) {
    parts.push('\n**Assumptions:**');
    analysis.assumptions.forEach((a) => parts.push(`  - ${a}`));
  }

  if (analysis.additional_info_needed && analysis.additional_info_needed.length > 0) {
    parts.push('\n**Additional Info Needed:**');
    analysis.additional_info_needed.forEach((info) => parts.push(`  - ${info}`));
  }

  return parts.join('\n');
}
