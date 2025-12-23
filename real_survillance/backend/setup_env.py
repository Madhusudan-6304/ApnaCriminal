#!/usr/bin/env python3
"""
Quick setup script to create .env file from .env.example
"""
import os
import shutil
from pathlib import Path

def setup_env():
    """Create .env file from .env.example if it doesn't exist"""
    backend_dir = Path(__file__).parent
    env_file = backend_dir / ".env"
    env_example = backend_dir / ".env.example"
    
    if env_file.exists():
        print("✓ .env file already exists")
        response = input("Do you want to overwrite it? (y/N): ")
        if response.lower() != 'y':
            print("Keeping existing .env file")
            return
    
    if not env_example.exists():
        print("✗ .env.example file not found!")
        print("Please create it manually or check the repository.")
        return
    
    # Copy .env.example to .env
    shutil.copy(env_example, env_file)
    print("✓ Created .env file from .env.example")
    print("\n⚠️  IMPORTANT: Edit backend/.env and fill in your actual credentials!")
    print("   See backend/ENV_SETUP.md for detailed instructions.\n")

if __name__ == "__main__":
    setup_env()

