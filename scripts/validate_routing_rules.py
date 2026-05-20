#!/usr/bin/env python3
"""
Routing Rules Validator

Tests routing rules against scenarios and validates schema compliance.
Supports both manual testing and CI/CD integration.

Usage:
    python scripts/validate_routing_rules.py                    # Run all tests
    python scripts/validate_routing_rules.py --schema-only     # Schema validation only
    python scripts/validate_routing_rules.py --scenarios-only  # Run scenarios only
    python scripts/validate_routing_rules.py --verbose         # Detailed output
    python scripts/validate_routing_rules.py --json            # JSON output for CI
"""

import json
import sys
import os
import re
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
from dataclasses import dataclass, field
from enum import Enum
import argparse

try:
    from jsonschema import Draft202012Validator
except ImportError:
    Draft202012Validator = None

try:
    from audit_writer import append_audit_event
except ImportError:
    append_audit_event = None


SAFE_DIRECT_OPERATION_TYPES = {
    "read",
    "list",
    "glob",
    "grep",
    "search",
    "fetch",
    "webfetch",
    "safe_bash",
    "question",
}

# Enable UTF-8 output on Windows
if sys.platform == "win32":
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')


class Color:
    GREEN = "\033[92m"
    RED = "\033[91m"
    YELLOW = "\033[93m"
    BLUE = "\033[94m"
    BOLD = "\033[1m"
    RESET = "\033[0m"

    @classmethod
    def enabled(cls) -> bool:
        return sys.stdout.isatty()

    @classmethod
    def ascii_mode(cls) -> bool:
        """Check if we should use ASCII instead of Unicode."""
        if not sys.stdout.isatty():
            return True
        # On Windows, often better to use ASCII
        if sys.platform == "win32":
            return True
        return False


class TestStatus(Enum):
    PASS = "PASS"
    FAIL = "FAIL"
    SKIP = "SKIP"
    ERROR = "ERROR"


@dataclass
class TestResult:
    scenario_id: str
    scenario_name: str
    status: TestStatus
    expected: Optional[str] = None
    actual: Optional[str] = None
    message: str = ""
    details: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.scenario_id,
            "name": self.scenario_name,
            "status": self.status.value,
            "expected": self.expected,
            "actual": self.actual,
            "message": self.message,
            "details": self.details
        }


@dataclass
class ValidationResult:
    schema_valid: bool
    tests_passed: int
    tests_failed: int
    tests_skipped: int
    results: List[TestResult] = field(default_factory=list)
    errors: List[str] = field(default_factory=list)

    @property
    def total_tests(self) -> int:
        return self.tests_passed + self.tests_failed + self.tests_skipped

    @property
    def success_rate(self) -> float:
        if self.total_tests == 0:
            return 0.0
        return (self.tests_passed / self.total_tests) * 100


