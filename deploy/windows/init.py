"""init.py — Guided setup for LMF instance.

Called by bootstrap.ps1 after initial file copy and config creation.
Prompts the operator for vault display name, AI assistant name,
optional PDF knowledge base path, and init persona preferences.

Writes:
- cockpit/app-config.js     — web UI instance branding
- lmf/operator/deploy.yaml  — init persona config (instance_name, trust_profile, onboarding_mode)
- lmf/operator/config.yaml  — orchestrator config (via yaml.dump for safe quoting)
"""

import os
import platform
import shutil
import sys
from pathlib import Path

import yaml


def detect_os():
    system = platform.system()
    return {
        "Windows": {"sep": "\\", "default_root": Path(os.environ.get("USERPROFILE", "C:\\Users\\Default"))},
        "Linux": {"sep": "/", "default_root": Path.home()},
        "Darwin": {"sep": "/", "default_root": Path.home()},
    }.get(system, {"sep": "/", "default_root": Path.home()})


def get_ram_gb():
    try:
        system = platform.system()
        if system == "Linux":
            with open("/proc/meminfo") as f:
                for line in f:
                    if line.startswith("MemTotal:"):
                        return int(line.split()[1]) // (1024 * 1024)
        elif system == "Windows":
            import ctypes
            class MEMORYSTATUSEX(ctypes.Structure):
                _fields_ = [
                    ("dwLength", ctypes.c_ulong),
                    ("dwMemoryLoad", ctypes.c_ulong),
                    ("ullTotalPhys", ctypes.c_ulonglong),
                    ("ullAvailPhys", ctypes.c_ulonglong),
                    ("ullTotalPageFile", ctypes.c_ulonglong),
                    ("ullAvailPageFile", ctypes.c_ulonglong),
                    ("ullTotalVirtual", ctypes.c_ulonglong),
                    ("ullAvailVirtual", ctypes.c_ulonglong),
                    ("ullAvailExtendedVirtual", ctypes.c_ulonglong),
                ]
            mem = MEMORYSTATUSEX()
            mem.dwLength = ctypes.sizeof(MEMORYSTATUSEX)
            ctypes.windll.kernel32.GlobalMemoryStatusEx(ctypes.byref(mem))
            return mem.ullTotalPhys // (1024 ** 3)
        elif system == "Darwin":
            import subprocess
            result = subprocess.run(["sysctl", "-n", "hw.memsize"], capture_output=True, text=True)
            return int(result.stdout.strip()) // (1024 ** 3)
    except Exception:
        return None


def get_disk_free_gb(path):
    try:
        usage = shutil.disk_usage(path)
        return usage.free // (1024 ** 3)
    except Exception:
        return None


def preflight(install_dir):
    issues = []
    warnings = []

    ram_gb = get_ram_gb()
    if ram_gb is not None:
        if ram_gb < 4:
            issues.append(f"RAM: {ram_gb} GB — minimum 4 GB required")
        elif ram_gb < 8:
            warnings.append(f"RAM: {ram_gb} GB — recommend 8+ GB for 7b models")
            print(f"  System RAM: {ram_gb} GB — will use qwen2.5:3b (light model)")
        else:
            print(f"  System RAM: {ram_gb} GB")
    else:
        warnings.append("Could not detect RAM — assuming 8+ GB")

    disk_gb = get_disk_free_gb(install_dir)
    if disk_gb is not None:
        if disk_gb < 5:
            issues.append(f"Free disk: {disk_gb} GB — minimum 5 GB required")
        elif disk_gb < 15:
            warnings.append(f"Free disk: {disk_gb} GB — models need ~6 GB, proceed with caution")
        else:
            print(f"  Free disk: {disk_gb} GB")
    else:
        warnings.append("Could not detect disk space")

    return issues, warnings, ram_gb


def suggest_model(ram_gb):
    if ram_gb is not None and ram_gb < 8:
        return "qwen2.5:3b"
    return "qwen2.5:7b"


def prompt_str(label, default):
    val = input(f"{label} [{default}]: ").strip()
    return val if val else default


def prompt_choice(label, choices, default):
    """Prompt for a choice from a list. Enter the exact value or accept default."""
    joined = "/".join(choices)
    val = input(f"{label} ({joined}) [{default}]: ").strip().lower()
    if val in choices:
        return val
    return default


