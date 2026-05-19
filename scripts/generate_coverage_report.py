#!/usr/bin/env python3
"""
Generate coverage report for routing rules.

Analyzes how well test scenarios cover production rules.
"""

import json
import sys
from pathlib import Path
from typing import Dict, List, Any, Set, Tuple
from dataclasses import dataclass
import argparse

# Enable UTF-8 output on Windows
if sys.platform == "win32":
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')


@dataclass
class RuleCoverage:
    rule_id: str
    rule_name: str
    priority: int
    times_tested: int
    scenarios_covering: List[str]
    is_covered: bool


def load_rules(context_root: Path) -> Tuple[Dict, Dict]:
    """Load runtime rules and scenario tests."""
    rules_path = context_root / "rules" / "routing-rules.json"
    scenarios_path = context_root / "rules" / "routing-rules.scenarios.json"

    # Backward compatibility with the old prod/test split.
    if not rules_path.exists():
        rules_path = context_root / "rules" / "routing-rules.prod.json"
    if not scenarios_path.exists():
        scenarios_path = context_root / "rules" / "routing-rules.test.json"

    prod_rules = {}
    test_rules = {}

    if rules_path.exists():
        with open(rules_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
            for rule in data.get("rules", []):
                rule_id = rule.get("id", "unknown")
                prod_rules[rule_id] = rule

    if scenarios_path.exists():
        with open(scenarios_path, 'r', encoding='utf-8') as f:
            test_rules = json.load(f)

    return prod_rules, test_rules


def extract_condition_keys(condition: Dict, keys: Set[str] = None) -> Set[str]:
    """Extract all condition types used in a condition tree."""
    if keys is None:
        keys = set()

    cond_type = condition.get("type", "")

    if cond_type in ["AND", "OR", "NOT", "XOR"]:
        for expr in condition.get("expressions", []):
            extract_condition_keys(expr, keys)
    else:
        keys.add(cond_type)

    return keys


def analyze_rule_coverage(prod_rules: Dict, test_rules: Dict) -> List[RuleCoverage]:
    """Analyze coverage of production rules by test scenarios."""
    coverage = []
    test_scenarios = test_rules.get("test_scenarios", [])

    # Build map of test inputs to scenarios
    test_input_keys = {}
    for scenario in test_scenarios:
        scenario_id = scenario.get("id", "unknown")
        input_facts = scenario.get("input", {})
        expected_rule = scenario.get("expected_rule", "")

        key = tuple(sorted(input_facts.items()))
        if key not in test_input_keys:
            test_input_keys[key] = []
        test_input_keys[key].append({
            "id": scenario_id,
            "expected_rule": expected_rule
        })

    # Analyze each production rule
    for rule_id, rule in prod_rules.items():
        condition = rule.get("condition", {})
        condition_keys = extract_condition_keys(condition)

        # Find scenarios that should test this rule
        covering_scenarios = []
        for scenario in test_scenarios:
            if scenario.get("expected_rule") == rule_id:
                covering_scenarios.append(scenario.get("id", "unknown"))

        coverage.append(RuleCoverage(
            rule_id=rule_id,
            rule_name=rule.get("name", rule_id),
            priority=rule.get("priority", 0),
            times_tested=len(covering_scenarios),
            scenarios_covering=covering_scenarios,
            is_covered=len(covering_scenarios) > 0
        ))

    return coverage


def generate_report(coverage: List[RuleCoverage], prod_rules: Dict) -> str:
    """Generate markdown coverage report."""
    lines = []

    lines.append("# Routing Rules Coverage Report")
    lines.append("")

    # Summary
    total_rules = len(coverage)
    covered_rules = sum(1 for c in coverage if c.is_covered)
    coverage_percent = (covered_rules / total_rules * 100) if total_rules > 0 else 0

    lines.append("## Summary")
    lines.append("")
    lines.append(f"| Metric | Value |")
    lines.append(f"|--------|-------|")
    lines.append(f"| Total Rules | {total_rules} |")
    lines.append(f"| Covered Rules | {covered_rules} |")
    lines.append(f"| Coverage | {coverage_percent:.1f}% |")
    lines.append("")

    # Uncovered rules (priority order)
    uncovered = [c for c in coverage if not c.is_covered]
    if uncovered:
        lines.append("## Uncovered Rules (Priority Order)")
        lines.append("")
        lines.append("These rules have no test scenarios and should be tested:")
        lines.append("")
        lines.append("| Priority | Rule ID | Name |")
        lines.append("|----------|---------|------|")
        for c in sorted(uncovered, key=lambda x: -x.priority):
            lines.append(f"| {c.priority} | `{c.rule_id}` | {c.rule_name} |")
        lines.append("")

    # All rules by priority
    lines.append("## All Rules by Priority")
    lines.append("")
    lines.append("| Priority | Rule ID | Name | Tested |")
    lines.append("|----------|---------|------|--------|")
    for c in sorted(coverage, key=lambda x: -x.priority):
        status = "[+]" if c.is_covered else "[-]"
        lines.append(f"| {c.priority} | `{c.rule_id}` | {c.rule_name} | {status} |")
    lines.append("")

    # Recommendations
    lines.append("## Recommendations")
    lines.append("")

    high_priority_untested = [
        c for c in uncovered
        if c.priority >= 100
    ]

    if high_priority_untested:
        lines.append("### High Priority Rules Without Tests")
        lines.append("")
        lines.append("These rules have priority >= 100 but no test coverage:")
        lines.append("")
        for c in high_priority_untested:
            lines.append(f"- `{c.rule_id}` (priority {c.priority})")
        lines.append("")
        lines.append("Consider adding test scenarios for these rules.")
        lines.append("")

    critical_rules = [c for c in coverage if c.priority >= 150]
    critical_untested = [c for c in critical_rules if not c.is_covered]

    if critical_untested:
        lines.append("### Critical Rules Without Tests")
        lines.append("")
        lines.append("WARNING: These rules have priority >= 150 but no test coverage:")
        lines.append("")
        for c in critical_untested:
            lines.append(f"- **`{c.rule_id}`** (priority {c.priority})")
        lines.append("")
        lines.append("**These rules should be tested before deployment.**")
        lines.append("")

    if not uncovered:
        lines.append("All production rules have test coverage!")
        lines.append("")

    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser(description="Generate routing rules coverage report")
    parser.add_argument(
        "--context-root",
        type=str,
        default=None,
        help="Path to context root directory"
    )
    parser.add_argument(
        "--output",
        type=str,
        default=None,
        help="Output file path (default: stdout)"
    )

    args = parser.parse_args()

    # Determine context root
    if args.context_root:
        context_root = Path(args.context_root)
    else:
        script_dir = Path(__file__).parent.parent
        context_root = script_dir / "context" / "core"

    if not context_root.exists():
        print(f"Error: Context root not found: {context_root}")
        sys.exit(1)

    # Load rules
    prod_rules, test_rules = load_rules(context_root)

    if not prod_rules:
        print("Error: No production rules found")
        sys.exit(1)

    # Analyze coverage
    coverage = analyze_rule_coverage(prod_rules, test_rules)

    # Generate report
    report = generate_report(coverage, prod_rules)

    # Output
    if args.output:
        output_path = Path(args.output)
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(report)
        print(f"Report written to: {output_path}")
    else:
        print(report)


if __name__ == "__main__":
    main()