class ConditionEvaluator:
    """Evaluates DSL conditions against input facts."""

    def __init__(self, facts: Dict[str, Any]):
        self.facts = facts

    def evaluate(self, condition: Dict[str, Any]) -> Tuple[bool, str]:
        """Evaluate a condition and return (matched, reason)."""

        condition_type = condition.get("type", "")

        if condition_type == "AND":
            return self._evaluate_and(condition)
        elif condition_type == "OR":
            return self._evaluate_or(condition)
        elif condition_type == "NOT":
            return self._evaluate_not(condition)
        elif condition_type == "XOR":
            return self._evaluate_xor(condition)
        else:
            return self._evaluate_atomic(condition)

    def _evaluate_and(self, condition: Dict[str, Any]) -> Tuple[bool, str]:
        expressions = condition.get("expressions", [])
        results = []

        for expr in expressions:
            matched, reason = self.evaluate(expr)
            results.append((matched, reason))

        all_matched = all(m for m, _ in results)
        reasons = [r for _, r in results]

        return all_matched, f"AND({', '.join(reasons)})"

    def _evaluate_or(self, condition: Dict[str, Any]) -> Tuple[bool, str]:
        expressions = condition.get("expressions", [])

        for expr in expressions:
            matched, reason = self.evaluate(expr)
            if matched:
                return True, f"OR({reason})"

        return False, f"OR(no match in {len(expressions)} expressions)"

    def _evaluate_not(self, condition: Dict[str, Any]) -> Tuple[bool, str]:
        expr = condition.get("expression", {})
        matched, reason = self.evaluate(expr)
        return not matched, f"NOT({reason})"

    def _evaluate_xor(self, condition: Dict[str, Any]) -> Tuple[bool, str]:
        expressions = condition.get("expressions", [])
        matched_count = 0
        last_reason = ""

        for expr in expressions:
            matched, reason = self.evaluate(expr)
            if matched:
                matched_count += 1
            last_reason = reason

        return matched_count == 1, f"XOR({last_reason}, {matched_count} matched)"

    def _evaluate_atomic(self, condition: Dict[str, Any]) -> Tuple[bool, str]:
        cond_type = condition.get("type", "")
        operator = condition.get("operator", "")
        expected_value = condition.get("value")
        fact_value = self.facts.get(cond_type)

        try:
            if operator == "exists":
                result = (fact_value is not None) == bool(expected_value)
                return result, f"{cond_type} exists={expected_value}"

            if operator == "not_exists":
                result = (fact_value is None) == bool(expected_value)
                return result, f"{cond_type} not_exists={expected_value}"

            if fact_value is None:
                return False, f"{cond_type}=undefined"

            if operator == "eq":
                result = str(fact_value) == str(expected_value)
                return result, f"{cond_type}={fact_value} {operator} {expected_value}"

            elif operator == "neq":
                result = str(fact_value) != str(expected_value)
                return result, f"{cond_type}={fact_value} {operator} {expected_value}"

            elif operator == "in":
                if isinstance(expected_value, list):
                    result = str(fact_value) in [str(v) for v in expected_value]
                    return result, f"{cond_type}={fact_value} in {expected_value}"
                return False, f"{cond_type}=invalid 'in' value"

            elif operator == "not_in":
                if isinstance(expected_value, list):
                    result = str(fact_value) not in [str(v) for v in expected_value]
                    return result, f"{cond_type}={fact_value} not_in {expected_value}"
                return False, f"{cond_type}=invalid 'not_in' value"

            elif operator == "contains":
                result = str(expected_value) in str(fact_value)
                return result, f"{cond_type} contains '{expected_value}'"

            elif operator == "not_contains":
                result = str(expected_value) not in str(fact_value)
                return result, f"{cond_type} not_contains '{expected_value}'"

            elif operator == "starts_with":
                result = str(fact_value).startswith(str(expected_value))
                return result, f"{cond_type} starts_with '{expected_value}'"

            elif operator == "ends_with":
                result = str(fact_value).endswith(str(expected_value))
                return result, f"{cond_type} ends_with '{expected_value}'"

            elif operator == "matches_regex":
                result = re.search(str(expected_value), str(fact_value)) is not None
                return result, f"{cond_type} matches_regex '{expected_value}'"

            elif operator in {"gt", "gte", "lt", "lte"}:
                left = float(fact_value)
                right = float(expected_value)
                comparisons = {
                    "gt": left > right,
                    "gte": left >= right,
                    "lt": left < right,
                    "lte": left <= right,
                }
                return comparisons[operator], f"{cond_type}={left} {operator} {right}"

            elif operator == "is_true":
                result = fact_value is True
                return result, f"{cond_type} is_true"

            elif operator == "is_false":
                result = fact_value is False
                return result, f"{cond_type} is_false"

            else:
                return False, f"Unknown operator: {operator}"

        except Exception as e:
            return False, f"{cond_type} error: {str(e)}"


