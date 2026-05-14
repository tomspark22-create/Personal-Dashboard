import re

with open('/Users/tomspark/Desktop/Dashboard/dashboard.html', 'r') as f:
    content = f.read()

# Extract script blocks
scripts = re.findall(r'<script>(.*?)</script>', content, re.DOTALL)

for script in scripts:
    # Find functions
    functions = re.findall(r'function\s+(\w+)\s*\((.*?)\)\s*\{(.*?)\}', script, re.DOTALL)
    for name, params, body in functions:
        consts = re.findall(r'const\s+(\w+)\s*=', body)
        seen = set()
        for c in consts:
            if c in seen:
                print(f"Redeclaration of '{c}' in function '{name}'")
            seen.add(c)

    # Check top level
    top_level_consts = re.findall(r'^(const|let|var)\s+(\w+)\s*=', script, re.MULTILINE)
    seen_top = set()
    for type, name in top_level_consts:
        if name in seen_top:
            print(f"Redeclaration of '{name}' at top level")
        seen_top.add(name)
