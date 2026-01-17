/**
 * AI Analysis Entity Types
 * Based on Build Contract Section 4.9
 */

import type { IssueType, NextAction, Severity } from './enums.js';

/**
 * Evidence reference for AI claims
 */
export interface EvidenceRef {
  type: 'event' | 'stack_trace' | 'code_excerpt' | 'metric' | 'feedback';
  ref_id?: string; // event_id, file path, etc.
  excerpt?: string; // relevant snippet (sanitized)
  line_numbers?: { start: number; end: number };
  relevance: string; // why this evidence supports the claim
}

/**
 * Fix option proposed by AI
 */
export interface FixOption {
  option_number: number; // 1, 2, or 3
  description: string;
  files_likely_touched: string[];
  complexity: 'low' | 'medium' | 'high';
  confidence: number; // 0.0-1.0 for this specific option
}

/**
 * Test plan item
 */
export interface TestPlanItem {
  test_type: 'unit' | 'integration' | 'e2e' | 'manual';
  description: string;
  priority: 'required' | 'recommended' | 'optional';
}

/**
 * AI Analysis entity (Section 4.9)
 * Structured output from AI triage
 */
export interface AIAnalysis {
  // Required fields
  analysis_id: string;
  model_name: string; // e.g., 'claude-3-opus'
  generated_at: string; // ISO timestamp

  // Classification
  classification: IssueType;
  severity: Severity;
  severity_rationale: string;

  // Analysis content
  impact_summary: string;
  evidence_refs: EvidenceRef[]; // required if claims made
  root_cause_hypothesis: string;

  // Proposed solutions
  fix_plan: FixOption[]; // 1-3 options
  test_plan: TestPlanItem[];
  rollout_plan: string;
  rollback_plan: string;

  // Confidence and caveats
  confidence: number; // 0.0-1.0
  assumptions: string[]; // explicit list of assumptions made
  limitations: string[]; // what the AI couldn't determine

  // Recommended action
  next_action: NextAction;
  next_action_rationale: string;

  // If more info needed
  additional_info_needed?: string[];
}

/**
 * AI Analysis input (context provided to the model)
 */
export interface AIAnalysisInput {
  issue_id: string;
  issue_title: string;
  issue_description: string; // sanitized
  issue_type: IssueType;
  current_severity: Severity;

  // Aggregated metrics
  occurrences_total: number;
  occurrences_24h: number;
  unique_users_24h_est: number;
  trend_direction: 'increasing' | 'stable' | 'decreasing';

  // Sanitized evidence
  sanitized_feedback?: string[];
  sanitized_stack_traces?: string[];
  retrieved_code_excerpts?: CodeExcerpt[];

  // Context
  app_name: string;
  environment: string;
  affected_routes?: string[];
  affected_versions?: string[];
}

/**
 * Code excerpt for AI context
 */
export interface CodeExcerpt {
  file_path: string;
  repo_id?: string;
  start_line: number;
  end_line: number;
  content: string; // must not contain secrets
  relevance: string; // why this code is relevant
}

/**
 * AI Triage request
 */
export interface TriageRequest {
  issue_id: string;
  force?: boolean; // re-run even if analysis exists
}

/**
 * AI Triage response
 */
export interface TriageResponse {
  success: boolean;
  analysis?: AIAnalysis;
  error?: string;
  skipped_reason?: string; // if not eligible for triage
}
