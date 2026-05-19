#!/usr/bin/env python3
"""
Memory Routing Policy Validator

Validates deterministic source routing policy and scenarios.
This validator checks source selection rules, not subagent delegation.

Usage:
    python scripts/validate_memory_routing_policy.py --config-root context/core/config
    python scripts/validate_memory_routing_policy.py --json
"""

import argparse
import json
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional


if sys.platform == "win32":
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")


REQUIRED_QUERY_TYPES = [
    "project_context_lookup",
    "implementation_fact",
    "standards_workflow_lookup",
    "internal_long_form_documentation",
    "external_library_lookup",
    "durable_writeback",
]


@dataclass
class CheckResult:
    id: str
    name: str
    passed: bool
    message: str
    details: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "status": "PASS" if self.passed else "FAIL",
            "message": self.message,
            "details": self.details,
        }


class MemoryRoutingPolicyValidator:
    def __init__(self, config_root: Path):
        self.config_root = config_root
        self.policy_path = config_root / "memory-routing-policy.json"
        self.scenarios_path = config_root / "memory-routing-policy.scenarios.json"
        self.memory_schema_path = config_root / "memory-entry.schema.json"
        self.policy: Optional[Dict[str, Any]] = None
        self.scenarios: Optional[Dict[str, Any]] = None
        self.memory_schema: Optional[Dict[str, Any]] = None

    def load_files(self) -> List[str]:
        errors: List[str] = []
        self.policy = self._load_json(self.policy_path, errors)
        self.scenarios = self._load_json(self.scenarios_path, errors)
        self.memory_schema = self._load_json(self.memory_schema_path, errors)
        return errors

    def _load_json(self, path: Path, errors: List[str]) -> Optional[Dict[str, Any]]:
        if not path.exists():
            errors.append(f"File not found: {path}")
            return None

        try:
            with open(path, "r", encoding="utf-8") as handle:
                return json.load(handle)
        except json.JSONDecodeError as exc:
            errors.append(f"Invalid JSON in {path}: {exc}")
            return None

    def validate_structure(self) -> List[str]:
        errors: List[str] = []
        if not self.policy:
            return ["Policy is not loaded"]

        query_types = self.policy.get("query_types")
        if not isinstance(query_types, dict):
            return ["memory-routing-policy.json must define object query_types"]

        for query_type in REQUIRED_QUERY_TYPES:
            if query_type not in query_types:
                errors.append(f"Missing required query type: {query_type}")

        durable_writeback = query_types.get("durable_writeback", {})
        if durable_writeback.get("schema") != "context/core/config/memory-entry.schema.json":
            errors.append("durable_writeback.schema must point to context/core/config/memory-entry.schema.json")

        allowed_types = durable_writeback.get("allowed_types", [])
        schema_types = self._memory_schema_type_tags()
        if schema_types and sorted(allowed_types) != sorted(schema_types):
            errors.append(
                "durable_writeback.allowed_types must match memory-entry.schema.json type tag enum: "
                f"policy={sorted(allowed_types)}, schema={sorted(schema_types)}"
            )

        return errors

    def _memory_schema_type_tags(self) -> List[str]:
        if not self.memory_schema:
            return []

        try:
            all_of = self.memory_schema["properties"]["tags"]["allOf"]
            for item in all_of:
                contains = item.get("contains", {})
                enum = contains.get("enum")
                if isinstance(enum, list):
                    return [str(value) for value in enum]
        except (KeyError, TypeError):
            return []

        return []

    def run_scenarios(self) -> List[CheckResult]:
        if not self.policy or not self.scenarios:
            return []

        results: List[CheckResult] = []
        query_types = self.policy.get("query_types", {})

        for scenario in self.scenarios.get("test_scenarios", []):
            scenario_id = scenario.get("id", "unknown")
            scenario_name = scenario.get("name", "Unnamed scenario")
            query_type = scenario.get("query_type")
            expected = scenario.get("expected", {})
            candidate = scenario.get("candidate")
            expected_decision = scenario.get("expected_decision")
            actual = query_types.get(query_type)

            if not actual:
                results.append(CheckResult(scenario_id, scenario_name, False, f"Missing query type: {query_type}"))
                continue

            failures = self._compare_expected(actual, expected)
            if candidate is not None or expected_decision is not None:
                failures.extend(self._compare_writeback_decision(actual, candidate, expected_decision))
            if failures:
                results.append(
                    CheckResult(
                        scenario_id,
                        scenario_name,
                        False,
                        "; ".join(failures),
                        {"query_type": query_type, "actual": actual, "expected": expected},
                    )
                )
            else:
                results.append(CheckResult(scenario_id, scenario_name, True, "Scenario passed", {"query_type": query_type}))

        return results

    def _compare_expected(self, actual: Dict[str, Any], expected: Dict[str, Any]) -> List[str]:
        failures: List[str] = []

        for key, expected_value in expected.items():
            if key.endswith("_includes"):
                actual_key = key.removesuffix("_includes")
                failures.extend(self._assert_includes(actual_key, actual.get(actual_key), expected_value))
            elif key == "tools_include":
                failures.extend(self._assert_includes("tools", actual.get("tools"), expected_value))
            elif key == "forbidden_content_includes":
                failures.extend(self._assert_includes("forbidden_content", actual.get("forbidden_content"), expected_value))
            elif key == "allowed_types_match_memory_schema":
                if expected_value:
                    policy_types = sorted(str(item) for item in actual.get("allowed_types", []))
                    schema_types = sorted(self._memory_schema_type_tags())
                    if policy_types != schema_types:
                        failures.append(f"allowed_types mismatch: policy={policy_types}, schema={schema_types}")
            elif actual.get(key) != expected_value:
                failures.append(f"{key}: expected {expected_value!r}, got {actual.get(key)!r}")

        return failures

    def _compare_writeback_decision(
        self,
        actual: Dict[str, Any],
        candidate: Optional[Dict[str, Any]],
        expected_decision: Optional[str],
    ) -> List[str]:
        if candidate is None:
            return ["candidate is required for writeback decision scenario"]
        if expected_decision not in {"save", "skip"}:
            return ["expected_decision must be 'save' or 'skip'"]

        actual_decision, reason = self._evaluate_writeback_candidate(actual, candidate)
        if actual_decision != expected_decision:
            return [f"writeback decision: expected {expected_decision!r}, got {actual_decision!r} ({reason})"]

        return []

    def _evaluate_writeback_candidate(self, policy: Dict[str, Any], candidate: Dict[str, Any]) -> tuple[str, str]:
        content_kind = str(candidate.get("content_kind", ""))
        primary_type = str(candidate.get("primary_type", ""))
        skip_when = set(str(item) for item in policy.get("skip_when", []))
        forbidden_content = set(str(item) for item in policy.get("forbidden_content", []))
        allowed_types = set(str(item) for item in policy.get("allowed_types", []))

        if content_kind in skip_when or content_kind in forbidden_content:
            return "skip", f"content_kind {content_kind!r} is forbidden or configured to skip"

        if primary_type not in allowed_types:
            return "skip", f"primary_type {primary_type!r} is not allowed"

        required_flags = ["verified", "durable", "future_useful", "compact_summary", "project_tagged", "typed"]
        missing_flags = [flag for flag in required_flags if candidate.get(flag) is not True]
        if missing_flags:
            return "skip", f"missing required save flags: {missing_flags}"

        return "save", "candidate satisfies durable writeback policy"

    def _assert_includes(self, key: str, actual_value: Any, expected_values: Any) -> List[str]:
        failures: List[str] = []
        actual_list = actual_value if isinstance(actual_value, list) else []
        expected_list = expected_values if isinstance(expected_values, list) else [expected_values]

        for expected in expected_list:
            if expected not in actual_list:
                failures.append(f"{key}: missing {expected!r}")

        return failures