class RoutingRulesValidator:
    """Validates routing rules against test scenarios."""

    def __init__(self, context_root: Path):
        self.context_root = context_root
        self.schema_path = context_root / "rules" / "routing-rules.schema.json"
        self.ruleset_path = context_root / "rules" / "routing-rules.json"
        self.scenarios_path = context_root / "rules" / "routing-rules.scenarios.json"

        self.schema: Optional[Dict[str, Any]] = None
        self.prod_rules: Optional[Dict[str, Any]] = None
        self.test_rules: Optional[Dict[str, Any]] = None
        self.rules_by_priority: List[Dict[str, Any]] = []

    def load_files(self) -> Tuple[bool, List[str]]:
        """Load all required files. Returns (success, errors)."""
        errors = []

        # Load schema
        if not self.schema_path.exists():
            errors.append(f"Schema not found: {self.schema_path}")
        else:
            try:
                with open(self.schema_path, 'r', encoding='utf-8') as f:
                    self.schema = json.load(f)
            except json.JSONDecodeError as e:
                errors.append(f"Invalid JSON in schema: {e}")

        # Load runtime ruleset
        if not self.ruleset_path.exists():
            errors.append(f"Runtime routing rules not found: {self.ruleset_path}")
        else:
            try:
                with open(self.ruleset_path, 'r', encoding='utf-8') as f:
                    self.prod_rules = json.load(f)
                self._sort_rules_by_priority()
            except json.JSONDecodeError as e:
                errors.append(f"Invalid JSON in runtime routing rules: {e}")

        # Load scenario definitions
        if not self.scenarios_path.exists():
            errors.append(f"Routing scenarios not found: {self.scenarios_path}")
        else:
            try:
                with open(self.scenarios_path, 'r', encoding='utf-8') as f:
                    self.test_rules = json.load(f)
            except json.JSONDecodeError as e:
                errors.append(f"Invalid JSON in routing scenarios: {e}")

        return len(errors) == 0, errors

    def _sort_rules_by_priority(self):
        """Sort production rules by priority descending."""
        if not self.prod_rules:
            return

        rules = self.prod_rules.get("rules", [])
        enabled_rules = [r for r in rules if r.get("enabled", True)]
        self.rules_by_priority = sorted(
            enabled_rules,
            key=lambda r: r.get("priority", 0),
            reverse=True
        )

    def _validate_ruleset_with_jsonschema(self, payload: Dict[str, Any], label: str) -> List[str]:
        errors: List[str] = []

        if Draft202012Validator is None:
            return [
                "jsonschema dependency is not installed; cannot run full schema validation"
            ]

        try:
            validator = Draft202012Validator(self.schema)
            for error in sorted(validator.iter_errors(payload), key=lambda e: list(e.absolute_path)):
                location = "/".join(str(part) for part in error.absolute_path) or "$"
                errors.append(f"{label} schema error at {location}: {error.message}")
        except Exception as exc:
            errors.append(f"{label} schema validator crashed: {exc}")

        return errors

    def _validate_rule_groups(self, ruleset: Dict[str, Any], label: str, known_rule_ids: List[str]) -> List[str]:
        errors: List[str] = []
        rule_groups = ruleset.get("rule_groups", {})

        for group_name, group in rule_groups.items():
            for rule_id in group.get("rule_ids", []):
                if rule_id not in known_rule_ids:
                    errors.append(f"{label} rule_groups.{group_name} references unknown rule id '{rule_id}'")

        return errors

    def _validate_priority_bands(self, ruleset: Dict[str, Any], label: str) -> List[str]:
        errors: List[str] = []
        priority_bands = ruleset.get("priority_bands", {})

        for band_name, band in priority_bands.items():
            band_min = band.get("min")
            band_max = band.get("max")

            if not isinstance(band_min, int) or not isinstance(band_max, int):
                errors.append(f"{label} priority_bands.{band_name} must define integer min/max")
                continue

            if band_min > band_max:
                errors.append(f"{label} priority_bands.{band_name} has min > max")

        return errors

    def _extract_operation_values(self, condition: Dict[str, Any]) -> List[str]:
        if not isinstance(condition, dict):
            return []

        condition_type = condition.get("type")
        if condition_type in ["AND", "OR", "XOR"]:
            values: List[str] = []
            for expression in condition.get("expressions", []):
                values.extend(self._extract_operation_values(expression))
            return values

        if condition_type == "NOT":
            return self._extract_operation_values(condition.get("expression", {}))

        if condition_type != "operation_type":
            return []

        operator = condition.get("operator")
        value = condition.get("value")
        if operator == "eq" and isinstance(value, str):
            return [value]
        if operator == "in" and isinstance(value, list):
            return [str(item) for item in value]

        return []

    def _validate_execute_direct_safety(self, ruleset: Dict[str, Any], label: str) -> List[str]:
        errors: List[str] = []

        for rule in ruleset.get("rules", []):
            action_type = rule.get("action", {}).get("type")
            if action_type != "EXECUTE_DIRECT":
                continue

            operation_values = set(self._extract_operation_values(rule.get("condition", {})))
            if not operation_values:
                errors.append(
                    f"{label} rule '{rule.get('id', 'unknown')}' uses EXECUTE_DIRECT without an explicit safe operation_type condition"
                )
                continue

            unsafe_ops = sorted(op for op in operation_values if op not in SAFE_DIRECT_OPERATION_TYPES)
            if unsafe_ops:
                errors.append(
                    f"{label} rule '{rule.get('id', 'unknown')}' uses EXECUTE_DIRECT for unsafe operation_type values: {unsafe_ops}"
                )

        return errors

    def _validate_ruleset_semantics(self, ruleset: Dict[str, Any], label: str) -> List[str]:
        errors: List[str] = []
        rules = ruleset.get("rules", [])

        rule_ids = [rule.get("id", "") for rule in rules]
        duplicate_rule_ids = sorted({rule_id for rule_id in rule_ids if rule_id and rule_ids.count(rule_id) > 1})
        for rule_id in duplicate_rule_ids:
            errors.append(f"{label} rules contain duplicate id '{rule_id}'")

        errors.extend(self._validate_rule_groups(ruleset, label, rule_ids))
        errors.extend(self._validate_priority_bands(ruleset, label))
        errors.extend(self._validate_execute_direct_safety(ruleset, label))

        return errors

    def validate_schema(self) -> Tuple[bool, List[str]]:
        """Validate that routing files conform to schema and safety rules."""
        if not self.schema or not self.prod_rules:
            return False, ["Schema or prod rules not loaded"]

        errors: List[str] = []
        errors.extend(self._validate_ruleset_with_jsonschema(self.prod_rules, "runtime rules"))
        errors.extend(self._validate_ruleset_semantics(self.prod_rules, "runtime rules"))

        if self.test_rules:
            errors.extend(self._validate_ruleset_with_jsonschema(self.test_rules, "routing scenarios"))
            errors.extend(self._validate_ruleset_semantics(self.test_rules, "routing scenarios"))

        return len(errors) == 0, errors

    def _is_kebab_case(self, text: str) -> bool:
        """Check if string is in kebab-case."""
        return bool(text) and text.islower() and all(c.isalnum() or c == '-' for c in text)

    def _is_valid_condition(self, condition: Dict[str, Any]) -> bool:
        """Check if condition has valid structure."""
        if not isinstance(condition, dict):
            return False

        cond_type = condition.get("type", "")
        valid_logical = ["AND", "OR", "NOT", "XOR"]
        valid_atomic = [
            "repo_type", "file_extension", "file_path", "task_type",
            "operation_type", "context_contains", "has_dependency",
            "parallel_safe", "is_test_file", "is_config_file",
            "is_documentation", "repo_path_pattern", "session_exists",
            "memory_available", "context_files_found", "branch_status",
            "custom"
        ]

        if cond_type in valid_logical:
            expressions = condition.get("expressions", [])
            return isinstance(expressions, list) and len(expressions) > 0

        return cond_type in valid_atomic

    def _is_valid_action(self, action: Dict[str, Any]) -> bool:
        """Check if action has valid structure."""
        if not isinstance(action, dict):
            return False

        action_type = action.get("type", "")
        valid_types = [
            "DELEGATE", "DELEGATE_WITH_CONTEXT", "EXECUTE_DIRECT",
            "SKIP", "REQUEST_APPROVAL", "FAIL", "CHAIN"
        ]

        if action_type not in valid_types:
            return False

        if action_type in ["DELEGATE", "DELEGATE_WITH_CONTEXT"]:
            return "agent" in action

        return True

    def find_matching_rule(self, facts: Dict[str, Any]) -> Tuple[Optional[Dict], str]:
        """Find first matching rule for given facts."""
        evaluator = ConditionEvaluator(facts)

        for rule in self.rules_by_priority:
            condition = rule.get("condition", {})
            matched, reason = evaluator.evaluate(condition)

            if matched:
                return rule, reason

        return None, "No rules matched (deterministic FAIL fallback)"

    def run_scenarios(self) -> List[TestResult]:
        """Run all test scenarios."""
        if not self.test_rules:
            return []

        results = []
        scenarios = self.test_rules.get("test_scenarios", [])

        for scenario in scenarios:
            result = self._run_single_scenario(scenario)
            self._write_audit_events_for_scenario(scenario, result)
            results.append(result)

        return results

    def _write_audit_events_for_scenario(self, scenario: Dict[str, Any], result: TestResult) -> None:
        if append_audit_event is None:
            return

        expected_action = scenario.get("expected_action", {})
        action_type = expected_action.get("type")
        agent = expected_action.get("agent")
        matched_rule = result.actual or scenario.get("expected_rule")
        base_event = {
            "session_id": "routing-validation",
            "input_facts": scenario.get("input", {}),
            "matched_rule": matched_rule,
            "action": expected_action,
            "agent": agent,
        }

        append_audit_event({
            **base_event,
            "event_type": "routing_decision",
            "result": result.status.value,
            "metadata": {"scenario_id": scenario.get("id"), "message": result.message},
        })

        if action_type == "REQUEST_APPROVAL":
            append_audit_event({
                **base_event,
                "event_type": "approval_decision",
                "result": "approval_required",
                "metadata": {"scenario_id": scenario.get("id")},
            })
        elif action_type in {"DELEGATE", "DELEGATE_WITH_CONTEXT"}:
            append_audit_event({
                **base_event,
                "event_type": "subagent_handoff",
                "result": "handoff_required",
                "metadata": {"scenario_id": scenario.get("id")},
            })

    def _run_single_scenario(self, scenario: Dict[str, Any]) -> TestResult:
        """Run a single test scenario."""
        scenario_id = scenario.get("id", "unknown")
        scenario_name = scenario.get("name", "Unnamed scenario")

        try:
            # Get input facts
            input_facts = scenario.get("input", {})
            expected_rule_id = scenario.get("expected_rule", "")
            expected_action = scenario.get("expected_action", {})

            # Find matching rule
            matched_rule, reason = self.find_matching_rule(input_facts)

            if matched_rule is None:
                expected_type = expected_action.get("type", "")
                if expected_type == "FAIL":
                    return TestResult(
                        scenario_id=scenario_id,
                        scenario_name=scenario_name,
                        status=TestStatus.PASS,
                        expected="FAIL(fallback)",
                        actual="FAIL(fallback)",
                        message="No rule matched; deterministic fail fallback triggered",
                        details={
                            "reason": reason,
                            "expected_action": expected_action,
                        }
                    )

                return TestResult(
                    scenario_id=scenario_id,
                    scenario_name=scenario_name,
                    status=TestStatus.FAIL,
                    expected=expected_rule_id,
                    actual=None,
                    message="No rule matched (deterministic FAIL fallback)"
                )

            matched_rule_id = matched_rule.get("id", "")
            matched_action_type = matched_rule.get("action", {}).get("type", "")
            matched_agent = matched_rule.get("action", {}).get("agent", "")
            matched_skill = matched_rule.get("action", {}).get("skill", "")

            # Check expected rule
            if expected_rule_id and matched_rule_id != expected_rule_id:
                return TestResult(
                    scenario_id=scenario_id,
                    scenario_name=scenario_name,
                    status=TestStatus.FAIL,
                    expected=expected_rule_id,
                    actual=matched_rule_id,
                    message=f"Rule mismatch",
                    details={
                        "reason": reason,
                        "expected_action": expected_action,
                        "actual_action": matched_rule.get("action", {})
                    }
                )

            # Check expected action
            if expected_action:
                expected_type = expected_action.get("type", "")
                expected_agent = expected_action.get("agent", "")
                expected_skill = expected_action.get("skill", "")

                if expected_type and matched_action_type != expected_type:
                    return TestResult(
                        scenario_id=scenario_id,
                        scenario_name=scenario_name,
                        status=TestStatus.FAIL,
                        expected=f"{expected_type}→{expected_agent}",
                        actual=f"{matched_action_type}→{matched_agent}",
                        message="Action type mismatch"
                    )

                if expected_agent and matched_agent != expected_agent:
                    return TestResult(
                        scenario_id=scenario_id,
                        scenario_name=scenario_name,
                        status=TestStatus.FAIL,
                        expected=f"{expected_type}→{expected_agent}",
                        actual=f"{matched_action_type}→{matched_agent}",
                        message="Agent mismatch"
                    )

                if expected_skill and matched_skill != expected_skill:
                    return TestResult(
                        scenario_id=scenario_id,
                        scenario_name=scenario_name,
                        status=TestStatus.FAIL,
                        expected=f"skill={expected_skill}",
                        actual=f"skill={matched_skill}",
                        message="Skill mismatch"
                    )

            return TestResult(
                scenario_id=scenario_id,
                scenario_name=scenario_name,
                status=TestStatus.PASS,
                expected=expected_rule_id,
                actual=matched_rule_id,
                message=f"Matched: {matched_rule_id}",
                details={
                    "reason": reason,
                    "action": matched_rule.get("action", {})
                }
            )

        except Exception as e:
            return TestResult(
                scenario_id=scenario_id,
                scenario_name=scenario_name,
                status=TestStatus.ERROR,
                message=f"Error running scenario: {str(e)}"
            )


