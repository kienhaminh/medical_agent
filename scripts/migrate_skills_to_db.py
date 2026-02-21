"""Migrate filesystem skills to database.

Usage:
    python -m scripts.migrate_skills_to_db [--dry-run]

This script:
1. Discovers all skills from filesystem (core/custom/external)
2. Saves them to database with source_type='database'
3. Optionally disables filesystem discovery after migration
"""

import asyncio
import argparse
import os
import sys
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from src.config.database import init_db, AsyncSessionLocal
from src.models.skill import Skill as SkillModel, SkillTool as SkillToolModel
from src.skills.registry import SkillRegistry
from src.skills.base import Skill
from sqlalchemy import select


async def migrate_skills(dry_run: bool = False):
    """Migrate all filesystem skills to database.
    
    Args:
        dry_run: If True, only show what would be migrated without saving
    """
    print("="*70)
    print("SKILL MIGRATION TOOL")
    print("="*70)
    
    # Initialize database
    await init_db()
    print("✓ Database initialized")
    
    # Discover skills from filesystem
    registry = SkillRegistry()
    
    skill_dirs = {
        "core": os.path.join(project_root, "src", "skills"),
        "custom": os.environ.get("CUSTOM_SKILLS_DIR", "./custom_skills"),
        "external": os.environ.get("EXTERNAL_SKILLS_DIR", "./external_skills"),
    }
    
    discovered_skills = []
    
    for source_type, skills_dir in skill_dirs.items():
        if os.path.exists(skills_dir):
            count = registry.discover_skills([skills_dir])
            print(f"✓ Discovered {count} {source_type} skills from {skills_dir}")
            discovered_skills.extend(registry.get_all_skills())
    
    if not discovered_skills:
        print("\n⚠ No skills found in filesystem!")
        return
    
    print(f"\n{'='*70}")
    print(f"MIGRATION SUMMARY")
    print(f"{'='*70}")
    print(f"Total skills to migrate: {len(discovered_skills)}")
    
    if dry_run:
        print("\n⚡ DRY RUN MODE - No changes will be saved")
        for skill in discovered_skills:
            print(f"  - {skill.name}: {skill.description[:50]}...")
            print(f"    Tools: {len(skill.tools)}")
        return
    
    # Migrate to database
    async with AsyncSessionLocal() as db:
        migrated = 0
        updated = 0
        
        for skill in discovered_skills:
            # Check if skill already exists
            result = await db.execute(
                select(SkillModel).where(SkillModel.name == skill.name)
            )
            existing = result.scalar_one_or_none()
            
            if existing:
                # Update existing skill
                existing.description = skill.description
                existing.when_to_use = skill.metadata.when_to_use
                existing.when_not_to_use = skill.metadata.when_not_to_use
                existing.keywords = skill.metadata.keywords
                existing.examples = skill.metadata.examples
                existing.source_type = "database"  # Mark as DB-managed
                existing.enabled = True
                
                # Clear existing tools and recreate
                for tool in existing.tools:
                    await db.delete(tool)
                
                # Add tools
                for tool_name, tool_func in skill.tools.items():
                    db_tool = SkillToolModel(
                        skill_id=existing.id,
                        name=tool_name,
                        description=tool_func.__doc__ or f"Tool {tool_name}",
                        implementation_type="code",
                        code=None,  # Can't extract source easily
                        enabled=True
                    )
                    db.add(db_tool)
                
                updated += 1
                print(f"  ✓ Updated: {skill.name}")
            else:
                # Create new skill
                db_skill = SkillModel(
                    name=skill.name,
                    description=skill.description,
                    when_to_use=skill.metadata.when_to_use,
                    when_not_to_use=skill.metadata.when_not_to_use,
                    keywords=skill.metadata.keywords,
                    examples=skill.metadata.examples,
                    source_type="database",  # Mark as DB-managed
                    enabled=True,
                    version="1.0.0",
                    is_system=False
                )
                db.add(db_skill)
                await db.flush()  # Get the ID
                
                # Add tools
                for tool_name, tool_func in skill.tools.items():
                    db_tool = SkillToolModel(
                        skill_id=db_skill.id,
                        name=tool_name,
                        description=tool_func.__doc__ or f"Tool {tool_name}",
                        implementation_type="code",
                        code=None,
                        enabled=True
                    )
                    db.add(db_tool)
                
                migrated += 1
                print(f"  ✓ Migrated: {skill.name}")
        
        await db.commit()
        
        print(f"\n{'='*70}")
        print("MIGRATION COMPLETE")
        print(f"{'='*70}")
        print(f"New skills migrated: {migrated}")
        print(f"Existing skills updated: {updated}")
        print(f"Total: {migrated + updated}")
        
        # Show next steps
        print(f"\n{'='*70}")
        print("NEXT STEPS")
        print(f"{'='*70}")
        print("1. Set environment variable to disable filesystem discovery:")
        print("   export SKILLS_DB_ONLY=true")
        print("")
        print("2. Or update config/default.yaml:")
        print("   skills:")
        print("     db_only: true")
        print("")
        print("3. Restart the server")
        print("")
        print("4. Manage skills via UI at: http://localhost:3000/skills")


def main():
    parser = argparse.ArgumentParser(
        description="Migrate filesystem skills to database"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be migrated without making changes"
    )
    
    args = parser.parse_args()
    
    asyncio.run(migrate_skills(dry_run=args.dry_run))


if __name__ == "__main__":
    main()