def write_deploy_config(lmf_dir, instance_name, trust_profile, onboarding_mode):
    config_dir = Path(lmf_dir) / "operator"
    config_dir.mkdir(parents=True, exist_ok=True)
    dest = config_dir / "deploy.yaml"
    cfg = {
        "instance_name": instance_name,
        "trust_profile": trust_profile,
        "onboarding_mode": onboarding_mode,
    }
    dest.write_text(yaml.dump(cfg, default_flow_style=False, sort_keys=False), encoding="utf-8")
    return dest


def write_app_config(cockpit_dir, vault_name, ai_name):
    dest = Path(cockpit_dir) / "app-config.js"
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(
        f"window.APP_CONFIG = {{\n"
        f"  vaultName: {vault_name!r},\n"
        f"  aiName: {ai_name!r},\n"
        f"}};\n",
        encoding="utf-8",
    )
    return dest


def write_operator_config(lmf_dir, vault_name, ai_name, kb_path, model):
    config_dir = Path(lmf_dir) / "operator"
    config_dir.mkdir(parents=True, exist_ok=True)
    dest = config_dir / "config.yaml"
    if dest.is_file():
        return None
    cfg = {
        "vault_name": vault_name,
        "ai_name": ai_name,
        "model": model,
        "ollama_url": "http://localhost:11434/api/chat",
        "port": 8742,
        "num_ctx": 8192,
        "timeout_s": 300,
        "verbose_writes": False,
        "allow_external_writes": False,
    }
    if kb_path:
        cfg["kb_path"] = kb_path
        cfg["kb_embed_model"] = "nomic-embed-text"
    dest.write_text(yaml.dump(cfg, default_flow_style=False, sort_keys=False), encoding="utf-8")
    return dest


def main():
    os_info = detect_os()
    install_dir = Path(sys.argv[1]) if len(sys.argv) > 1 else os_info["default_root"] / "LMF"
    cockpit_dir = install_dir / "cockpit"
    lmf_dir = install_dir / "lmf"

    print("\n=== LMF Setup Wizard ===\n")
    print(f"  Platform: {platform.system()} {platform.release()}")
    print(f"  Install target: {install_dir}\n")

    issues, warnings, ram_gb = preflight(install_dir)

    if issues:
        print("\n  BLOCKING ISSUES:")
        for i in issues:
            print(f"    - {i}")
        print("\n  Resolve these before continuing.")
        input("Press Enter to exit")
        sys.exit(1)

    for w in warnings:
        print(f"  Warning: {w}")
    if warnings:
        print()

    model = suggest_model(ram_gb)

    vault_name = prompt_str("Vault display name", "Jedi_Archives")
    ai_name = prompt_str("AI assistant name", "Jocasta_Nu")
    kb_path = input("PDF knowledge base path (leave blank to skip): ").strip() or None
    if kb_path and not os.path.isdir(kb_path):
        print(f"  Warning: path does not exist or is not a directory: {kb_path}")
        kb_path = None

    # Deploy config for init persona
    instance_name = prompt_str("Instance name", "LMF")
    trust_profile = prompt_choice("Trust profile", ["personal", "professional", "mixed"], "personal")
    onboarding_mode = prompt_choice("Onboarding mode", ["guided", "quick", "skip"], "guided")

    write_app_config(cockpit_dir, vault_name, ai_name)
    print(f"  Cockpit config: {cockpit_dir / 'app-config.js'}")

    op_cfg = write_operator_config(lmf_dir, vault_name, ai_name, kb_path, model)
    if op_cfg:
        print(f"  Operator config: {op_cfg} (model: {model})")
    else:
        print(f"  Operator config exists — skipped")

    dep_cfg = write_deploy_config(lmf_dir, instance_name, trust_profile, onboarding_mode)
    print(f"  Deploy config: {dep_cfg}")

    print(f"\nInstance: {instance_name}")
    print(f"Profile:  {trust_profile} ({onboarding_mode})")
    print(f"Vault:    {vault_name}")
    print(f"AI:       {ai_name}")
    print(f"Model:    {model}")
    if kb_path:
        print(f"KB:       {kb_path}")
    print("\nSetup complete. You can now launch LMF.\n")


if __name__ == "__main__":
    main()
