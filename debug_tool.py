import os
from dotenv import load_dotenv
from src.tools.builtin.meta_tool import create_new_tool
from src.config.database import init_db, engine

# Load env
load_dotenv()

# Ensure DB is ready (though we are running locally so it should be)
# We might need to run init_db if tables are missing, but they should be there.

print("Testing create_new_tool...")
result = create_new_tool(
    name="calculate_factorial_debug",
    description="Calculates factorial of a number.",
    instructions="Take an integer n and return its factorial."
)
print(f"Result: {result}")
