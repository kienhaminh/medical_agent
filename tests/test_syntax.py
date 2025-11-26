import os
import ast
import pytest

def get_python_files(start_dir):
    python_files = []
    for root, _, files in os.walk(start_dir):
        for file in files:
            if file.endswith(".py"):
                python_files.append(os.path.join(root, file))
    return python_files

def test_syntax_validity():
    """
    Test that all Python files in the src directory have valid syntax.
    This catches IndentationError, SyntaxError, etc.
    """
    project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    src_dir = os.path.join(project_root, "src")
    
    python_files = get_python_files(src_dir)
    
    errors = []
    for file_path in python_files:
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                source = f.read()
            ast.parse(source, filename=file_path)
        except SyntaxError as e:
            errors.append(f"Syntax error in {file_path}: {e}")
        except Exception as e:
            errors.append(f"Error reading/parsing {file_path}: {e}")
            
    if errors:
        pytest.fail("\n".join(errors))

if __name__ == "__main__":
    # Allow running this script directly
    try:
        test_syntax_validity()
        print("All files have valid syntax.")
    except Exception as e:
        print(e)
        exit(1)
