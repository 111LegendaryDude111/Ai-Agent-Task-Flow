#!/usr/bin/env npx ts-node
/**
 * Task Management CLI
 *
 * Usage: npx ts-node task-cli.ts <command> [feature] [args...]
 *
 * Commands:
 *   status [feature]              - Show task status summary
 *   next [feature]                - Show next eligible tasks
 *   parallel [feature]            - Show parallelizable tasks ready to run
 *   deps <feature> <seq>          - Show dependency tree for a task
 *   blocked [feature]             - Show blocked tasks and why
 *   start <feature> <seq>         - Mark a dependency-ready subtask in progress
 *   gate <feature> <seq> <gate>   - Record required AutoFlow gate evidence
 *   transition <feature> <state>  - Validate and store an AutoFlow state transition
 *   block <feature> [seq] "reason" - Mark a feature or subtask blocked
 *   unblock <feature> [seq]       - Reopen a blocked feature or subtask
 *   reopen <feature> <seq>        - Reopen completed/cancelled subtask
 *   cancel <feature> [seq] [reason] - Cancel a feature or subtask
 *   verify <feature> <seq>        - Run verification gate and save evidence
 *   verify-feature <feature>      - Run feature-level verification and save evidence
 *   complete <feature> <seq> "summary" - Mark task completed after successful verification
 *   archive <feature>             - Archive feature after successful feature verification
 *   validate [feature]            - Validate JSON files and dependencies
 *
 * Task files are stored in .tmp/tasks/ at the project root:
 *   .tmp/tasks/{feature-slug}/task.json
 *   .tmp/tasks/{feature-slug}/subtask_01.json
 *   .tmp/tasks/completed/{feature-slug}/
 */

const fs = require('fs');
const path = require('path');
const nodeCrypto = require('crypto');
const { execFileSync, spawnSync } = require('child_process');

// Find project root (look for .git or package.json)
function findProjectRoot(): string {
  let dir = process.cwd();
  while (dir !== path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, '.git')) || fs.existsSync(path.join(dir, 'package.json'))) {
      return dir;
    }
    dir = path.dirname(dir);
  }
  return process.cwd();
}

const PROJECT_ROOT = findProjectRoot();
const PLAYBOOK_ROOT = process.env.TASK_CLI_PLAYBOOK_ROOT || PROJECT_ROOT;
const TASKS_DIR = path.join(PROJECT_ROOT, '.tmp', 'tasks');
const COMPLETED_DIR = path.join(TASKS_DIR, 'completed');
const TASK_SCHEMA_PATH = path.join(PLAYBOOK_ROOT, 'context', 'core', 'task-management', 'schemas', 'task.schema.json');
const SUBTASK_SCHEMA_PATH = path.join(PLAYBOOK_ROOT, 'context', 'core', 'task-management', 'schemas', 'subtask.schema.json');
const AUTO_FLOW_STATE_MACHINE_PATH = path.join(PLAYBOOK_ROOT, 'context', 'core', 'workflows', 'auto-flow-state-machine.json');
const REQUIRED_AUTOFLOW_GATES = ['context_discovery', 'red', 'green', 'review'];
const AUDIT_ROOT = path.join(PROJECT_ROOT, '.tmp', 'audit', 'routing');

type ContextReference = string | {
  path: string;
  lines?: string;
  reason?: string;
};

interface AutoFlowState {
  state: string;
  gates?: Record<string, boolean>;
  history?: {
    from: string | null;
    to: string;
    at: string;
    reason?: string;
  }[];
}

interface Task {
  id: string;
  name: string;
  status: 'active' | 'completed' | 'blocked' | 'archived' | 'cancelled';
  objective: string;
  context_files: ContextReference[];
  reference_files?: ContextReference[];
  exit_criteria: string[];
  verification_spec?: VerificationSpec;
  subtask_count: number;
  completed_count: number;
  created_at: string;
  completed_at: string | null;
  verification?: Verification;
  autoflow?: AutoFlowState;
  blocked_reason?: string;
  cancelled_reason?: string;
}

interface Verification {
  status?: 'passed' | 'failed' | 'forced';
  verification_mode?: 'spec';
  spec_hash?: string;
  verified_at?: string;
  files_verified?: string[];
  changed_files_verified?: string[];
  file_hashes?: {
    path: string;
    sha256: string;
  }[];
  commands?: {
    id: string;
    passed: boolean;
    exit_code: number;
    evidence: string;
  }[];
  checks?: {
    id: string;
    passed: boolean;
    evidence: string;
  }[];
  exit_criteria_verified?: string[];
  git_diff_checked?: boolean;
  git_diff_summary?: string;
}

interface VerificationCommandSpec {
  id: string;
  run: string;
  expect_exit_code?: number;
}

interface VerificationCheckBase {
  id: string;
  path: string;
}

interface VerificationGrepPresentCheck extends VerificationCheckBase {
  type: 'grep_present';
  pattern: string;
  flags?: string;
}

interface VerificationGrepAbsentCheck extends VerificationCheckBase {
  type: 'grep_absent';
  pattern: string;
  flags?: string;
}

type VerificationCheckSpec = VerificationGrepPresentCheck | VerificationGrepAbsentCheck;

interface VerificationSpec {
  deliverables_must_exist?: string[];
  deliverables_must_change?: string[];
  commands?: VerificationCommandSpec[];
  checks?: VerificationCheckSpec[];
  exit_criteria_must_be_verified?: string[];
}

interface Subtask {
  id: string;
  seq: string;
  title: string;
  status: 'pending' | 'in_progress' | 'completed' | 'blocked' | 'cancelled';
  depends_on: string[];
  parallel: boolean;
  context_files: ContextReference[];
  reference_files?: ContextReference[];
  acceptance_criteria: string[];
  deliverables: string[];
  agent_id: string | null;
  suggested_agent?: string;
  verification_spec?: VerificationSpec;
  started_at: string | null;
  completed_at: string | null;
  completion_summary: string | null;
  verification?: Verification;
  autoflow?: AutoFlowState;
  blocked_reason?: string;
  cancelled_reason?: string;
}

// Helpers
function getFeatureDirs(): string[] {
  if (!fs.existsSync(TASKS_DIR)) return [];
  return fs.readdirSync(TASKS_DIR).filter((f: string) => {
    const fullPath = path.join(TASKS_DIR, f);
    return fs.statSync(fullPath).isDirectory() && f !== 'completed';
  });
}

function loadTask(feature: string): Task | null {
  const taskPath = path.join(TASKS_DIR, feature, 'task.json');
  if (!fs.existsSync(taskPath)) return null;
  return JSON.parse(fs.readFileSync(taskPath, 'utf-8'));
}

function loadSubtasks(feature: string): Subtask[] {
  const featureDir = path.join(TASKS_DIR, feature);
  if (!fs.existsSync(featureDir)) return [];

  const files = fs.readdirSync(featureDir)
    .filter((f: string) => f.match(/^subtask_\d{2}\.json$/))
    .sort();

  return files.map((f: string) => JSON.parse(fs.readFileSync(path.join(featureDir, f), 'utf-8')));
}

function saveSubtask(feature: string, subtask: Subtask): void {
  const subtaskPath = path.join(TASKS_DIR, feature, `subtask_${subtask.seq}.json`);
  fs.writeFileSync(subtaskPath, JSON.stringify(subtask, null, 2));
}

function saveTask(feature: string, task: Task): void {
  const taskPath = path.join(TASKS_DIR, feature, 'task.json');
  fs.writeFileSync(taskPath, JSON.stringify(task, null, 2));
}

