#!/usr/bin/env python3
import json
import os
import re
import shlex
import shutil
import subprocess
import sys

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
CATALOG_PATH = os.path.abspath(os.path.join(SCRIPT_DIR, "..", "references", "command-catalog.md"))
PS_CALL = os.path.join(SCRIPT_DIR, "ps_call.sh")
LAST_OUTPUT_PATH = "/tmp/ps_nl_last.txt"


def load_command_catalog(path):
    commands = set()
    pattern = re.compile(r"^- `([^`]+)`")
    try:
        with open(path, "r", encoding="utf-8") as handle:
            for line in handle:
                match = pattern.match(line.strip())
                if match:
                    commands.add(match.group(1))
    except OSError as exc:
        raise RuntimeError("Failed to read command catalog: %s" % exc)
    return commands


def build_prompt(instruction, commands):
    sorted_commands = sorted(commands)
    return (
        "You are a router for Photoshop JSX commands.\n"
        "Return ONLY a JSON object with keys: command (string) and optional params (object).\n"
        "Do not include code fences, explanations, or extra text.\n"
        "Use only one of these commands:\n"
        + ", ".join(sorted_commands)
        + "\n"
        "User instruction: "
        + instruction
        + "\n"
        "Return JSON only."
    )


def run_llm(prompt):
    llm_cmd = os.environ.get("PS_LLM_CMD")
    if llm_cmd:
        cmd = shlex.split(llm_cmd)
    else:
        if shutil.which("codex") is None:
            raise RuntimeError("PS_LLM_CMD not set and 'codex' not found in PATH")
        cmd = ["codex", "exec"]

    if not cmd:
        raise RuntimeError("LLM command is empty")

    result = subprocess.run(
        cmd + [prompt],
        text=True,
        capture_output=True,
    )
    if result.returncode != 0:
        stderr = result.stderr.strip() if result.stderr else ""
        raise RuntimeError("LLM command failed: %s" % (stderr or "exit code %s" % result.returncode))

    return result.stdout


def parse_json_output(raw_text):
    text = raw_text.strip()
    if not text:
        raise ValueError("LLM output was empty")

    try:
        return json.loads(text)
    except json.JSONDecodeError:
        start = text.find("{")
        end = text.rfind("}")
        if start == -1 or end == -1 or end <= start:
            raise
        snippet = text[start : end + 1]
        return json.loads(snippet)


def save_raw_output(raw_text):
    try:
        with open(LAST_OUTPUT_PATH, "w", encoding="utf-8") as handle:
            handle.write(raw_text)
    except OSError:
        pass


def validate_payload(payload, commands):
    if not isinstance(payload, dict):
        raise ValueError("LLM output was not a JSON object")

    command = payload.get("command")
    if not isinstance(command, str) or not command:
        raise ValueError("Missing or invalid 'command'")

    if command not in commands:
        raise ValueError("Unknown command: %s" % command)

    params = payload.get("params", None)
    if params is not None and not isinstance(params, dict):
        raise ValueError("'params' must be an object when provided")

    cleaned = {"command": command}
    if params is not None:
        cleaned["params"] = params
    return cleaned


def main():
    if len(sys.argv) < 2:
        print("Usage: ps_nl.py <natural language instruction>", file=sys.stderr)
        return 1

    instruction = " ".join(sys.argv[1:]).strip()
    if not instruction:
        print("Instruction cannot be empty", file=sys.stderr)
        return 1

    try:
        commands = load_command_catalog(CATALOG_PATH)
        if not commands:
            raise RuntimeError("Command catalog is empty")
    except RuntimeError as exc:
        print(str(exc), file=sys.stderr)
        return 1

    prompt = build_prompt(instruction, commands)

    try:
        raw_output = run_llm(prompt)
    except RuntimeError as exc:
        print(str(exc), file=sys.stderr)
        return 1

    try:
        parsed = parse_json_output(raw_output)
        payload = validate_payload(parsed, commands)
    except (ValueError, json.JSONDecodeError) as exc:
        save_raw_output(raw_output)
        print("Failed to parse LLM output: %s" % exc, file=sys.stderr)
        print("Raw output saved to %s" % LAST_OUTPUT_PATH, file=sys.stderr)
        return 1

    request_json = json.dumps(payload, ensure_ascii=True)
    result = subprocess.run([PS_CALL, request_json])
    return result.returncode


if __name__ == "__main__":
    sys.exit(main())
