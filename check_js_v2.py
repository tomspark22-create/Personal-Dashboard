import re

def check_script(script_text):
    # Find all function definitions (simplified)
    # This regex matches function name() { ... } and const name = () => { ... }
    functions = re.findall(r'(?:function\s+(\w+)|(?:const|let)\s+(\w+)\s*=\s*(?:\([^)]*\)|[\w]+)\s*=>)\s*\{', script_text)
    
    # We need to find the blocks for these functions. This is hard with regex.
    # Let's use a simpler approach: find all { } pairs and check variables inside.
    
    # Actually, let's just find all occurrences of "const x =" and check if the same x is used twice in the same block.
    # A block starts with { and ends with }.
    
    stack = []
    current_block_vars = set()
    errors = []
    
    # Tokenize by looking for {, }, and const \w+ =
    tokens = re.finditer(r'\{|\}|const\s+(\w+)\s*=|let\s+(\w+)\s*=|var\s+(\w+)\s*=', script_text)
    
    for match in tokens:
        token = match.group(0)
        if token == '{':
            stack.append(current_block_vars)
            current_block_vars = set()
        elif token == '}':
            if stack:
                current_block_vars = stack.pop()
        else:
            # It's a declaration
            var_name = match.group(1) or match.group(2) or match.group(3)
            if var_name in current_block_vars:
                # Check if it's a redeclaration in the same scope
                # Note: var allows redeclaration, but let/const don't.
                if token.startswith('const') or token.startswith('let'):
                    errors.append(f"Redeclaration of '{var_name}' at position {match.start()}")
            current_block_vars.add(var_name)
            
    return errors

with open('/Users/tomspark/Desktop/Dashboard/dashboard.html', 'r') as f:
    content = f.read()

scripts = re.findall(r'<script>(.*?)</script>', content, re.DOTALL)
for i, script in enumerate(scripts):
    errs = check_script(script)
    for e in errs:
        print(f"Script {i}: {e}")
