#!/usr/bin/env python3
"""
Script to update color naming conventions in HTML screen files.
Replaces gray- with neutral-, indigo- and aegis- with primary-.
Also updates Tailwind config sections to use standardized color palettes.
"""

import os
import re
from pathlib import Path

# Standard color configurations
PRIMARY_COLORS = """primary: {
              50: '#eef2ff',
              100: '#e0e7ff',
              200: '#c7d2fe',
              300: '#a5b4fc',
              400: '#818cf8',
              500: '#6366f1',
              600: '#4f46e5',
              700: '#4338ca',
              800: '#3730a3',
              900: '#312e81',
              950: '#1e1b4b',
            }"""

NEUTRAL_COLORS = """neutral: {
              50: '#f8fafc',
              100: '#f1f5f9',
              200: '#e2e8f0',
              300: '#cbd5e1',
              400: '#94a3b8',
              500: '#64748b',
              600: '#475569',
              700: '#334155',
              800: '#1e293b',
              900: '#0f172a',
            }"""

def process_file(file_path):
    """Process a single HTML file for color updates."""
    print(f"Processing: {file_path.name}")

    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    original_content = content
    replacements = 0

    # Step 1: Update Tailwind config color definitions
    # Replace aegis: { ... } with primary: { ... } and add neutral
    config_patterns = [
        # Pattern for aegis color config
        (r'colors:\s*\{\s*aegis:\s*\{[^}]+\}[^}]*\}',
         f'colors: {{\n            {PRIMARY_COLORS},\n            {NEUTRAL_COLORS}\n          }}'),
        # Pattern for indigo-only config
        (r'colors:\s*\{\s*indigo:\s*\{[^}]+\}[^}]*\}',
         f'colors: {{\n            {PRIMARY_COLORS},\n            {NEUTRAL_COLORS}\n          }}'),
        # Pattern for surface color config (convert to neutral)
        (r'surface:\s*\{[^}]+\}', NEUTRAL_COLORS),
    ]

    for pattern, replacement in config_patterns:
        if re.search(pattern, content):
            content = re.sub(pattern, replacement, content)
            replacements += 1

    # Step 2: Replace color class names in HTML
    # gray- → neutral-
    gray_count = len(re.findall(r'\bgray-(\d+)', content))
    content = re.sub(r'\bgray-', 'neutral-', content)
    replacements += gray_count

    # indigo- → primary-
    indigo_count = len(re.findall(r'\bindigo-(\d+)', content))
    content = re.sub(r'\bindigo-', 'primary-', content)
    replacements += indigo_count

    # aegis- → primary-
    aegis_count = len(re.findall(r'\baegis-(\d+)', content))
    content = re.sub(r'\baegis-', 'primary-', content)
    replacements += aegis_count

    # Only write if changes were made
    if content != original_content:
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"  ✓ Updated with {replacements} changes (gray:{gray_count}, indigo:{indigo_count}, aegis:{aegis_count})")
        return True, replacements
    else:
        print(f"  - No changes needed")
        return False, 0

def main():
    screens_dir = Path(__file__).parent.parent / 'design-artifacts' / 'screens'

    if not screens_dir.exists():
        print(f"Error: Directory not found: {screens_dir}")
        return

    html_files = sorted(screens_dir.glob('*.html'))

    # Skip already processed files
    skip_files = {'admin-dashboard.html', 'admin-login.html', 'agent-detail.html', 'agent-list.html'}
    files_to_process = [f for f in html_files if f.name not in skip_files]

    print(f"Found {len(files_to_process)} files to process\n")

    total_updated = 0
    total_replacements = 0

    for file_path in files_to_process:
        updated, count = process_file(file_path)
        if updated:
            total_updated += 1
            total_replacements += count
        print()

    print("=" * 60)
    print(f"Summary:")
    print(f"  Files processed: {len(files_to_process)}")
    print(f"  Files updated: {total_updated}")
    print(f"  Total replacements: {total_replacements}")
    print("=" * 60)

if __name__ == '__main__':
    main()