def get_status_symbol(status: TestStatus, use_colors: bool = True) -> str:
    """Get status symbol, using ASCII on Windows."""
    if Color.ascii_mode():
        return {
            TestStatus.PASS: "[PASS]",
            TestStatus.FAIL: "[FAIL]",
            TestStatus.SKIP: "[SKIP]",
            TestStatus.ERROR: "[ERROR]"
        }.get(status, "?")
    return {
        TestStatus.PASS: "PASS",
        TestStatus.FAIL: "FAIL",
        TestStatus.SKIP: "SKIP",
        TestStatus.ERROR: "ERROR"
    }.get(status, "?")


def print_result(result: TestResult, verbose: bool = False, use_colors: bool = True):
    """Print a single test result."""
    status_symbol = get_status_symbol(result.status, use_colors)

    status_colors = {
        TestStatus.PASS: Color.GREEN if use_colors else "",
        TestStatus.FAIL: Color.RED if use_colors else "",
        TestStatus.SKIP: Color.YELLOW if use_colors else "",
        TestStatus.ERROR: Color.RED if use_colors else ""
    }

    color_end = Color.RESET if use_colors else ""
    status_color = status_colors.get(result.status, "")

    print(f"  {status_color}{status_symbol}{color_end} {result.scenario_id}: {result.scenario_name}")

    if verbose or result.status != TestStatus.PASS:
        if result.expected:
            print(f"      Expected: {result.expected}")
        if result.actual:
            print(f"      Actual:   {result.actual}")
        if result.message:
            print(f"      Message:  {result.message}")

        if verbose and result.details:
            print(f"      Details:  {json.dumps(result.details, indent=6)}")


