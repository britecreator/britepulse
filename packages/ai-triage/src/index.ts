/**
 * @britepulse/ai-triage
 * AI-powered issue triage using Claude
 */

export { initClient, getClient } from './client.js';
export {
  isEligibleForTriage,
  runTriage,
  getTriageSummary,
  type TriageEligibility,
} from './triage.js';
export { buildAnalysisInput, validateContentForAI, sanitizeForAI } from './evidence.js';
export { TRIAGE_SYSTEM_PROMPT, buildTriageUserMessage, validateAnalysis } from './prompts/triage.js';