function loadJsonFile(filePath: string): any | null {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function validateAgainstSimpleSchema(value: any, schema: any, pathLabel: string): string[] {
  const errors: string[] = [];

  const matchesType = (candidate: any, expectedType: any): boolean => {
    const expectedTypes = Array.isArray(expectedType) ? expectedType : [expectedType];
    return expectedTypes.some((typeName: string) => {
      if (typeName === 'array') return Array.isArray(candidate);
      if (typeName === 'null') return candidate === null;
      if (typeName === 'number') return typeof candidate === 'number' && Number.isFinite(candidate);
      return typeof candidate === typeName;
    });
  };

  for (const field of schema.required || []) {
    if (!Object.prototype.hasOwnProperty.call(value, field)) {
      errors.push(`${pathLabel}: schema missing required field '${field}'`);
    }
  }

  for (const [field, fieldSchema] of Object.entries<any>(schema.properties || {})) {
    if (!Object.prototype.hasOwnProperty.call(value, field) || value[field] === undefined) {
      continue;
    }

    const actualValue = value[field];
    if (fieldSchema.type && !matchesType(actualValue, fieldSchema.type)) {
      errors.push(`${pathLabel}: schema field '${field}' has invalid type`);
      continue;
    }

    if (fieldSchema.enum && !fieldSchema.enum.includes(actualValue)) {
      errors.push(`${pathLabel}: schema field '${field}' must be one of ${fieldSchema.enum.join(', ')}`);
    }

    if (fieldSchema.pattern && typeof actualValue === 'string' && !(new RegExp(fieldSchema.pattern).test(actualValue))) {
      errors.push(`${pathLabel}: schema field '${field}' does not match ${fieldSchema.pattern}`);
    }

    if (fieldSchema.items && Array.isArray(actualValue)) {
      actualValue.forEach((item: any, index: number) => {
        if (fieldSchema.items.type && !matchesType(item, fieldSchema.items.type)) {
          errors.push(`${pathLabel}: schema field '${field}[${index}]' has invalid type`);
        }
      });
    }
  }

  return errors;
}

function loadStateMachine(): any | null {
  return loadJsonFile(AUTO_FLOW_STATE_MACHINE_PATH);
}

function getKnownAutoFlowStates(): Set<string> {
  const machine = loadStateMachine();
  return new Set((machine?.states || []).map((state: any) => state.id));
}

function canTransitionAutoFlow(from: string | null, to: string): { allowed: boolean; reason?: string } {
  const machine = loadStateMachine();
  if (!machine) {
    return { allowed: false, reason: `state machine not found at ${AUTO_FLOW_STATE_MACHINE_PATH}` };
  }

  const states = machine.states || [];
  const knownStates = new Set(states.map((state: any) => state.id));
  if (!knownStates.has(to)) {
    return { allowed: false, reason: `unknown target state '${to}'` };
  }

  if (!from) {
    return { allowed: to === machine.entry_state, reason: to === machine.entry_state ? undefined : `initial state must be ${machine.entry_state}` };
  }

  const current = states.find((state: any) => state.id === from);
  if (!current) {
    return { allowed: false, reason: `unknown current state '${from}'` };
  }

  const allowedTargets = (current.transitions || []).map((transition: any) => transition.to);
  return {
    allowed: allowedTargets.includes(to),
    reason: allowedTargets.includes(to) ? undefined : `transition ${from} -> ${to} is not allowed by auto-flow-state-machine.json`,
  };
}

function transitionAutoFlowState(owner: { autoflow?: AutoFlowState }, to: string, reason?: string, options: { allowInitial?: boolean } = {}): void {
  const from = owner.autoflow?.state || null;
  if (from || options.allowInitial) {
    const transition = canTransitionAutoFlow(from, to);
    if (!transition.allowed) {
      throw new Error(transition.reason || `transition ${from || '<none>'} -> ${to} is not allowed`);
    }
  }

  owner.autoflow = owner.autoflow || { state: to, gates: {}, history: [] };
  owner.autoflow.history = owner.autoflow.history || [];
  owner.autoflow.history.push({ from, to, at: new Date().toISOString(), reason });
  owner.autoflow.state = to;
}

function ensureAutoFlowGate(subtask: Subtask, gate: string): void {
  subtask.autoflow = subtask.autoflow || { state: 'write_failing_test', gates: {}, history: [] };
  subtask.autoflow.gates = subtask.autoflow.gates || {};
  subtask.autoflow.gates[gate] = true;
}

function missingAutoFlowGates(subtask: Subtask): string[] {
  const gates = subtask.autoflow?.gates || {};
  return REQUIRED_AUTOFLOW_GATES.filter(gate => gates[gate] !== true);
}

function sanitizeAuditValue(value: any): any {
  if (Array.isArray(value)) {
    return value.map(sanitizeAuditValue);
  }
  if (value && typeof value === 'object') {
    return Object.keys(value).reduce((acc: Record<string, any>, key: string) => {
      if (/(api[_-]?key|token|secret|password|authorization)/i.test(key)) {
        acc[key] = '[REDACTED]';
      } else {
        acc[key] = sanitizeAuditValue(value[key]);
      }
      return acc;
    }, {});
  }
  if (typeof value === 'string') {
    return value
      .replace(/sk-[A-Za-z0-9_-]{8,}/g, '[REDACTED]')
      .replace(/ghp_[A-Za-z0-9_]{8,}/g, '[REDACTED]')
      .replace(/AIza[A-Za-z0-9_-]{12,}/g, '[REDACTED]')
      .replace(new RegExp('/' + 'Users' + "/[^\\s\\\"']+", 'g'), '[REDACTED]');
  }
  return value;
}

function writeAuditEvent(event: Record<string, any>): void {
  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  const sessionId = String(event.session_id || process.env.AUDIT_SESSION_ID || 'task-cli-local').replace(/[^A-Za-z0-9_.-]/g, '-').slice(0, 80);
  const outputDir = path.join(AUDIT_ROOT, date);
  fs.mkdirSync(outputDir, { recursive: true });
  const outputPath = path.join(outputDir, `${sessionId || 'task-cli-local'}.jsonl`);
  const payload = sanitizeAuditValue({
    timestamp: event.timestamp || now.toISOString(),
    session_id: sessionId || 'task-cli-local',
    event_type: event.event_type || 'unknown',
    input_facts: event.input_facts || {},
    matched_rule: event.matched_rule || null,
    action: event.action || null,
    agent: event.agent || null,
    result: event.result || null,
    metadata: event.metadata || {},
  });
  fs.appendFileSync(outputPath, JSON.stringify(payload) + '\n', 'utf-8');
}

function getCompletedSeqs(subtasks: Subtask[]): Set<string> {
  return new Set(subtasks.filter(s => s.status === 'completed').map(s => s.seq));
}

function getUnmetDependencies(subtask: Subtask, subtasks: Subtask[]): string[] {
  const completedSeqs = getCompletedSeqs(subtasks);
  return subtask.depends_on.filter(dep => !completedSeqs.has(dep));
}

function toRepoRelativePath(targetPath: string): string | null {
  const resolvedPath = path.resolve(resolvePath(targetPath));
  const projectRoot = path.resolve(PROJECT_ROOT);
  const projectRootWithSep = projectRoot.endsWith(path.sep)
    ? projectRoot
    : `${projectRoot}${path.sep}`;

  if (resolvedPath === projectRoot) {
    return '.';
  }

  if (!resolvedPath.startsWith(projectRootWithSep)) {
    return null;
  }

  return path.relative(projectRoot, resolvedPath) || '.';
}

function hasPassedVerification(verification?: Verification): boolean {
  return verification?.status === 'passed';
}

function normalizeStringArray(values: string[]): string[] {
  return Array.from(new Set(values.map(value => value.trim()).filter(Boolean))).sort();
}

function arraysEqual(left: string[], right: string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((value, index) => value === right[index]);
}

function evaluateFeatureVerificationReadiness(task: Task, subtasks: Subtask[]): { ready: boolean; reason?: string } {
  const incompleteSubtasks = subtasks
    .filter(s => s.status !== 'completed')
    .map(s => s.seq);

  if (incompleteSubtasks.length > 0) {
    return {
      ready: false,
      reason: `Незавершённые подзадачи: ${incompleteSubtasks.join(', ')}`,
    };
  }

  const unverifiedSubtasks = subtasks
    .filter(s => s.status === 'completed' && !hasPassedVerification(s.verification))
    .map(s => s.seq);

  if (unverifiedSubtasks.length > 0) {
    return {
      ready: false,
      reason: `Подзадачи без успешной верификации: ${unverifiedSubtasks.join(', ')}`,
    };
  }

  return { ready: true };
}

function resolvePath(p: string): string {
  if (p.startsWith('~')) {
    return path.join(process.env.HOME || '', p.slice(1));
  }
  if (p.startsWith('/') || p.match(/^[A-Z]:/i)) {
    return p;
  }
  return path.join(PROJECT_ROOT, p);
}

async function checkDeliverables(deliverables: string[]): Promise<{ passed: boolean; details: string[] }> {
  const details: string[] = [];
  let allExist = true;

  if (deliverables.length === 0) {
    return {
      passed: true,
      details: ['No deliverable existence checks configured'],
    };
  }

  for (const deliverable of deliverables) {
    const resolvedPath = resolvePath(deliverable);
    const exists = fs.existsSync(resolvedPath);

    if (exists) {
      const stat = fs.statSync(resolvedPath);
      const size = stat.isFile() ? ` (${stat.size} bytes)` : ' (directory)';
      details.push(`✅ ${deliverable}${size}`);
    } else {
      details.push(`❌ ${deliverable} - NOT FOUND`);
      allExist = false;
    }
  }

  return { passed: allExist, details };
}

function toStableValue(value: any): any {
  if (Array.isArray(value)) {
    return value.map(item => toStableValue(item));
  }

  if (value && typeof value === 'object') {
    return Object.keys(value)
      .sort()
      .reduce((acc: Record<string, any>, key: string) => {
        acc[key] = toStableValue(value[key]);
        return acc;
      }, {});
  }

  return value;
}

function stableStringify(value: any): string {
  return JSON.stringify(toStableValue(value));
}

function sha256(input: string | Buffer): string {
  return nodeCrypto.createHash('sha256').update(input).digest('hex');
}

function uniquePaths(paths: string[]): string[] {
  return Array.from(new Set(paths.filter(Boolean)));
}

function getVerificationSpec(owner: { verification_spec?: VerificationSpec }): VerificationSpec | null {
  return owner.verification_spec || null;
}

function validateVerificationSpec(specOwner: { verification_spec?: VerificationSpec }): string[] {
  const spec = getVerificationSpec(specOwner);
  if (!spec) {
    return ['missing verification_spec'];
  }

  const errors: string[] = [];
  let configuredChecks = 0;

  if (spec.deliverables_must_exist !== undefined) {
    if (!Array.isArray(spec.deliverables_must_exist) || spec.deliverables_must_exist.some(item => typeof item !== 'string' || !item.trim())) {
      errors.push('verification_spec.deliverables_must_exist must be string[]');
    } else {
      configuredChecks += spec.deliverables_must_exist.length;
    }
  }

  if (spec.deliverables_must_change !== undefined) {
    if (!Array.isArray(spec.deliverables_must_change) || spec.deliverables_must_change.some(item => typeof item !== 'string' || !item.trim())) {
      errors.push('verification_spec.deliverables_must_change must be string[]');
    } else {
      configuredChecks += spec.deliverables_must_change.length;
    }
  }

  if (spec.commands !== undefined) {
    if (!Array.isArray(spec.commands)) {
      errors.push('verification_spec.commands must be an array');
    } else {
      configuredChecks += spec.commands.length;
      for (const command of spec.commands) {
        if (!command || typeof command !== 'object') {
          errors.push('verification_spec.commands entries must be objects');
          continue;
        }

        if (typeof command.id !== 'string' || !command.id.trim()) {
          errors.push('verification_spec.commands[].id must be a non-empty string');
        }
        if (typeof command.run !== 'string' || !command.run.trim()) {
          errors.push('verification_spec.commands[].run must be a non-empty string');
        }
        if (command.expect_exit_code !== undefined && typeof command.expect_exit_code !== 'number') {
          errors.push(`verification_spec.commands[${command.id || '?'}].expect_exit_code must be a number`);
        }
      }
    }
  }

  if (spec.checks !== undefined) {
    if (!Array.isArray(spec.checks)) {
      errors.push('verification_spec.checks must be an array');
    } else {
      configuredChecks += spec.checks.length;
      for (const check of spec.checks) {
        if (!check || typeof check !== 'object') {
          errors.push('verification_spec.checks entries must be objects');
          continue;
        }

        const checkId = typeof (check as any).id === 'string' ? (check as any).id : '?';

        if (typeof check.id !== 'string' || !check.id.trim()) {
          errors.push('verification_spec.checks[].id must be a non-empty string');
        }
        if (typeof check.path !== 'string' || !check.path.trim()) {
          errors.push(`verification_spec.checks[${checkId}].path must be a non-empty string`);
        }
        if (check.type !== 'grep_present' && check.type !== 'grep_absent') {
          errors.push(`verification_spec.checks[${checkId}].type must be grep_present or grep_absent`);
        }
        if (typeof (check as VerificationGrepPresentCheck).pattern !== 'string' || !(check as VerificationGrepPresentCheck).pattern.trim()) {
          errors.push(`verification_spec.checks[${checkId}].pattern must be a non-empty string`);
        }
        if (check.type && check.type.startsWith('grep') && check.flags !== undefined && typeof check.flags !== 'string') {
          errors.push(`verification_spec.checks[${checkId}].flags must be a string when present`);
        }
      }
    }
  }

  if (spec.exit_criteria_must_be_verified !== undefined) {
    if (!Array.isArray(spec.exit_criteria_must_be_verified) || spec.exit_criteria_must_be_verified.some(item => typeof item !== 'string' || !item.trim())) {
      errors.push('verification_spec.exit_criteria_must_be_verified must be string[]');
    } else {
      configuredChecks += spec.exit_criteria_must_be_verified.length;
    }
  }

  if (configuredChecks === 0) {
    errors.push('verification_spec must define at least one deterministic verification check');
  }

  return errors;
}

function validateTaskExitCriteriaBinding(task: Task): string[] {
  const normalizedExitCriteria = normalizeStringArray(task.exit_criteria || []);

  if (normalizedExitCriteria.length === 0) {
    return [];
  }

  const spec = getVerificationSpec(task);
  if (!spec) {
    return ['task verification_spec is missing, so exit_criteria cannot be machine-verified'];
  }

  const normalizedSpecCriteria = normalizeStringArray(spec.exit_criteria_must_be_verified || []);
  if (normalizedSpecCriteria.length === 0) {
    return ['task exit_criteria must be mirrored in verification_spec.exit_criteria_must_be_verified'];
  }

  if (!arraysEqual(normalizedExitCriteria, normalizedSpecCriteria)) {
    return ['task exit_criteria must exactly match verification_spec.exit_criteria_must_be_verified'];
  }

  return [];
}

function getSpecHash(payload: Record<string, any>): string {
  return `sha256:${sha256(stableStringify(payload))}`;
}

function getSubtaskVerificationSpecHash(subtask: Subtask, spec: VerificationSpec): string {
  const payload = {
    id: subtask.id,
    deliverables: subtask.deliverables,
    acceptance_criteria: subtask.acceptance_criteria,
    verification_spec: spec,
  };

  return getSpecHash(payload);
}

function getTaskVerificationSpecHash(task: Task): string | null {
  const spec = getVerificationSpec(task);
  if (!spec) {
    return null;
  }

  return getSpecHash({
    id: task.id,
    objective: task.objective,
    exit_criteria: task.exit_criteria,
    verification_spec: spec,
  });
}

function collectVerificationPaths(spec: VerificationSpec): string[] {
  const deliverablesToExist = spec.deliverables_must_exist || [];
  const deliverablesToChange = spec.deliverables_must_change || [];
  const checkPaths = (spec.checks || []).map(check => check.path);
  return uniquePaths([...deliverablesToExist, ...deliverablesToChange, ...checkPaths]);
}

function summarizeOutput(output: string | undefined, maxLines: number = 6): string {
  if (!output) {
    return 'no output';
  }

  const lines = output
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .slice(-maxLines);

  return lines.length > 0 ? lines.join(' | ') : 'no output';
}

function hashResolvedPath(resolvedPath: string, rootPath: string = resolvedPath): string {
  const stat = fs.statSync(resolvedPath);

  if (stat.isFile()) {
    return sha256(fs.readFileSync(resolvedPath));
  }

  if (stat.isDirectory()) {
    const entries = fs.readdirSync(resolvedPath).sort();
    const manifest: string[] = [];

    for (const entry of entries) {
      const childPath = path.join(resolvedPath, entry);
      const relativeChildPath = path.relative(rootPath, childPath).replace(/\\/g, '/');
      manifest.push(`${relativeChildPath}:${hashResolvedPath(childPath, rootPath)}`);
    }

    return sha256(`dir:${manifest.join('|')}`);
  }

  return sha256(`other:${resolvedPath}`);
}

function buildFileFingerprints(paths: string[]): { path: string; sha256: string }[] {
  const fingerprints: { path: string; sha256: string }[] = [];

  for (const targetPath of uniquePaths(paths)) {
    const repoRelativePath = toRepoRelativePath(targetPath);
    if (!repoRelativePath) {
      throw new Error(`${targetPath} is outside project root`);
    }

    const resolvedPath = resolvePath(targetPath);
    if (!fs.existsSync(resolvedPath)) {
      continue;
    }

    fingerprints.push({
      path: repoRelativePath,
      sha256: hashResolvedPath(resolvedPath),
    });
  }

  return fingerprints.sort((a, b) => a.path.localeCompare(b.path));
}

function compareFileFingerprints(stored: { path: string; sha256: string }[], current: { path: string; sha256: string }[]): { passed: boolean; details: string[] } {
  const details: string[] = [];
  const currentByPath = new Map(current.map(item => [item.path, item.sha256]));
  let passed = true;

  for (const fingerprint of stored) {
    const currentHash = currentByPath.get(fingerprint.path);
    if (!currentHash) {
      passed = false;
      details.push(`❌ ${fingerprint.path} is missing after verification`);
      continue;
    }

    if (currentHash !== fingerprint.sha256) {
      passed = false;
      details.push(`❌ ${fingerprint.path} changed after verification; re-run verify`);
      continue;
    }

    details.push(`✅ ${fingerprint.path} unchanged since verification`);
  }

  return { passed, details };
}

async function checkGitDiff(deliverables: string[]): Promise<{ passed: boolean; details: string[]; summary?: string; changedPaths: string[] }> {
  if (deliverables.length === 0) {
    return {
      passed: true,
      details: ['No git diff checks configured'],
      summary: undefined,
      changedPaths: [],
    };
  }

  const repoRelativeDeliverables: string[] = [];
  const details: string[] = [];

  for (const deliverable of deliverables) {
    const relativePath = toRepoRelativePath(deliverable);
    if (!relativePath) {
      return {
        passed: false,
        details: [`❌ ${deliverable} is outside project root - cannot verify git changes for this deliverable`],
        summary: undefined,
        changedPaths: [],
      };
    }

    repoRelativeDeliverables.push(relativePath);
  }

  try {
    const result = execFileSync('git', ['status', '--porcelain', '--', ...repoRelativeDeliverables], {
      cwd: PROJECT_ROOT,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe']
    });

    if (!result.trim()) {
      return {
        passed: false,
        details: ['❌ No git changes detected in declared deliverables'],
        summary: '',
        changedPaths: [],
      };
    }

    const lines = result.trim().split('\n').filter((line: string) => line.trim());
    const changedPaths: string[] = [];
    for (const line of lines) {
      const trimmedLine = line.trim();
      details.push(`✅ ${trimmedLine}`);
      changedPaths.push(trimmedLine.slice(3).trim());
    }

    let summary = lines.length === 1
      ? lines[0].trim()
      : `${lines.length} deliverable paths changed`;

    const shortStat = execFileSync('git', ['diff', '--stat', '--', ...repoRelativeDeliverables], {
      cwd: PROJECT_ROOT,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe']
    }).trim().split('\n').filter(Boolean).slice(-1)[0] || '';

    if (shortStat) {
      summary = shortStat;
    }

    return {
      passed: true,
      details: [`✅ Git changes detected in deliverables: ${summary}`, ...details],
      summary,
      changedPaths,
    };
  } catch (error: any) {
    const stderr = error?.stderr?.toString?.().trim();
    return {
      passed: false,
      details: [stderr ? `❌ Git diff check failed: ${stderr}` : '❌ Git diff check failed'],
      summary: undefined,
      changedPaths: [],
    };
  }
}

interface VerificationResults {
  specHash: string | null;
  specValidation: { passed: boolean; details: string[] };
  deliverablesCheck: { passed: boolean; details: string[]; verifiedPaths: string[] };
  gitDiffCheck: { passed: boolean; details: string[]; summary?: string; changedPaths: string[] };
  commandsCheck: {
    passed: boolean;
    details: string[];
    results: { id: string; passed: boolean; exit_code: number; evidence: string }[];
  };
  customChecks: {
    passed: boolean;
    details: string[];
    results: { id: string; passed: boolean; evidence: string }[];
  };
  fileFingerprints: { path: string; sha256: string }[];
  allPassed: boolean;
}

function runVerificationCommands(commands: VerificationCommandSpec[], options: { skipCommands?: boolean } = {}): { passed: boolean; details: string[]; results: { id: string; passed: boolean; exit_code: number; evidence: string }[] } {
  if (commands.length === 0) {
    return {
      passed: true,
      details: ['No verification commands configured'],
      results: [],
    };
  }

  if (options.skipCommands) {
    return {
      passed: false,
      details: ['❌ Verification commands were skipped by manual override'],
      results: commands.map(command => ({
        id: command.id,
        passed: false,
        exit_code: -1,
        evidence: 'command execution skipped',
      })),
    };
  }

  const details: string[] = [];
  const results: { id: string; passed: boolean; exit_code: number; evidence: string }[] = [];
  let allPassed = true;

  for (const command of commands) {
    console.log(`\n🔄 Running verification command [${command.id}]: ${command.run}`);
    const execution = spawnSync(command.run, {
      cwd: PROJECT_ROOT,
      encoding: 'utf-8',
      shell: true,
      windowsHide: true,
    });

    const exitCode = typeof execution.status === 'number' ? execution.status : 1;
    const expectedExitCode = command.expect_exit_code ?? 0;
    const combinedOutput = [execution.stdout, execution.stderr].filter(Boolean).join('\n');
    const evidence = summarizeOutput(combinedOutput, 8);
    const passed = exitCode === expectedExitCode;

    results.push({
      id: command.id,
      passed,
      exit_code: exitCode,
      evidence,
    });

    if (passed) {
      details.push(`✅ ${command.id} exited with ${exitCode}`);
    } else {
      details.push(`❌ ${command.id} exited with ${exitCode}, expected ${expectedExitCode}`);
      allPassed = false;
    }
  }

  return { passed: allPassed, details, results };
}

function runVerificationChecks(checks: VerificationCheckSpec[]): { passed: boolean; details: string[]; results: { id: string; passed: boolean; evidence: string }[] } {
  if (checks.length === 0) {
    return {
      passed: true,
      details: ['No custom verification checks configured'],
      results: [],
    };
  }

  const details: string[] = [];
  const results: { id: string; passed: boolean; evidence: string }[] = [];
  let allPassed = true;

  for (const check of checks) {
    const resolvedPath = resolvePath(check.path);
    if (!fs.existsSync(resolvedPath) || !fs.statSync(resolvedPath).isFile()) {
      details.push(`❌ ${check.id}: file not found or not a file (${check.path})`);
      results.push({ id: check.id, passed: false, evidence: 'file missing' });
      allPassed = false;
      continue;
    }

    let passed = false;
    let evidence = '';

    try {
      const content = fs.readFileSync(resolvedPath, 'utf-8');
      const regex = new RegExp(check.pattern, check.flags || '');
      const matched = regex.test(content);

      if (check.type === 'grep_present') {
        passed = matched;
        evidence = matched ? `pattern ${check.pattern} found in ${check.path}` : `pattern ${check.pattern} not found in ${check.path}`;
      } else {
        passed = !matched;
        evidence = matched ? `pattern ${check.pattern} unexpectedly found in ${check.path}` : `pattern ${check.pattern} absent in ${check.path}`;
      }
    } catch (error: any) {
      passed = false;
      evidence = `check error: ${error.message}`;
    }

    results.push({ id: check.id, passed, evidence });
    details.push(`${passed ? '✅' : '❌'} ${check.id}: ${evidence}`);

    if (!passed) {
      allPassed = false;
    }
  }

  return { passed: allPassed, details, results };
}

async function runVerificationGateForSpec(spec: VerificationSpec | null, specValidationErrors: string[], specHash: string | null, options: { skipCommands?: boolean } = {}): Promise<VerificationResults> {
  console.log('\n🔍 VERIFICATION GATE');
  console.log('═══════════════════════════════════════════════════════════════');

  const results: VerificationResults = {
    specHash,
    specValidation: { passed: specValidationErrors.length === 0, details: specValidationErrors.length > 0 ? specValidationErrors : ['verification_spec is valid'] },
    deliverablesCheck: { passed: false, details: [], verifiedPaths: [] },
    gitDiffCheck: { passed: false, details: [], summary: undefined, changedPaths: [] },
    commandsCheck: { passed: false, details: [], results: [] },
    customChecks: { passed: false, details: [], results: [] },
    fileFingerprints: [],
    allPassed: false,
  };

  console.log('\n[1/5] Validating verification spec...');
  for (const detail of results.specValidation.details) {
    console.log(`  ${results.specValidation.passed ? '✅' : '❌'} ${detail}`);
  }

  if (!spec || !results.specValidation.passed) {
    results.allPassed = false;
    console.log('\n═══════════════════════════════════════════════════════════════');
    return results;
  }

  console.log('\n[2/5] Checking declared deliverables...');
  results.deliverablesCheck = {
    ...(await checkDeliverables(spec.deliverables_must_exist || [])),
    verifiedPaths: uniquePaths(spec.deliverables_must_exist || []),
  };
  for (const detail of results.deliverablesCheck.details) {
    console.log(`  ${detail}`);
  }

  console.log('\n[3/5] Checking git changes...');
  results.gitDiffCheck = await checkGitDiff(spec.deliverables_must_change || []);
  for (const detail of results.gitDiffCheck.details) {
    console.log(`  ${detail}`);
  }

  console.log('\n[4/5] Running verification commands...');
  results.commandsCheck = runVerificationCommands(spec.commands || [], options);
  for (const detail of results.commandsCheck.details) {
    console.log(`  ${detail}`);
  }

  console.log('\n[5/5] Running custom verification checks...');
  results.customChecks = runVerificationChecks(spec.checks || []);
  for (const detail of results.customChecks.details) {
    console.log(`  ${detail}`);
  }

  try {
    results.fileFingerprints = buildFileFingerprints(collectVerificationPaths(spec));
  } catch (error: any) {
    results.customChecks.passed = false;
    results.customChecks.details.push(`❌ File fingerprinting failed: ${error.message}`);
    results.customChecks.results.push({
      id: 'file-fingerprinting',
      passed: false,
      evidence: error.message,
    });
  }

  results.allPassed =
    results.specValidation.passed &&
    results.deliverablesCheck.passed &&
    results.gitDiffCheck.passed &&
    results.commandsCheck.passed &&
    results.customChecks.passed;

  console.log('\n═══════════════════════════════════════════════════════════════');

  return results;
}

async function runVerificationGate(subtask: Subtask, options: { skipCommands?: boolean } = {}): Promise<VerificationResults> {
  const spec = getVerificationSpec(subtask);
  const specValidationErrors = validateVerificationSpec(subtask);
  const specHash = spec && specValidationErrors.length === 0
    ? getSubtaskVerificationSpecHash(subtask, spec)
    : null;

  return runVerificationGateForSpec(spec, specValidationErrors, specHash, options);
}

async function runFeatureVerificationGate(task: Task, options: { skipCommands?: boolean } = {}): Promise<VerificationResults> {
  const spec = getVerificationSpec(task);
  const specValidationErrors = [
    ...validateVerificationSpec(task),
    ...validateTaskExitCriteriaBinding(task),
  ];
  const specHash = spec && specValidationErrors.length === 0
    ? getTaskVerificationSpecHash(task)
    : null;

  return runVerificationGateForSpec(spec, specValidationErrors, specHash, options);
}

function printVerificationReport(results: VerificationResults): void {
  if (!results.specValidation.passed) {
    console.log('\n❌ Verification spec is invalid:');
    for (const detail of results.specValidation.details) {
      console.log(`   ${detail}`);
    }
  }

  if (!results.deliverablesCheck.passed) {
    console.log('\n❌ Deliverables missing:');
    for (const detail of results.deliverablesCheck.details.filter(d => d.startsWith('❌'))) {
      console.log(`   ${detail}`);
    }
  }

  if (!results.gitDiffCheck.passed) {
    console.log('\n❌ Git diff check failed:');
    for (const detail of results.gitDiffCheck.details) {
      console.log(`   ${detail}`);
    }
  }

  if (!results.commandsCheck.passed) {
    console.log('\n❌ Verification commands failed:');
    for (const detail of results.commandsCheck.details) {
      console.log(`   ${detail}`);
    }
  }

  if (!results.customChecks.passed) {
    console.log('\n❌ Custom verification checks failed:');
    for (const detail of results.customChecks.details) {
      console.log(`   ${detail}`);
    }
  }
}

// Commands
function cmdStatus(feature?: string): void {
  const features = feature ? [feature] : getFeatureDirs();

  if (features.length === 0) {
    console.log('No active features found.');
    return;
  }

  for (const f of features) {
    const task = loadTask(f);
    const subtasks = loadSubtasks(f);

    if (!task) {
      console.log(`\n[${f}] - No task.json found`);
      continue;
    }

    const counts = {
      pending: subtasks.filter(s => s.status === 'pending').length,
      in_progress: subtasks.filter(s => s.status === 'in_progress').length,
      completed: subtasks.filter(s => s.status === 'completed').length,
      blocked: subtasks.filter(s => s.status === 'blocked').length,
    };

    const progress = subtasks.length > 0
      ? Math.round((counts.completed / subtasks.length) * 100)
      : 0;

    console.log(`\n[${f}] ${task.name}`);
    console.log(`  Status: ${task.status} | Progress: ${progress}% (${counts.completed}/${subtasks.length})`);
    console.log(`  Pending: ${counts.pending} | In Progress: ${counts.in_progress} | Completed: ${counts.completed} | Blocked: ${counts.blocked}`);
    if (task.verification?.status) {
      console.log(`  Feature Verification: ${task.verification.status}${task.verification.verified_at ? ` @ ${task.verification.verified_at}` : ''}`);
    }
  }
}

function cmdNext(feature?: string): void {
  const features = feature ? [feature] : getFeatureDirs();

  console.log('\n=== Ready Tasks (deps satisfied) ===\n');

  for (const f of features) {
    const subtasks = loadSubtasks(f);
    const completedSeqs = new Set(subtasks.filter(s => s.status === 'completed').map(s => s.seq));

    const ready = subtasks.filter(s => {
      if (s.status !== 'pending') return false;
      return s.depends_on.every(dep => completedSeqs.has(dep));
    });

    if (ready.length > 0) {
      console.log(`[${f}]`);
      for (const s of ready) {
        const parallel = s.parallel ? '[parallel]' : '[sequential]';
        console.log(`  ${s.seq} - ${s.title}  ${parallel}`);
      }
      console.log();
    }
  }
}

function cmdParallel(feature?: string): void {
  const features = feature ? [feature] : getFeatureDirs();

  console.log('\n=== Parallelizable Tasks Ready Now ===\n');

  for (const f of features) {
    const subtasks = loadSubtasks(f);
    const completedSeqs = new Set(subtasks.filter(s => s.status === 'completed').map(s => s.seq));

    const parallel = subtasks.filter(s => {
      if (s.status !== 'pending') return false;
      if (!s.parallel) return false;
      return s.depends_on.every(dep => completedSeqs.has(dep));
    });

    if (parallel.length > 0) {
      console.log(`[${f}] - ${parallel.length} parallel tasks:`);
      for (const s of parallel) {
        console.log(`  ${s.seq} - ${s.title}`);
      }
      console.log();
    }
  }
}

function cmdDeps(feature: string, seq: string): void {
  const subtasks = loadSubtasks(feature);
  const target = subtasks.find(s => s.seq === seq);

  if (!target) {
    console.log(`Task ${seq} not found in ${feature}`);
    return;
  }

  console.log(`\n=== Dependency Tree: ${feature}/${seq} ===\n`);
  console.log(`${seq} - ${target.title} [${target.status}]`);

  if (target.depends_on.length === 0) {
    console.log('  └── (no dependencies)');
    return;
  }

  const printDeps = (seqs: string[], indent: string = '  '): void => {
    for (let i = 0; i < seqs.length; i++) {
      const depSeq = seqs[i];
      const dep = subtasks.find(s => s.seq === depSeq);
      const isLast = i === seqs.length - 1;
      const branch = isLast ? '└──' : '├──';

      if (dep) {
        const statusIcon = dep.status === 'completed' ? '✓' : dep.status === 'in_progress' ? '~' : '○';
        console.log(`${indent}${branch} ${statusIcon} ${depSeq} - ${dep.title} [${dep.status}]`);
        if (dep.depends_on.length > 0) {
          const newIndent = indent + (isLast ? '    ' : '│   ');
          printDeps(dep.depends_on, newIndent);
        }
      } else {
        console.log(`${indent}${branch} ? ${depSeq} - NOT FOUND`);
      }
    }
  };

  printDeps(target.depends_on);
}

function cmdBlocked(feature?: string): void {
  const features = feature ? [feature] : getFeatureDirs();

  console.log('\n=== Blocked Tasks ===\n');

  for (const f of features) {
    const subtasks = loadSubtasks(f);
    const completedSeqs = new Set(subtasks.filter(s => s.status === 'completed').map(s => s.seq));

    const blocked = subtasks.filter(s => {
      if (s.status === 'blocked') return true;
      if (s.status !== 'pending') return false;
      return !s.depends_on.every(dep => completedSeqs.has(dep));
    });

    if (blocked.length > 0) {
      console.log(`[${f}]`);
      for (const s of blocked) {
        const waitingFor = s.depends_on.filter(dep => !completedSeqs.has(dep));
        const reason = s.status === 'blocked'
          ? (s.blocked_reason || 'explicitly blocked')
          : `waiting: ${waitingFor.join(', ')}`;
        console.log(`  ${s.seq} - ${s.title} (${reason})`);
      }
      console.log();
    }
  }
}

function getSubtaskOrExit(feature: string, seq: string): { subtasks: Subtask[]; subtask: Subtask } {
  const subtasks = loadSubtasks(feature);
  const subtask = subtasks.find(s => s.seq === seq);
  if (!subtask) {
    console.log(`Task ${seq} not found in ${feature}`);
    process.exit(1);
  }
  return { subtasks, subtask };
}

function cmdStart(feature: string, seq: string, agentId?: string): void {
  const { subtasks, subtask } = getSubtaskOrExit(feature, seq);
  if (subtask.status !== 'pending') {
    console.log(`Error: Task ${feature}/${seq} must be pending before start. Current status: ${subtask.status}`);
    process.exit(1);
  }

  const unmetDependencies = getUnmetDependencies(subtask, subtasks);
  if (unmetDependencies.length > 0) {
    console.log(`Error: Task ${feature}/${seq} cannot start while dependencies are incomplete: ${unmetDependencies.join(', ')}`);
    process.exit(1);
  }

  subtask.status = 'in_progress';
  subtask.started_at = new Date().toISOString();
  subtask.agent_id = agentId || subtask.suggested_agent || subtask.agent_id || null;
  subtask.autoflow = subtask.autoflow || { state: 'write_failing_test', gates: {}, history: [] };
  subtask.autoflow.state = 'write_failing_test';
  subtask.autoflow.history = subtask.autoflow.history || [];
  subtask.autoflow.history.push({ from: null, to: 'write_failing_test', at: new Date().toISOString(), reason: 'start subtask' });
  saveSubtask(feature, subtask);

  writeAuditEvent({
    event_type: 'lifecycle_transition',
    input_facts: { feature, seq },
    action: 'start',
    agent: subtask.agent_id || 'TaskManager',
    result: 'in_progress',
  });
  console.log(`Started ${feature}/${seq}`);
}

function cmdGate(feature: string, seq: string, gate: string, evidence: string = ''): void {
  if (!REQUIRED_AUTOFLOW_GATES.includes(gate) && gate !== 'verify' && gate !== 'complete') {
    console.log(`Error: Unknown gate '${gate}'. Use one of: ${[...REQUIRED_AUTOFLOW_GATES, 'verify', 'complete'].join(', ')}`);
    process.exit(1);
  }

  const { subtask } = getSubtaskOrExit(feature, seq);
  ensureAutoFlowGate(subtask, gate);
  subtask.autoflow!.history = subtask.autoflow!.history || [];
  subtask.autoflow!.history.push({ from: subtask.autoflow!.state, to: subtask.autoflow!.state, at: new Date().toISOString(), reason: evidence || `gate:${gate}` });
  saveSubtask(feature, subtask);

  writeAuditEvent({
    event_type: 'lifecycle_transition',
    input_facts: { feature, seq, gate },
    action: 'gate',
    agent: subtask.suggested_agent || subtask.agent_id || 'TaskManager',
    result: 'recorded',
    metadata: { evidence },
  });
  console.log(`Recorded gate ${gate} for ${feature}/${seq}`);
}

function cmdTransition(feature: string, toState: string, reason: string = ''): void {
  const task = loadTask(feature);
  if (!task) {
    console.log(`Feature ${feature} not found`);
    process.exit(1);
  }

  try {
    transitionAutoFlowState(task, toState, reason, { allowInitial: true });
  } catch (error: any) {
    console.log(`Error: ${error.message}`);
    process.exit(1);
  }

  saveTask(feature, task);
  writeAuditEvent({
    event_type: 'lifecycle_transition',
    input_facts: { feature, to_state: toState },
    action: 'transition',
    agent: 'synapse',
    result: 'transitioned',
    metadata: { reason },
  });
  console.log(`Transitioned ${feature} to ${toState}`);
}

function cmdBlock(feature: string, seqOrReason?: string, reasonParts: string[] = []): void {
  const looksLikeSeq = !!seqOrReason && /^\d{2}$/.test(seqOrReason);
  const reason = (looksLikeSeq ? reasonParts.join(' ') : [seqOrReason, ...reasonParts].filter(Boolean).join(' ')).trim();
  if (!reason) {
    console.log('Usage: block <feature> [seq] "reason"');
    process.exit(1);
  }

  if (looksLikeSeq) {
    const { subtask } = getSubtaskOrExit(feature, seqOrReason!);
    if (subtask.status === 'completed' || subtask.status === 'cancelled') {
      console.log(`Error: Cannot block ${feature}/${seqOrReason} from status ${subtask.status}`);
      process.exit(1);
    }
    subtask.status = 'blocked';
    subtask.blocked_reason = reason;
    saveSubtask(feature, subtask);
  } else {
    const task = loadTask(feature);
    if (!task) {
      console.log(`Feature ${feature} not found`);
      process.exit(1);
    }
    task.status = 'blocked';
    task.blocked_reason = reason;
    saveTask(feature, task);
  }

  writeAuditEvent({
    event_type: 'lifecycle_transition',
    input_facts: { feature, seq: looksLikeSeq ? seqOrReason : undefined },
    action: 'block',
    agent: 'TaskManager',
    result: 'blocked',
    metadata: { reason },
  });
  console.log(`Blocked ${looksLikeSeq ? `${feature}/${seqOrReason}` : feature}: ${reason}`);
}

function cmdUnblock(feature: string, seq?: string): void {
  if (seq) {
    const { subtask } = getSubtaskOrExit(feature, seq);
    if (subtask.status !== 'blocked') {
      console.log(`Error: Task ${feature}/${seq} is not blocked`);
      process.exit(1);
    }
    subtask.status = 'pending';
    delete subtask.blocked_reason;
    saveSubtask(feature, subtask);
  } else {
    const task = loadTask(feature);
    if (!task) {
      console.log(`Feature ${feature} not found`);
      process.exit(1);
    }
    if (task.status !== 'blocked') {
      console.log(`Error: Feature ${feature} is not blocked`);
      process.exit(1);
    }
    task.status = 'active';
    delete task.blocked_reason;
    saveTask(feature, task);
  }

  writeAuditEvent({
    event_type: 'lifecycle_transition',
    input_facts: { feature, seq },
    action: 'unblock',
    agent: 'TaskManager',
    result: 'unblocked',
  });
  console.log(`Unblocked ${seq ? `${feature}/${seq}` : feature}`);
}

function cmdReopen(feature: string, seq: string): void {
  const { subtask } = getSubtaskOrExit(feature, seq);
  if (subtask.status !== 'completed' && subtask.status !== 'cancelled') {
    console.log(`Error: Task ${feature}/${seq} must be completed or cancelled before reopen. Current status: ${subtask.status}`);
    process.exit(1);
  }

  subtask.status = 'in_progress';
  subtask.completed_at = null;
  subtask.completion_summary = null;
  subtask.verification = undefined;
  subtask.cancelled_reason = undefined;
  subtask.autoflow = { state: 'implement_minimal_change', gates: { context_discovery: true }, history: [{ from: null, to: 'implement_minimal_change', at: new Date().toISOString(), reason: 'reopen' }] };
  saveSubtask(feature, subtask);

  const task = loadTask(feature);
  if (task) {
    const newSubtasks = loadSubtasks(feature);
    task.status = 'active';
    task.completed_count = newSubtasks.filter(s => s.status === 'completed').length;
    task.completed_at = null;
    task.verification = undefined;
    saveTask(feature, task);
  }

  writeAuditEvent({
    event_type: 'lifecycle_transition',
    input_facts: { feature, seq },
    action: 'reopen',
    agent: 'TaskManager',
    result: 'in_progress',
  });
  console.log(`Reopened ${feature}/${seq}`);
}

function cmdCancel(feature: string, seqOrReason?: string, reasonParts: string[] = []): void {
  const looksLikeSeq = !!seqOrReason && /^\d{2}$/.test(seqOrReason);
  const reason = (looksLikeSeq ? reasonParts.join(' ') : [seqOrReason, ...reasonParts].filter(Boolean).join(' ')).trim() || 'cancelled';

  if (looksLikeSeq) {
    const { subtask } = getSubtaskOrExit(feature, seqOrReason!);
    if (subtask.status === 'completed') {
      console.log(`Error: Cannot cancel completed task ${feature}/${seqOrReason}; reopen it first if needed`);
      process.exit(1);
    }
    subtask.status = 'cancelled';
    subtask.cancelled_reason = reason;
    saveSubtask(feature, subtask);
  } else {
    const task = loadTask(feature);
    if (!task) {
      console.log(`Feature ${feature} not found`);
      process.exit(1);
    }
    task.status = 'cancelled';
    task.cancelled_reason = reason;
    saveTask(feature, task);
  }

  writeAuditEvent({
    event_type: 'lifecycle_transition',
    input_facts: { feature, seq: looksLikeSeq ? seqOrReason : undefined },
    action: 'cancel',
    agent: 'TaskManager',
    result: 'cancelled',
    metadata: { reason },
  });
  console.log(`Cancelled ${looksLikeSeq ? `${feature}/${seqOrReason}` : feature}: ${reason}`);
}

async function cmdVerify(feature: string, seq: string, options: { force?: boolean; skipCommands?: boolean } = {}): Promise<void> {
  if (options.force && process.env.TASK_CLI_ALLOW_FORCE !== '1') {
    console.log('Error: --force is disabled by default. Set TASK_CLI_ALLOW_FORCE=1 for manual override.');
    process.exit(1);
  }

  if (options.skipCommands && process.env.TASK_CLI_ALLOW_SKIP_COMMANDS !== '1') {
    console.log('Error: --skip-commands is disabled by default. Set TASK_CLI_ALLOW_SKIP_COMMANDS=1 for manual override.');
    process.exit(1);
  }

  if (options.skipCommands && !options.force) {
    console.log('Error: --skip-commands requires --force because verification evidence will be incomplete.');
    process.exit(1);
  }

  const subtasks = loadSubtasks(feature);
  const subtask = subtasks.find(s => s.seq === seq);

  if (!subtask) {
    console.log(`Task ${seq} not found in ${feature}`);
    process.exit(1);
  }

  if (subtask.status === 'completed') {
    console.log(`Error: Task ${feature}/${seq} is already completed. Re-open it before running verify again.`);
    process.exit(1);
  }

  if (subtask.status !== 'in_progress') {
    console.log(`Error: Task ${feature}/${seq} must be in_progress before verification. Current status: ${subtask.status}`);
    process.exit(1);
  }

  const unmetDependencies = getUnmetDependencies(subtask, subtasks);
  if (unmetDependencies.length > 0) {
    console.log(`Error: Task ${feature}/${seq} cannot verify while dependencies are incomplete: ${unmetDependencies.join(', ')}`);
    process.exit(1);
  }

  const missingGates = missingAutoFlowGates(subtask);
  if (missingGates.length > 0) {
    console.log(`Error: Task ${feature}/${seq} cannot verify before required AutoFlow gates are recorded: ${missingGates.join(', ')}`);
    process.exit(1);
  }

  const verificationResults = await runVerificationGate(subtask, { skipCommands: options.skipCommands });
  const verificationStatus: 'passed' | 'failed' | 'forced' = verificationResults.allPassed
    ? 'passed'
    : options.force
      ? 'forced'
      : 'failed';
  const verifiedAt = new Date().toISOString();

  subtask.verification = {
    status: verificationStatus,
    verification_mode: 'spec',
    spec_hash: verificationResults.specHash || undefined,
    verified_at: verifiedAt,
    files_verified: verificationResults.deliverablesCheck.verifiedPaths,
    changed_files_verified: verificationResults.gitDiffCheck.changedPaths,
    file_hashes: verificationResults.fileFingerprints,
    commands: verificationResults.commandsCheck.results,
    checks: verificationResults.customChecks.results,
    git_diff_checked: (getVerificationSpec(subtask)?.deliverables_must_change || []).length > 0,
    git_diff_summary: verificationResults.gitDiffCheck.summary,
  };
  ensureAutoFlowGate(subtask, 'verify');

  saveSubtask(feature, subtask);
  writeAuditEvent({
    event_type: 'verification_result',
    input_facts: { feature, seq, scope: 'subtask' },
    action: 'verify',
    agent: 'BuildAgent',
    result: verificationStatus,
    metadata: { spec_hash: verificationResults.specHash, all_passed: verificationResults.allPassed },
  });

  if (verificationResults.allPassed) {
    console.log(`\n✅ VERIFIED: ${feature}/${seq}`);
    console.log(`  Spec Hash: ${verificationResults.specHash}`);
    console.log('  Next step: run complete with a summary to close the subtask.');
    console.log();
    return;
  }

  if (options.force) {
    console.log(`\n⚠️  VERIFIED WITH FORCE: ${feature}/${seq}`);
    printVerificationReport(verificationResults);
    console.log('  Verification evidence was saved with status: forced');
    console.log();
    return;
  }

  console.log(`\n⛔ VERIFICATION FAILED: ${feature}/${seq}`);
  printVerificationReport(verificationResults);
  console.log('\n⛔ Verification evidence saved with status: failed\n');
  process.exit(1);
}

async function cmdVerifyFeature(feature: string, options: { force?: boolean; skipCommands?: boolean } = {}): Promise<void> {
  if (options.force && process.env.TASK_CLI_ALLOW_FORCE !== '1') {
    console.log('Error: --force is disabled by default. Set TASK_CLI_ALLOW_FORCE=1 for manual override.');
    process.exit(1);
  }

  if (options.skipCommands && process.env.TASK_CLI_ALLOW_SKIP_COMMANDS !== '1') {
    console.log('Error: --skip-commands is disabled by default. Set TASK_CLI_ALLOW_SKIP_COMMANDS=1 for manual override.');
    process.exit(1);
  }

  if (options.skipCommands && !options.force) {
    console.log('Error: --skip-commands requires --force because verification evidence will be incomplete.');
    process.exit(1);
  }

  const task = loadTask(feature);
  if (!task) {
    console.log(`Feature ${feature} not found`);
    process.exit(1);
  }

  const subtasks = loadSubtasks(feature);
  const readiness = evaluateFeatureVerificationReadiness(task, subtasks);
  if (!readiness.ready) {
    console.log(`Error: Feature ${feature} is not ready for feature-level verification. ${readiness.reason}`);
    process.exit(1);
  }

  const verificationResults = await runFeatureVerificationGate(task, { skipCommands: options.skipCommands });
  const verificationStatus: 'passed' | 'failed' | 'forced' = verificationResults.allPassed
    ? 'passed'
    : options.force
      ? 'forced'
      : 'failed';
  const verifiedAt = new Date().toISOString();

  task.verification = {
    status: verificationStatus,
    verification_mode: 'spec',
    spec_hash: verificationResults.specHash || undefined,
    verified_at: verifiedAt,
    files_verified: verificationResults.deliverablesCheck.verifiedPaths,
    changed_files_verified: verificationResults.gitDiffCheck.changedPaths,
    file_hashes: verificationResults.fileFingerprints,
    commands: verificationResults.commandsCheck.results,
    checks: verificationResults.customChecks.results,
    exit_criteria_verified: normalizeStringArray(task.exit_criteria || []),
    git_diff_checked: (getVerificationSpec(task)?.deliverables_must_change || []).length > 0,
    git_diff_summary: verificationResults.gitDiffCheck.summary,
  };

  saveTask(feature, task);
  writeAuditEvent({
    event_type: 'verification_result',
    input_facts: { feature, scope: 'feature' },
    action: 'verify-feature',
    agent: 'BuildAgent',
    result: verificationStatus,
    metadata: { spec_hash: verificationResults.specHash, all_passed: verificationResults.allPassed },
  });

  if (verificationResults.allPassed) {
    console.log(`\n✅ FEATURE VERIFIED: ${feature}`);
    console.log(`  Spec Hash: ${verificationResults.specHash}`);
    console.log('  Next step: run archive to finalize the feature.');
    console.log();
    return;
  }

  if (options.force) {
    console.log(`\n⚠️  FEATURE VERIFIED WITH FORCE: ${feature}`);
    printVerificationReport(verificationResults);
    console.log('  Verification evidence was saved with status: forced');
    console.log();
    return;
  }

  console.log(`\n⛔ FEATURE VERIFICATION FAILED: ${feature}`);
  printVerificationReport(verificationResults);
  console.log('\n⛔ Feature verification evidence saved with status: failed\n');
  process.exit(1);
}

function cmdArchive(feature: string, options: { force?: boolean } = {}): void {
  if (options.force && process.env.TASK_CLI_ALLOW_FORCE !== '1') {
    console.log('Error: --force is disabled by default. Set TASK_CLI_ALLOW_FORCE=1 for manual override.');
    process.exit(1);
  }

  const task = loadTask(feature);
  if (!task) {
    console.log(`Feature ${feature} not found`);
    process.exit(1);
  }

  const subtasks = loadSubtasks(feature);
  const readiness = evaluateFeatureVerificationReadiness(task, subtasks);
  if (!readiness.ready) {
    console.log(`Error: Feature ${feature} cannot be archived yet. ${readiness.reason}`);
    process.exit(1);
  }

  const spec = getVerificationSpec(task);
  if (!spec) {
    console.log(`Error: Feature ${feature} has no verification_spec. Run TaskManager again or repair task.json.`);
    process.exit(1);
  }

  if (!task.verification) {
    console.log(`Error: Feature ${feature} has no verification evidence. Run verify-feature before archive.`);
    process.exit(1);
  }

  const currentSpecHash = getTaskVerificationSpecHash(task);
  if (task.verification.spec_hash !== currentSpecHash) {
    console.log(`Error: Feature verification spec changed for ${feature}. Re-run verify-feature before archive.`);
    process.exit(1);
  }

  if (!task.verification.verified_at) {
    console.log(`Error: Feature verification timestamp missing for ${feature}. Re-run verify-feature before archive.`);
    process.exit(1);
  }

  if (task.verification.status === 'failed') {
    console.log(`Error: Last feature verification for ${feature} failed. Re-run verify-feature after fixing the task.`);
    process.exit(1);
  }

  if (task.verification.status === 'forced' && !options.force) {
    console.log(`Error: Feature ${feature} was only force-verified. Re-run verify-feature successfully or use archive --force with manual approval.`);
    process.exit(1);
  }

  if (task.verification.status !== 'passed' && task.verification.status !== 'forced') {
    console.log(`Error: Feature ${feature} is not successfully verified. Current verification status: ${task.verification.status || 'missing'}`);
    process.exit(1);
  }

  const expectedExitCriteria = normalizeStringArray(task.exit_criteria || []);
  const verifiedExitCriteria = normalizeStringArray(task.verification.exit_criteria_verified || []);
  if (!arraysEqual(expectedExitCriteria, verifiedExitCriteria)) {
    console.log(`Error: Feature exit_criteria verification is stale or incomplete for ${feature}. Re-run verify-feature before archive.`);
    process.exit(1);
  }

  let currentFingerprints: { path: string; sha256: string }[] = [];
  try {
    currentFingerprints = buildFileFingerprints(collectVerificationPaths(spec));
  } catch (error: any) {
    console.log(`Error: Failed to recompute feature verification fingerprints for ${feature}: ${error.message}`);
    process.exit(1);
  }

  const fingerprintComparison = compareFileFingerprints(task.verification.file_hashes || [], currentFingerprints);
  if (!fingerprintComparison.passed) {
    console.log('\n⛔ ARCHIVE REJECTED - Feature files changed after verification');
    for (const detail of fingerprintComparison.details) {
      console.log(`  ${detail}`);
    }
    console.log('\nRe-run verify-feature before archive.\n');
    process.exit(1);
  }

  const featureDir = path.join(TASKS_DIR, feature);
  const archivedDir = path.join(COMPLETED_DIR, feature);
  if (fs.existsSync(archivedDir)) {
    console.log(`Error: Archive target already exists: ${archivedDir}`);
    process.exit(1);
  }

  fs.mkdirSync(COMPLETED_DIR, { recursive: true });

  const archivedAt = new Date().toISOString();
  task.status = 'archived';
  task.completed_at = archivedAt;
  saveTask(feature, task);
  fs.renameSync(featureDir, archivedDir);
  writeAuditEvent({
    event_type: 'archive',
    input_facts: { feature },
    action: 'archive',
    agent: 'TaskManager',
    result: 'archived',
    metadata: { archived_at: archivedAt, location: path.relative(PROJECT_ROOT, archivedDir) },
  });

  console.log(`\n📦 ARCHIVED: ${feature}`);
  console.log(`  Archived At: ${archivedAt}`);
  console.log(`  Location: ${path.relative(PROJECT_ROOT, archivedDir)}`);
  console.log();
}

async function cmdComplete(feature: string, seq: string, summary: string, options: { force?: boolean } = {}): Promise<void> {
  if (summary.length > 200) {
    console.log('Error: Summary must be max 200 characters');
    process.exit(1);
  }

  if (!summary.trim()) {
    console.log('Error: Summary must not be empty');
    process.exit(1);
  }

  if (options.force && process.env.TASK_CLI_ALLOW_FORCE !== '1') {
    console.log('Error: --force is disabled by default. Set TASK_CLI_ALLOW_FORCE=1 for manual override.');
    process.exit(1);
  }

  const subtasks = loadSubtasks(feature);
  const subtask = subtasks.find(s => s.seq === seq);

  if (!subtask) {
    console.log(`Task ${seq} not found in ${feature}`);
    process.exit(1);
  }

  if (subtask.status === 'completed') {
    console.log(`Task ${feature}/${seq} is already completed`);
    process.exit(1);
  }

  if (subtask.status !== 'in_progress') {
    console.log(`Error: Task ${feature}/${seq} must be in_progress before completion. Current status: ${subtask.status}`);
    process.exit(1);
  }

  const unmetDependencies = getUnmetDependencies(subtask, subtasks);
  if (unmetDependencies.length > 0) {
    console.log(`Error: Task ${feature}/${seq} cannot complete while dependencies are incomplete: ${unmetDependencies.join(', ')}`);
    process.exit(1);
  }

  const spec = getVerificationSpec(subtask);
  if (!spec) {
    console.log(`Error: Task ${feature}/${seq} has no verification_spec. Run TaskManager again or repair the task definition.`);
    process.exit(1);
  }

  if (!subtask.verification) {
    console.log(`Error: Task ${feature}/${seq} has no verification evidence. Run verify before complete.`);
    process.exit(1);
  }

  const currentSpecHash = getSubtaskVerificationSpecHash(subtask, spec);
  if (subtask.verification.spec_hash !== currentSpecHash) {
    console.log(`Error: Verification spec changed for ${feature}/${seq}. Re-run verify before complete.`);
    process.exit(1);
  }

  if (!subtask.verification.verified_at) {
    console.log(`Error: Verification timestamp missing for ${feature}/${seq}. Re-run verify before complete.`);
    process.exit(1);
  }

  if (subtask.verification.status === 'failed') {
    console.log(`Error: Last verification for ${feature}/${seq} failed. Re-run verify after fixing the task.`);
    process.exit(1);
  }

  if (subtask.verification.status === 'forced' && !options.force) {
    console.log(`Error: Task ${feature}/${seq} was only force-verified. Re-run verify successfully or use complete --force with manual approval.`);
    process.exit(1);
  }

  if (subtask.verification.status !== 'passed' && subtask.verification.status !== 'forced') {
    console.log(`Error: Task ${feature}/${seq} is not successfully verified. Current verification status: ${subtask.verification.status || 'missing'}`);
    process.exit(1);
  }

  let currentFingerprints: { path: string; sha256: string }[] = [];
  try {
    currentFingerprints = buildFileFingerprints(collectVerificationPaths(spec));
  } catch (error: any) {
    console.log(`Error: Failed to recompute verification fingerprints for ${feature}/${seq}: ${error.message}`);
    process.exit(1);
  }

  const fingerprintComparison = compareFileFingerprints(subtask.verification.file_hashes || [], currentFingerprints);
  if (!fingerprintComparison.passed) {
    console.log('\n⛔ COMPLETION REJECTED - Files changed after verification');
    for (const detail of fingerprintComparison.details) {
      console.log(`  ${detail}`);
    }
    console.log('\nRe-run verify before complete.\n');
    process.exit(1);
  }

  const completedAt = new Date().toISOString();
  subtask.status = 'completed';
  subtask.completed_at = completedAt;
  subtask.completion_summary = summary;
  ensureAutoFlowGate(subtask, 'complete');

  saveSubtask(feature, subtask);
  writeAuditEvent({
    event_type: 'completion',
    input_facts: { feature, seq },
    action: 'complete',
    agent: subtask.suggested_agent || subtask.agent_id || 'unknown',
    result: 'completed',
    metadata: { summary },
  });

  const task = loadTask(feature);
  if (task) {
    const newSubtasks = loadSubtasks(feature);
    task.completed_count = newSubtasks.filter(s => s.status === 'completed').length;
    const featureReadiness = evaluateFeatureVerificationReadiness(task, newSubtasks);

    if (task.status === 'completed') {
      task.status = 'active';
    }
    task.completed_at = null;
    saveTask(feature, task);

    if (featureReadiness.ready) {
      console.log('  Note: all subtasks are completed and verified. Run `verify-feature`, then `archive` to finish the feature.');
    }
  }

  console.log('\n✅ COMPLETED: ' + feature + '/' + seq);
  console.log(`  Summary: ${summary}`);

  if (task) {
    console.log(`  Progress: ${task.completed_count}/${task.subtask_count}`);
  }
  console.log();
}

function cmdValidate(feature?: string): void {
  const features = feature ? [feature] : getFeatureDirs();
  let hasErrors = false;

  const validTaskStatuses = new Set(['active', 'completed', 'blocked', 'archived', 'cancelled']);
  const validSubtaskStatuses = new Set(['pending', 'in_progress', 'completed', 'blocked', 'cancelled']);
  const knownAutoFlowStates = getKnownAutoFlowStates();
  const taskSchema = loadJsonFile(TASK_SCHEMA_PATH);
  const subtaskSchema = loadJsonFile(SUBTASK_SCHEMA_PATH);
  const validVerificationStatuses = new Set(['passed', 'failed', 'forced']);

  const requiredTaskFields = [
    'id',
    'name',
    'status',
    'objective',
    'context_files',
    'exit_criteria',
    'subtask_count',
    'completed_count',
    'created_at',
    'completed_at',
  ];

  const requiredSubtaskFields = [
    'id',
    'seq',
    'title',
    'status',
    'depends_on',
    'parallel',
    'context_files',
    'acceptance_criteria',
    'deliverables',
    'agent_id',
    'started_at',
    'completed_at',
    'completion_summary',
  ];

  const hasField = (obj: any, field: string): boolean => Object.prototype.hasOwnProperty.call(obj, field);
  const isStringArray = (value: any): boolean => Array.isArray(value) && value.every(v => typeof v === 'string');
  const isContextReference = (value: any): boolean => {
    if (typeof value === 'string') {
      return true;
    }

    if (!value || typeof value !== 'object') {
      return false;
    }

    if (typeof value.path !== 'string' || !value.path.trim()) {
      return false;
    }

    if (value.lines !== undefined && typeof value.lines !== 'string') {
      return false;
    }

    if (value.reason !== undefined && typeof value.reason !== 'string') {
      return false;
    }

    return true;
  };
  const isContextReferenceArray = (value: any): boolean => Array.isArray(value) && value.every(isContextReference);

  console.log('\n=== Validation Results ===\n');

  for (const f of features) {
    const errors: string[] = [];

    if (!taskSchema) {
      errors.push(`Missing JSON Schema: ${TASK_SCHEMA_PATH}`);
    }
    if (!subtaskSchema) {
      errors.push(`Missing JSON Schema: ${SUBTASK_SCHEMA_PATH}`);
    }

    // Check task.json exists
    const task = loadTask(f);
    if (!task) {
      errors.push('Missing task.json');
    }

    // Load and validate subtasks
    const subtasks = loadSubtasks(f);
    const seqCounts = new Map<string, number>();
    for (const s of subtasks) {
      const seq = typeof s.seq === 'string' ? s.seq : '';
      seqCounts.set(seq, (seqCounts.get(seq) || 0) + 1);
    }
    const seqs = new Set(subtasks.map(s => s.seq));

    if (task) {
      if (taskSchema) {
        errors.push(...validateAgainstSimpleSchema(task, taskSchema, 'task.json'));
      }

      // Required fields in task.json
      for (const field of requiredTaskFields) {
        if (!hasField(task, field)) {
          errors.push(`task.json: missing required field '${field}'`);
        }
      }

      // Task ID should match feature slug
      if (task.id !== f) {
        errors.push(`task.json id ('${task.id}') should match feature slug ('${f}')`);
      }

      // Task status should be valid
      if (!validTaskStatuses.has(task.status)) {
        errors.push(`task.json: invalid status '${task.status}'`);
      }

      if (task.autoflow?.state && !knownAutoFlowStates.has(task.autoflow.state)) {
        errors.push(`task.json: unknown AutoFlow state '${task.autoflow.state}'`);
      }

      // Basic type checks for key task fields
      if (!isContextReferenceArray(task.context_files)) {
        errors.push('task.json: context_files must be an array of strings or {path, lines?, reason?} objects');
      }
      if (hasField(task, 'reference_files') && task.reference_files !== undefined && !isContextReferenceArray(task.reference_files)) {
        errors.push('task.json: reference_files must be an array of strings or {path, lines?, reason?} objects when present');
      }
      if (!isStringArray(task.exit_criteria)) {
        errors.push('task.json: exit_criteria must be string[]');
      }
      const taskVerificationSpecErrors = validateVerificationSpec(task);
      for (const error of taskVerificationSpecErrors) {
        errors.push(`task.json: ${error}`);
      }
      const taskExitCriteriaBindingErrors = validateTaskExitCriteriaBinding(task);
      for (const error of taskExitCriteriaBindingErrors) {
        errors.push(`task.json: ${error}`);
      }
      if (typeof task.subtask_count !== 'number') {
        errors.push('task.json: subtask_count must be number');
      }
      if (typeof task.completed_count !== 'number') {
        errors.push('task.json: completed_count must be number');
      }
      if (task.verification) {
        if (!task.verification.status || !validVerificationStatuses.has(task.verification.status)) {
          errors.push('task.json: verification.status must be passed, failed, or forced when verification exists');
        }
        if (!task.verification.spec_hash) {
          errors.push('task.json: verification.spec_hash is required when verification exists');
        }
        if (!task.verification.verified_at) {
          errors.push('task.json: verification.verified_at is required when verification exists');
        }
        if (!Array.isArray(task.verification.file_hashes)) {
          errors.push('task.json: verification.file_hashes must be an array when verification exists');
        }
        if ((task.exit_criteria || []).length > 0 && !Array.isArray(task.verification.exit_criteria_verified)) {
          errors.push('task.json: verification.exit_criteria_verified must be an array when exit_criteria are defined');
        }
      }
    }

    for (const s of subtasks) {
      if (subtaskSchema) {
        errors.push(...validateAgainstSimpleSchema(s, subtaskSchema, `${s.seq || '??'}`));
      }

      // Required fields in subtask files
      for (const field of requiredSubtaskFields) {
        if (!hasField(s, field)) {
          errors.push(`${s.seq || '??'}: missing required field '${field}'`);
        }
      }

      // Sequence format and uniqueness
      if (!/^\d{2}$/.test(s.seq)) {
        errors.push(`${s.seq}: sequence must be 2 digits (e.g., 01, 02)`);
      }
      if ((seqCounts.get(s.seq) || 0) > 1) {
        errors.push(`${s.seq}: duplicate sequence number`);
      }

      // Check ID format
      if (!s.id.startsWith(f)) {
        errors.push(`${s.seq}: ID should start with feature name`);
      }

      // Status should be valid
      if (!validSubtaskStatuses.has(s.status)) {
        errors.push(`${s.seq}: invalid status '${s.status}'`);
      }

      if (s.autoflow?.state && !knownAutoFlowStates.has(s.autoflow.state)) {
        errors.push(`${s.seq}: unknown AutoFlow state '${s.autoflow.state}'`);
      }
      if (s.status === 'completed' && missingAutoFlowGates(s).length > 0) {
        errors.push(`${s.seq}: missing AutoFlow gates: ${missingAutoFlowGates(s).join(', ')}`);
      }
      if (s.status === 'completed' && s.autoflow?.gates?.complete !== true) {
        errors.push(`${s.seq}: completed task requires AutoFlow complete gate`);
      }

      // Type checks
      if (!isStringArray(s.depends_on)) {
        errors.push(`${s.seq}: depends_on must be string[]`);
      }
      if (typeof s.parallel !== 'boolean') {
        errors.push(`${s.seq}: parallel must be boolean`);
      }
      if (!isContextReferenceArray(s.context_files)) {
        errors.push(`${s.seq}: context_files must be an array of strings or {path, lines?, reason?} objects`);
      }
      if (hasField(s, 'reference_files') && s.reference_files !== undefined && !isContextReferenceArray(s.reference_files)) {
        errors.push(`${s.seq}: reference_files must be an array of strings or {path, lines?, reason?} objects when present`);
      }
      if (!isStringArray(s.acceptance_criteria)) {
        errors.push(`${s.seq}: acceptance_criteria must be string[]`);
      } else if (s.acceptance_criteria.length === 0) {
        errors.push(`${s.seq}: No acceptance criteria defined`);
      }
      if (!isStringArray(s.deliverables)) {
        errors.push(`${s.seq}: deliverables must be string[]`);
      } else if (s.deliverables.length === 0) {
        errors.push(`${s.seq}: No deliverables defined`);
      }

      const verificationSpecErrors = validateVerificationSpec(s);
      for (const error of verificationSpecErrors) {
        errors.push(`${s.seq}: ${error}`);
      }

      if (s.verification) {
        if (!s.verification.status || !validVerificationStatuses.has(s.verification.status)) {
          errors.push(`${s.seq}: verification.status must be passed, failed, or forced when verification exists`);
        }
        if (!s.verification.spec_hash) {
          errors.push(`${s.seq}: verification.spec_hash is required when verification exists`);
        }
        if (!s.verification.verified_at) {
          errors.push(`${s.seq}: verification.verified_at is required when verification exists`);
        }
        if (!Array.isArray(s.verification.file_hashes)) {
          errors.push(`${s.seq}: verification.file_hashes must be an array when verification exists`);
        }
      }

      if (s.status === 'completed') {
        if (!s.verification) {
          errors.push(`${s.seq}: completed task requires verification data`);
        } else if (s.verification.status !== 'passed') {
          errors.push(`${s.seq}: completed task requires successful verification status`);
        }
      }

      // Self dependency is invalid
      if (Array.isArray(s.depends_on) && s.depends_on.includes(s.seq)) {
        errors.push(`${s.seq}: task cannot depend on itself`);
      }

      // Check for missing dependencies
      for (const dep of (Array.isArray(s.depends_on) ? s.depends_on : [])) {
        if (!seqs.has(dep)) {
          errors.push(`${s.seq}: depends on non-existent task ${dep}`);
        }
      }

      // Check for circular dependencies
      const visited = new Set<string>();
      const checkCircular = (seq: string, path: string[]): boolean => {
        if (path.includes(seq)) {
          errors.push(`${s.seq}: circular dependency detected: ${[...path, seq].join(' -> ')}`);
          return true;
        }
        if (visited.has(seq)) return false;
        visited.add(seq);

        const task = subtasks.find(t => t.seq === seq);
        if (task) {
          for (const dep of task.depends_on) {
            if (checkCircular(dep, [...path, seq])) return true;
          }
        }
        return false;
      };
      checkCircular(s.seq, []);
    }

    // Check counts match
    if (task && task.subtask_count !== subtasks.length) {
      errors.push(`task.json subtask_count (${task.subtask_count}) doesn't match actual count (${subtasks.length})`);
    }

    if (task) {
      const actualCompletedCount = subtasks.filter(s => s.status === 'completed').length;
      if (task.completed_count !== actualCompletedCount) {
        errors.push(`task.json completed_count (${task.completed_count}) doesn't match actual completed subtasks (${actualCompletedCount})`);
      }

      if (task.status === 'completed') {
        const incompleteSubtasks = subtasks.filter(s => s.status !== 'completed').map(s => s.seq);
        if (incompleteSubtasks.length > 0) {
          errors.push(`task.json status is completed but subtasks are still open: ${incompleteSubtasks.join(', ')}`);
        }

        const unverifiedSubtasks = subtasks
          .filter(s => s.status === 'completed' && !hasPassedVerification(s.verification))
          .map(s => s.seq);
        if (unverifiedSubtasks.length > 0) {
          errors.push(`task.json status is completed but subtasks are not successfully verified: ${unverifiedSubtasks.join(', ')}`);
        }
      }

      if (task.status === 'archived') {
        const readiness = evaluateFeatureVerificationReadiness(task, subtasks);
        if (!readiness.ready) {
          errors.push(`task.json status is archived but feature is not ready: ${readiness.reason}`);
        }
        if (!hasPassedVerification(task.verification)) {
          errors.push('task.json status is archived but feature verification is not successfully passed');
        }
        if (!arraysEqual(normalizeStringArray(task.exit_criteria || []), normalizeStringArray(task.verification?.exit_criteria_verified || []))) {
          errors.push('task.json status is archived but feature exit_criteria are not fully verified');
        }
      }
    }

    // Print results
    console.log(`[${f}]`);
    if (errors.length === 0) {
      console.log('  ✓ All checks passed');
    } else {
      for (const e of errors) {
        console.log(`  ✗ ERROR: ${e}`);
        hasErrors = true;
      }
    }
    console.log();
  }

  process.exit(hasErrors ? 1 : 0);
}

// Main
(async () => {
  const [,, command, ...args] = process.argv;

  switch (command) {
    case 'status':
      cmdStatus(args[0]);
      break;
    case 'next':
      cmdNext(args[0]);
      break;
    case 'parallel':
      cmdParallel(args[0]);
      break;
    case 'deps':
      if (args.length < 2) {
        console.log('Usage: deps <feature> <seq>');
        process.exit(1);
      }
      cmdDeps(args[0], args[1]);
      break;
    case 'blocked':
      cmdBlocked(args[0]);
      break;
    case 'start':
      if (args.length < 2) {
        console.log('Usage: start <feature> <seq> [agent_id]');
        process.exit(1);
      }
      cmdStart(args[0], args[1], args[2]);
      break;
    case 'gate':
      if (args.length < 3) {
        console.log('Usage: gate <feature> <seq> <context_discovery|red|green|review> [evidence]');
        process.exit(1);
      }
      cmdGate(args[0], args[1], args[2], args.slice(3).join(' '));
      break;
    case 'transition':
      if (args.length < 2) {
        console.log('Usage: transition <feature> <state> [reason]');
        process.exit(1);
      }
      cmdTransition(args[0], args[1], args.slice(2).join(' '));
      break;
    case 'block':
      if (args.length < 2) {
        console.log('Usage: block <feature> [seq] "reason"');
        process.exit(1);
      }
      cmdBlock(args[0], args[1], args.slice(2));
      break;
    case 'unblock':
      if (args.length < 1) {
        console.log('Usage: unblock <feature> [seq]');
        process.exit(1);
      }
      cmdUnblock(args[0], args[1]);
      break;
    case 'reopen':
      if (args.length < 2) {
        console.log('Usage: reopen <feature> <seq>');
        process.exit(1);
      }
      cmdReopen(args[0], args[1]);
      break;
    case 'cancel':
      if (args.length < 1) {
        console.log('Usage: cancel <feature> [seq] [reason]');
        process.exit(1);
      }
      cmdCancel(args[0], args[1], args.slice(2));
      break;
    case 'verify':
      if (args.length < 2) {
        console.log('Usage: verify <feature> <seq> [--force] [--skip-commands]');
        console.log('');
        console.log('Options:');
        console.log('  --force          Manual override. Requires TASK_CLI_ALLOW_FORCE=1');
        console.log('  --skip-commands  Manual override. Requires TASK_CLI_ALLOW_SKIP_COMMANDS=1 and --force');
        process.exit(1);
      }

      await cmdVerify(args[0], args[1], {
        force: args.includes('--force'),
        skipCommands: args.includes('--skip-commands'),
      });
      break;
    case 'verify-feature':
      if (args.length < 1) {
        console.log('Usage: verify-feature <feature> [--force] [--skip-commands]');
        console.log('');
        console.log('Options:');
        console.log('  --force          Manual override. Requires TASK_CLI_ALLOW_FORCE=1');
        console.log('  --skip-commands  Manual override. Requires TASK_CLI_ALLOW_SKIP_COMMANDS=1 and --force');
        process.exit(1);
      }

      await cmdVerifyFeature(args[0], {
        force: args.includes('--force'),
        skipCommands: args.includes('--skip-commands'),
      });
      break;
    case 'complete':
      if (args.length < 3) {
        console.log('Usage: complete <feature> <seq> "summary" [--force]');
        console.log('');
        console.log('Options:');
        console.log('  --force       Manual override. Requires TASK_CLI_ALLOW_FORCE=1 and a forced verification record');
        process.exit(1);
      }

      const feature = args[0];
      const seq = args[1];

      const rawSummary = args.slice(2).join(' ');
      const summaryMatch = rawSummary.match(/^([^--]+?)(?:\s+(--[\w-]+(?:\s+--[\w-]+)*))?$/);
      const summary = summaryMatch ? summaryMatch[1].trim() : rawSummary.replace(/--[\w-]+/g, '').trim();

      const summaryArgs = summaryMatch && summaryMatch[2] ? summaryMatch[2].split(/\s+/) : [];
      const allFlags = [...args.slice(3).filter(a => a.startsWith('--')), ...summaryArgs];
      const options = {
        force: allFlags.includes('--force'),
      };

      await cmdComplete(feature, seq, summary, options);
      break;
    case 'archive':
      if (args.length < 1) {
        console.log('Usage: archive <feature> [--force]');
        console.log('');
        console.log('Options:');
        console.log('  --force       Manual override. Requires TASK_CLI_ALLOW_FORCE=1 and a forced feature verification record');
        process.exit(1);
      }

      cmdArchive(args[0], { force: args.includes('--force') });
      break;
    case 'validate':
      cmdValidate(args[0]);
      break;
    default:
      console.log(`
Task Management CLI

Usage: npx ts-node task-cli.ts <command> [feature] [args...]

Task files are stored in: .tmp/tasks/{feature-slug}/

Commands:
  status [feature]                  Show task status summary
  next [feature]                    Show next eligible tasks (deps satisfied)
  parallel [feature]                Show parallelizable tasks ready to run
  deps <feature> <seq>              Show dependency tree for a task
  blocked [feature]                 Show blocked tasks and why
  start <feature> <seq> [agent_id]  Mark a dependency-ready subtask in progress
  gate <feature> <seq> <gate>       Record AutoFlow gate evidence
  transition <feature> <state>      Validate and store AutoFlow state transition
  block <feature> [seq] "reason"    Mark a feature or subtask blocked
  unblock <feature> [seq]           Reopen a blocked feature or subtask
  reopen <feature> <seq>            Reopen a completed/cancelled subtask
  cancel <feature> [seq] [reason]   Cancel a feature or subtask
  verify <feature> <seq> [--force] [--skip-commands]
                                    Run verification gate and save evidence
  verify-feature <feature> [--force] [--skip-commands]
                                    Run feature-level verification and save evidence
  complete <feature> <seq> "summary" [--force]
                                    Mark task completed using saved verification evidence
  archive <feature> [--force]
                                    Archive feature using saved feature verification evidence
  validate [feature]                Validate JSON files and dependencies

Verify Options:
  --force          Manual override. Requires TASK_CLI_ALLOW_FORCE=1
  --skip-commands  Manual override. Requires TASK_CLI_ALLOW_SKIP_COMMANDS=1 and --force

Complete Options:
  --force       Manual override. Requires TASK_CLI_ALLOW_FORCE=1

Examples:
  npx ts-node task-cli.ts status
  npx ts-node task-cli.ts next my-feature
  npx ts-node task-cli.ts start my-feature 02 CoderAgent
  npx ts-node task-cli.ts gate my-feature 02 red "targeted test failed as expected"
  npx ts-node task-cli.ts gate my-feature 02 green "targeted test passed"
  npx ts-node task-cli.ts gate my-feature 02 review "no blocking findings"
  npx ts-node task-cli.ts verify my-feature 02
  npx ts-node task-cli.ts complete my-feature 02 "Implemented auth module"
  npx ts-node task-cli.ts verify-feature my-feature
  npx ts-node task-cli.ts archive my-feature
`);
  }
})().catch(err => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
