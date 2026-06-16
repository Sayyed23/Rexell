import os
import re
import subprocess
import hashlib
import sys

# Constants
WORKSPACE_DIR = os.path.abspath(r"d:\Rexell")
DIAGRAMS_DIR = os.path.join(WORKSPACE_DIR, "diagrams")
IMAGES_DIR = os.path.join(DIAGRAMS_DIR, "images")

# Ensure image directory exists
os.makedirs(IMAGES_DIR, exist_ok=True)

# Regex to find/replace mermaid blocks and optional preceding image tags
MERMAID_PATTERN = re.compile(
    r"(?:!\[[^\]]*\]\([^)]*\)\s*\n\s*)?(```mermaid\s*\n(.*?)\n\s*```)",
    re.DOTALL
)

def normalize_content(text):
    """Normalize mermaid code by stripping comments and whitespaces to check for uniqueness."""
    lines = text.strip().split('\n')
    cleaned = []
    for line in lines:
        line = line.strip()
        if line.startswith('%%') or not line:
            continue
        cleaned.append(line)
    return "".join("".join(cleaned).split())

def clean_label(filename):
    """Generate a clean user-friendly label from image filename."""
    name = os.path.splitext(os.path.basename(filename))[0]
    words = name.replace("_", " ").split()
    for i, w in enumerate(words):
        if w.lower() in ["er", "ml", "ai", "sdk", "kyc", "db", "evm", "rpc", "p2p"]:
            words[i] = w.upper()
        else:
            words[i] = w.capitalize()
    return " ".join(words)

def compile_mermaid(mmd_content, output_png_path):
    """Compile raw mermaid code to a PNG image using npx @mermaid-js/mermaid-cli."""
    temp_mmd = output_png_path + ".mmd"
    try:
        with open(temp_mmd, "w", encoding="utf-8") as f:
            f.write(mmd_content)
        
        print(f"Compiling {os.path.basename(output_png_path)}...")
        
        # Use npx -y @mermaid-js/mermaid-cli to execute mmdc
        # We specify scale 2 for crisp resolution, and a light background default (or transparent if it fits better)
        # Using a solid background style can be specified, but default transparent is fine
        cmd = ["npx", "-y", "@mermaid-js/mermaid-cli", "-i", temp_mmd, "-o", output_png_path, "-s", "2", "-b", "white"]
        
        res = subprocess.run(cmd, shell=True, capture_output=True, text=True)
        if res.returncode != 0:
            print(f"  [ERROR] Failed to compile: {res.stderr.strip()}")
            return False
        
        print(f"  [SUCCESS] Created {os.path.basename(output_png_path)}")
        return True
    except Exception as e:
        print(f"  [ERROR] Exception during compilation: {e}")
        return False
    finally:
        if os.path.exists(temp_mmd):
            try:
                os.remove(temp_mmd)
            except Exception:
                pass

def find_all_markdown_files():
    """Scan the workspace recursively for markdown files, ignoring node_modules, .git, etc."""
    ignore_dirs = {".git", "node_modules", ".venv", "venv", "env", ".agent", ".pytest_cache", ".kiro", "cache"}
    md_files = []
    for root, dirs, files in os.walk(WORKSPACE_DIR):
        # Prune ignored directories
        dirs[:] = [d for d in dirs if d not in ignore_dirs]
        for file in files:
            if file.endswith(".md"):
                md_files.append(os.path.join(root, file))
    return md_files

def main():
    # 1. Locate all markdown files
    md_files = find_all_markdown_files()
    print(f"Found {len(md_files)} markdown files in workspace.")

    # Dictionary to track unique diagram contents and their compiled image filename
    # key: normalized_content, value: image_filename
    compiled_diagrams = {}
    
    # Track used image filenames to prevent collision
    used_filenames = set()

    # Step 1: Scan all files to extract blocks and build/compile unique diagrams
    # We prioritize individual files in the diagrams/ directory for cleaner base naming
    sorted_files = sorted(md_files, key=lambda p: 0 if "diagrams" in p else 1)

    print("\n=== Phase 1: Scanning and Rendering Diagrams ===")
    for file_path in sorted_files:
        rel_path = os.path.relpath(file_path, WORKSPACE_DIR)
        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read()
        
        matches = list(MERMAID_PATTERN.finditer(content))
        if not matches:
            continue
            
        print(f"\nProcessing {rel_path} ({len(matches)} diagrams)...")
        file_basename = os.path.splitext(os.path.basename(file_path))[0]
        
        for idx, match in enumerate(matches, 1):
            full_match_text, mermaid_code = match.group(1), match.group(2)
            normalized = normalize_content(mermaid_code)
            
            # If we already compiled this diagram, reuse it
            if normalized in compiled_diagrams:
                print(f"  Diagram {idx} matches an already rendered diagram ({compiled_diagrams[normalized]}). Reusing.")
                continue
            
            # Determine a unique filename for the image
            candidate_base = file_basename
            if len(matches) > 1:
                candidate_base = f"{file_basename}_{idx}"
            
            # Ensure unique filename
            img_filename = f"{candidate_base}.png"
            counter = 1
            while img_filename in used_filenames:
                img_filename = f"{candidate_base}_{counter}.png"
                counter += 1
            
            # Add to registry
            used_filenames.add(img_filename)
            compiled_diagrams[normalized] = img_filename
            
            # Compile to PNG
            dest_png = os.path.join(IMAGES_DIR, img_filename)
            success = compile_mermaid(mermaid_code, dest_png)
            if not success:
                # Remove from registry if failed so we don't map it
                compiled_diagrams.pop(normalized, None)
                used_filenames.discard(img_filename)

    print("\n=== Phase 2: Updating Markdown Files with Image Links ===")
    # Step 2: Update all markdown files to reference the compiled diagrams
    for file_path in md_files:
        rel_path = os.path.relpath(file_path, WORKSPACE_DIR)
        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read()
            
        # We need to find all mermaid blocks again and replace them with the image + block
        def repl(match):
            full_match = match.group(0)
            mermaid_block = match.group(1)
            mermaid_code = match.group(2)
            
            normalized = normalize_content(mermaid_code)
            if normalized not in compiled_diagrams:
                # If it failed compilation, keep the raw block as-is
                return full_match
                
            img_filename = compiled_diagrams[normalized]
            
            # Compute relative path from file_path directory to IMAGES_DIR
            rel_dir = os.path.relpath(IMAGES_DIR, os.path.dirname(file_path))
            # Format using forward slashes for Markdown links
            img_rel_path = os.path.join(rel_dir, img_filename).replace("\\", "/")
            
            label = clean_label(img_filename)
            return f"![{label}]({img_rel_path})\n\n{mermaid_block}"
            
        new_content, count = MERMAID_PATTERN.subn(repl, content)
        if count > 0:
            with open(file_path, "w", encoding="utf-8") as f:
                f.write(new_content)
            print(f"Updated {rel_path} (added/updated {count} image link(s))")

    print("\n=== Execution Complete ===")

if __name__ == "__main__":
    main()
