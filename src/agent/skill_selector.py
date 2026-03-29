"""Skill selector for routing queries to appropriate skills.

The SkillSelector analyzes user queries and determines which skills
are most relevant for handling the request.
"""

import logging
from typing import List, Optional, Dict, Any
import re

from ..skills.registry import SkillRegistry
from ..skills.base import Skill

logger = logging.getLogger(__name__)


class SkillSelector:
    """Selects appropriate skills based on user queries.
    
    Uses a combination of:
    - Keyword matching against skill metadata
    - Pattern matching for common query types
    - Relevance scoring
    
    Usage:
        >>> selector = SkillSelector()
        >>> skills = selector.select("tìm bệnh nhân Nguyễn Văn A")
        >>> print([s.name for s in skills])
        ['patient-management']
    """
    
    # Vietnamese-English keyword mappings for better matching
    KEYWORD_PATTERNS = {
        "patient-management": [
            r"bệnh nhân", r"patient", r"tìm.*bệnh", r"thông tin.*bệnh",
            r"danh sách.*bệnh", r"ngày sinh", r"giới tính", r"địa chỉ",
            r"tên.*bệnh nhân", r"bệnh nhân.*id"
        ],
        "records": [
            r"hồ sơ", r"medical record", r"lịch sử khám", r"medical history",
            r"kết quả xét nghiệm", r"lab results", r"đơn thuốc", r"prescription",
            r"chẩn đoán", r"diagnosis record", r"bệnh án"
        ],
        "imaging": [
            r"ảnh chụp", r"imaging", r"x-ray", r"mri", r"ct scan",
            r"siêu âm", r"ultrasound", r"hình ảnh", r"ảnh.*y tế",
            r"phim.*chụp", r"xquang", r"cộng hưởng", r"chụp cắt lớp"
        ],
        "diagnosis": [
            r"chẩn đoán", r"diagnosis", r"triệu chứng", r"symptom",
            r"chuyên khoa", r"specialty", r"tư vấn y tế", r"medical advice",
            r"dấu hiệu", r"đau", r"sốt", r"khó thở", r"bệnh gì"
        ]
    }
    
    def __init__(self, skill_registry: Optional[SkillRegistry] = None):
        """Initialize skill selector.
        
        Args:
            skill_registry: Optional SkillRegistry instance. Creates new one if not provided.
        """
        self.registry = skill_registry or SkillRegistry()
        self._ensure_skills_loaded()
    
    def _ensure_skills_loaded(self) -> None:
        """Ensure skills are loaded into registry."""
        import os
        
        # Get the skills directory
        current_dir = os.path.dirname(os.path.abspath(__file__))
        skills_dir = os.path.join(os.path.dirname(current_dir), "skills")
        
        # Discover skills if not already loaded
        if not self.registry.get_all_skills():
            count = self.registry.discover_skills([skills_dir])
            logger.info(f"SkillSelector discovered {count} skills from {skills_dir}")
    
    def select(self, query: str, top_k: int = 3, min_confidence: float = 0.3) -> List[Skill]:
        """Select skills for a query.
        
        Args:
            query: User query string
            top_k: Maximum number of skills to return
            min_confidence: Minimum confidence score (0-1) to include a skill
            
        Returns:
            List of relevant skills sorted by confidence
        """
        query_lower = query.lower()
        scores: Dict[str, float] = {}
        
        # Get all skills from registry
        all_skills = {s.name: s for s in self.registry.get_all_skills()}
        
        for skill_name, skill in all_skills.items():
            score = self._calculate_score(skill, query_lower)
            if score >= min_confidence:
                scores[skill_name] = score
        
        # Sort by score descending
        sorted_skills = sorted(scores.items(), key=lambda x: x[1], reverse=True)
        
        # Return top_k skills
        result = [all_skills[name] for name, _ in sorted_skills[:top_k]]
        
        logger.debug(f"SkillSelector for query '{query[:50]}...': {[s.name for s in result]}")
        return result
    
    def _calculate_score(self, skill: Skill, query_lower: str) -> float:
        """Calculate relevance score for a skill against a query.
        
        Args:
            skill: Skill to evaluate
            query_lower: Lowercase query string
            
        Returns:
            Relevance score between 0 and 1
        """
        score = 0.0
        max_possible = 10.0  # Normalization factor
        
        # 1. Check keyword patterns (highest weight)
        patterns = self.KEYWORD_PATTERNS.get(skill.name, [])
        for pattern in patterns:
            if re.search(pattern, query_lower):
                score += 3.0
        
        # 2. Check skill metadata keywords
        for keyword in skill.metadata.keywords:
            keyword_lower = keyword.lower()
            if keyword_lower in query_lower:
                score += 2.0
            # Check for partial matches
            elif len(keyword_lower) > 4:
                words = query_lower.split()
                for word in words:
                    if keyword_lower in word or word in keyword_lower:
                        score += 1.0
                        break
        
        # 3. Check when_to_use patterns
        for pattern in skill.metadata.when_to_use:
            pattern_lower = pattern.lower()
            # Direct match
            if pattern_lower in query_lower:
                score += 2.5
            # Word overlap
            pattern_words = set(pattern_lower.split())
            query_words = set(query_lower.split())
            overlap = pattern_words & query_words
            if len(overlap) >= 2:
                score += 1.5
        
        # 4. Check skill name in query
        name_normalized = skill.name.replace("-", " ").lower()
        if name_normalized in query_lower:
            score += 2.0
        
        # 5. Check description relevance
        desc_words = set(skill.description.lower().split())
        query_words = set(query_lower.split())
        overlap = desc_words & query_words
        score += len(overlap) * 0.3
        
        # Normalize to 0-1 range
        normalized_score = min(score / max_possible, 1.0)
        return normalized_score
    
    def select_with_reasoning(self, query: str, top_k: int = 3) -> List[Dict[str, Any]]:
        """Select skills with reasoning for each selection.
        
        Args:
            query: User query string
            top_k: Maximum number of skills to return
            
        Returns:
            List of dicts with 'skill', 'confidence', and 'reasoning'
        """
        skills = self.select(query, top_k=top_k)
        
        results = []
        for skill in skills:
            score = self._calculate_score(skill, query.lower())
            reasoning = self._generate_reasoning(skill, query)
            
            results.append({
                "skill": skill,
                "confidence": score,
                "reasoning": reasoning
            })
        
        return results
    
    def _generate_reasoning(self, skill: Skill, query: str) -> str:
        """Generate human-readable reasoning for skill selection.
        
        Args:
            skill: Selected skill
            query: User query
            
        Returns:
            Reasoning string
        """
        query_lower = query.lower()
        reasons = []
        
        # Check what matched
        for keyword in skill.metadata.keywords:
            if keyword.lower() in query_lower:
                reasons.append(f"matched keyword '{keyword}'")
        
        for pattern in skill.metadata.when_to_use:
            if any(word in query_lower for word in pattern.lower().split() if len(word) > 3):
                reasons.append(f"relevant to '{pattern}'")
        
        if skill.name.replace("-", " ").lower() in query_lower:
            reasons.append(f"skill name mentioned")
        
        if reasons:
            return f"Selected '{skill.name}' because: {', '.join(reasons[:2])}"
        return f"Selected '{skill.name}' as potentially relevant"
    
    def get_primary_skill(self, query: str) -> Optional[Skill]:
        """Get the single most relevant skill for a query.
        
        Args:
            query: User query string
            
        Returns:
            Most relevant skill or None
        """
        skills = self.select(query, top_k=1)
        return skills[0] if skills else None
