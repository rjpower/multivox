#!/usr/bin/env python3
import json
import subprocess
import sys
from pathlib import Path
from typing import List, Optional


def run(
    args: List[str],
    cwd: str,
    env: Optional[dict] = None,
    text: bool = True,
):
    """Wrapper around subprocess.run that prints the command before executing."""
    print(f"Running: {' '.join(args)}")
    try:
        result = subprocess.run(
            args, cwd=cwd, env=env, capture_output=True, text=text, check=True
        )
        print("Success...")
        return result
    except subprocess.CalledProcessError as e:
        print(f"Error running {' '.join(args)}: {e}", file=sys.stderr)
        if e.stdout:
            print(e.stdout)
        if e.stderr:
            print(e.stderr, file=sys.stderr)
        raise


def clean_notebook(path: Path) -> bool:
    """Clean IPython notebook outputs and metadata."""
    try:
        with open(path) as f:
            nb = json.load(f)
        
        # Clear outputs and execution count
        for cell in nb.get('cells', []):
            if cell.get('cell_type') == 'code':
                cell['outputs'] = []
                cell['execution_count'] = None
        
        # Clean metadata
        if 'metadata' in nb:
            nb['metadata'] = {
                'kernelspec': nb['metadata'].get('kernelspec', {}),
                'language_info': nb['metadata'].get('language_info', {})
            }
        
        with open(path, 'w') as f:
            json.dump(nb, f, indent=1, sort_keys=True)
            f.write('\n')  # Add trailing newline
        return True
    except Exception as e:
        print(f"Error cleaning {path}: {e}", file=sys.stderr)
        return False

def main():
    root = Path(__file__).parent.parent.parent.resolve()
    git_dir = (root / ".git").resolve()
    git_env = {
        "GIT_WORK_TREE": str(root),
        "GIT_DIR": str(git_dir)
    }
    print(f"Debug - root: {root}")
    print(f"Debug - git_dir: {git_dir}")
    print(f"Debug - git_env: {git_env}")

    # Get staged notebooks and clean the
    result = run(
        ["git", "diff", "--cached", "--name-only", "--diff-filter=ACMR", "*.ipynb"],
        text=True,
        cwd=str(root),
        env=git_env,
    )
    staged_notebooks = result.stdout.splitlines()

    success = True
    for nb in staged_notebooks:
        if not clean_notebook(Path(root / nb)):
            success = False
        else:
            print(f"Cleaned {nb}")

    result = run(
        ["git", "diff", "--cached", "--name-only", "--diff-filter=ACMR", "*.py"],
        text=True,
        cwd=str(root),
    )
    staged_files = result.stdout.splitlines()

    print("Running precommit on <%d> staged files" % len(staged_files))

    if staged_files:
        # Run ruff on staged files
        print(str(root))
        run(
            ["uv", "run", "ruff", "check", "--fix"] + staged_files,
            text=True,
            cwd=str(root),
        )

    return 0 if success else 1

if __name__ == "__main__":
    main()