def print_summary(result: ValidationResult, use_colors: bool = True):
    """Print validation summary."""
    color_end = Color.RESET if use_colors else ""

    print("\n" + "=" * 60)
    print(f"{Color.BOLD}SUMMARY{color_end}")
    print("=" * 60)

    # Schema status
    if Color.ascii_mode():
        schema_status = "VALID" if result.schema_valid else "INVALID"
        if not result.schema_valid:
            schema_status = "!" + schema_status
        print(f"Schema:       {schema_status}")
    else:
        schema_status = f"{Color.GREEN}[VALID]{color_end}" if result.schema_valid else f"{Color.RED}[INVALID]{color_end}"
        print(f"Schema:       {schema_status}")

    # Test summary
    if use_colors:
        passed_color = Color.GREEN
        failed_color = Color.RED
        skipped_color = Color.YELLOW
    else:
        passed_color = failed_color = skipped_color = ""

    print(f"Tests Passed: {passed_color}{result.tests_passed}{color_end}")
    print(f"Tests Failed: {failed_color}{result.tests_failed}{color_end}")
    print(f"Tests Skipped:{skipped_color}{result.tests_skipped}{color_end}")
    print(f"Success Rate: {result.success_rate:.1f}%")
    print("=" * 60)

    # Errors
    if result.errors:
        print(f"\n{Color.RED}ERRORS:{color_end}")
        for error in result.errors:
            print(f"  - {error}")