def print_results(structure_errors: List[str], results: List[CheckResult]) -> None:
    print("Memory Routing Policy Validation")
    print("-" * 60)

    if structure_errors:
        print("Structure: [FAIL]")
        for error in structure_errors:
            print(f"  - {error}")
    else:
        print("Structure: [PASS]")

    print("\nScenarios")
    for result in results:
        status = "[PASS]" if result.passed else "[FAIL]"
        print(f"  {status} {result.id}: {result.name}")
        if not result.passed:
            print(f"      {result.message}")

    passed = sum(1 for result in results if result.passed)
    failed = len(results) - passed
    print("\n" + "=" * 60)
    print(f"Structure Errors: {len(structure_errors)}")
    print(f"Scenarios Passed: {passed}")
    print(f"Scenarios Failed: {failed}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Validate deterministic memory source routing policy")
    parser.add_argument("--config-root", type=str, default=None, help="Path to context/core/config")
    parser.add_argument("--json", action="store_true", help="Output JSON result")
    args = parser.parse_args()

    if args.config_root:
        config_root = Path(args.config_root)
    else:
        config_root = Path(__file__).parent.parent / "context" / "core" / "config"

    validator = MemoryRoutingPolicyValidator(config_root)
    load_errors = validator.load_files()
    structure_errors = load_errors + ([] if load_errors else validator.validate_structure())
    results = [] if load_errors else validator.run_scenarios()
    success = not structure_errors and all(result.passed for result in results)

    if args.json:
        print(json.dumps({
            "success": success,
            "structure_errors": structure_errors,
            "tests": {
                "passed": sum(1 for result in results if result.passed),
                "failed": sum(1 for result in results if not result.passed),
                "total": len(results),
            },
            "results": [result.to_dict() for result in results],
        }, indent=2))
    else:
        print_results(structure_errors, results)

    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
