#!/usr/bin/env python3
"""Validate emitted evidence with the formal JSON Schema 2020-12 contract."""

import argparse
import copy
import json
from pathlib import Path

from jsonschema import Draft202012Validator


def load_json(path):
    with Path(path).open(encoding="utf-8") as handle:
        return json.load(handle)


def format_path(error):
    location = "/".join(str(part) for part in error.absolute_path)
    return location or "<root>"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("schema")
    parser.add_argument("evidence", nargs="+")
    parser.add_argument("--assert-contract", action="store_true")
    args = parser.parse_args()

    schema = load_json(args.schema)
    Draft202012Validator.check_schema(schema)
    validator = Draft202012Validator(schema)
    documents = []
    failed = False
    for evidence_path in args.evidence:
        document = load_json(evidence_path)
        documents.append(document)
        errors = sorted(validator.iter_errors(document), key=lambda item: list(item.absolute_path))
        if errors:
            failed = True
            for error in errors:
                print(f"{evidence_path}:{format_path(error)}: {error.message}")
        else:
            print(f"valid: {evidence_path}")

    if args.assert_contract:
        malformed = copy.deepcopy(documents[0])
        del malformed["project_context"]["project_forms"]["primary"]["id"]
        if not list(validator.iter_errors(malformed)):
            raise SystemExit("schema contract test failed: malformed project form was accepted")
        malformed = copy.deepcopy(documents[0])
        malformed["unexpected"] = True
        if not list(validator.iter_errors(malformed)):
            raise SystemExit("schema contract test failed: unknown root property was accepted")
        print("schema rejection contract passed")

    if failed:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