def main():
    parser = argparse.ArgumentParser(
        description="Validate routing rules against test scenarios"
    )
    parser.add_argument(
        "--schema-only",
        action="store_true",
        help="Run schema validation only"
    )
    parser.add_argument(
        "--scenarios-only",
        action="store_true",
        help="Run test scenarios only"
    )
    parser.add_argument(
        "--verbose", "-v",
        action="store_true",
        help="Show detailed output"
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="Output results as JSON (for CI)"
    )
    parser.add_argument(
        "--context-root",
        type=str,
        default=None,
        help="Path to context root directory"
    )

    args = parser.parse_args()

    # Determine context root
    if args.context_root:
        context_root = Path(args.context_root)
    else:
        # Try to find context root relative to script
        script_dir = Path(__file__).parent.parent
        context_root = script_dir / "context" / "core"

        if not context_root.exists():
            # Try current working directory
            context_root = Path.cwd() / "context" / "core"

    if not context_root.exists():
        error_msg = f"Context root not found: {context_root}"
        if args.json:
            print(json.dumps({"error": error_msg}))
            sys.exit(1)
        print(f"Error: {error_msg}")
        sys.exit(1)

    # Initialize validator
    validator = RoutingRulesValidator(context_root)

    # Load files
    success, load_errors = validator.load_files()
    if not success:
        result = ValidationResult(
            schema_valid=False,
            tests_passed=0,
            tests_failed=0,
            tests_skipped=0,
            errors=load_errors
        )
        if args.json:
            print(json.dumps({
                "success": False,
                "errors": load_errors
            }))
        else:
            print("Failed to load files:")
            for error in load_errors:
                print(f"  - {error}")
        sys.exit(1)

    # Run validation
    validation_result = ValidationResult(
        schema_valid=True,
        tests_passed=0,
        tests_failed=0,
        tests_skipped=0
    )

    use_colors = Color.enabled() and not args.json
    color_end = Color.RESET if use_colors else ""

    # Schema validation
    if not args.scenarios_only:
        print(f"\n{Color.BOLD}Schema Validation{color_end}")
        print("-" * 60)

        schema_valid, schema_errors = validator.validate_schema()
        validation_result.schema_valid = schema_valid

        if Color.ascii_mode():
            status = "[PASS]" if schema_valid else "[FAIL]"
            print(f"Schema validation {status}")
        else:
            if schema_valid:
                print(f"{Color.GREEN}[PASS] Schema validation passed{color_end}")
            else:
                print(f"{Color.RED}[FAIL] Schema validation failed{color_end}")

        if not schema_valid:
            for error in schema_errors:
                print(f"  - {error}")
                validation_result.errors.append(error)

        print()

    # Scenario testing
    if not args.schema_only:
        print(f"{Color.BOLD}Test Scenarios{color_end}")
        print("-" * 60)

        results = validator.run_scenarios()
        validation_result.results = results

        passed = failed = skipped = error = 0
        for result in results:
            if result.status == TestStatus.PASS:
                passed += 1
            elif result.status == TestStatus.FAIL:
                failed += 1
            elif result.status == TestStatus.SKIP:
                skipped += 1
            else:
                error += 1

            print_result(result, args.verbose, use_colors)

        validation_result.tests_passed = passed
        validation_result.tests_failed = failed
        validation_result.tests_skipped = skipped + error

        print()
        print_summary(validation_result, use_colors)

    # JSON output for CI
    if args.json:
        output = {
            "success": validation_result.schema_valid and validation_result.tests_failed == 0,
            "schema_valid": validation_result.schema_valid,
            "tests": {
                "passed": validation_result.tests_passed,
                "failed": validation_result.tests_failed,
                "skipped": validation_result.tests_skipped,
                "total": validation_result.total_tests,
                "success_rate": validation_result.success_rate
            },
            "results": [r.to_dict() for r in validation_result.results],
            "errors": validation_result.errors
        }
        print(json.dumps(output, indent=2))

    # Exit code
    if validation_result.tests_failed > 0 or not validation_result.schema_valid:
        sys.exit(1)
    sys.exit(0)


if __name__ == "__main__":
    main()
