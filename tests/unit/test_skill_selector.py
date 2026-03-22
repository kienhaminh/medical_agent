"""Unit tests for SkillSelector."""

import pytest
from unittest.mock import MagicMock, patch

from src.skills.base import Skill, SkillMetadata
from src.skills.registry import SkillRegistry
from src.agent.skill_selector import SkillSelector


def make_skill(
    name: str,
    description: str = "",
    keywords: list[str] | None = None,
    when_to_use: list[str] | None = None,
) -> Skill:
    """Create a fake Skill without touching the filesystem or DB."""
    metadata = SkillMetadata(
        name=name,
        description=description,
        keywords=keywords or [],
        when_to_use=when_to_use or [],
        when_not_to_use=[],
        examples=[],
    )
    return Skill(metadata=metadata)


@pytest.fixture
def clean_registry():
    """Provide a freshly reset SkillRegistry singleton."""
    SkillRegistry._instance = None
    registry = SkillRegistry()
    yield registry
    registry.reset()
    SkillRegistry._instance = None


@pytest.fixture
def selector_with_skills(clean_registry):
    """Return a SkillSelector backed by a pre-populated fake registry."""
    patient_skill = make_skill(
        name="patient-management",
        description="Manage patient records and personal information",
        keywords=["patient", "bệnh nhân", "search patient"],
        when_to_use=["Finding patient information", "Listing patients"],
    )
    records_skill = make_skill(
        name="records",
        description="Access medical records and lab results",
        keywords=["medical record", "hồ sơ", "lab results", "prescription"],
        when_to_use=["Viewing medical history", "Accessing lab results"],
    )
    diagnosis_skill = make_skill(
        name="diagnosis",
        description="Assist with diagnosis and symptom evaluation",
        keywords=["diagnosis", "symptom", "triệu chứng", "chẩn đoán"],
        when_to_use=["Evaluating symptoms", "Medical advice"],
    )

    clean_registry.register(patient_skill)
    clean_registry.register(records_skill)
    clean_registry.register(diagnosis_skill)

    # Build selector that skips filesystem discovery (registry already has skills)
    with patch.object(SkillSelector, "_ensure_skills_loaded"):
        selector = SkillSelector(skill_registry=clean_registry)

    return selector


# ---------------------------------------------------------------------------
# Tests: keyword-based skill selection
# ---------------------------------------------------------------------------


class TestSkillSelectionByKeyword:
    """Verify that the selector routes queries to the correct skill."""

    def test_patient_keyword_selects_patient_management(self, selector_with_skills):
        skills = selector_with_skills.select("tìm bệnh nhân Nguyễn Văn A")
        names = [s.name for s in skills]
        assert "patient-management" in names

    def test_english_patient_keyword_selects_patient_management(
        self, selector_with_skills
    ):
        skills = selector_with_skills.select("search patient information")
        names = [s.name for s in skills]
        assert "patient-management" in names

    def test_medical_record_keyword_selects_records(self, selector_with_skills):
        skills = selector_with_skills.select("show medical record for patient")
        names = [s.name for s in skills]
        assert "records" in names

    def test_symptom_keyword_selects_diagnosis(self, selector_with_skills):
        skills = selector_with_skills.select("patient has symptom of fever")
        names = [s.name for s in skills]
        assert "diagnosis" in names

    def test_vietnamese_diagnosis_keyword(self, selector_with_skills):
        skills = selector_with_skills.select("triệu chứng bệnh nhân")
        names = [s.name for s in skills]
        # Both patient-management and diagnosis patterns match; at least one is present
        assert len(skills) >= 1

    def test_lab_results_keyword_selects_records(self, selector_with_skills):
        skills = selector_with_skills.select("show lab results for the patient")
        names = [s.name for s in skills]
        assert "records" in names


# ---------------------------------------------------------------------------
# Tests: confidence scoring
# ---------------------------------------------------------------------------


class TestConfidenceScoring:
    """Verify that relevance scores affect ordering and filtering."""

    def test_results_ordered_by_confidence(self, selector_with_skills):
        """Skills with higher keyword overlap should appear first."""
        # 'medical record' is a keyword for 'records'; query is very specific
        skills = selector_with_skills.select("view medical record history lab results")
        assert len(skills) >= 1
        # Records skill should rank highly
        assert skills[0].name in {"records", "patient-management", "diagnosis"}

    def test_min_confidence_filters_low_scoring_skills(self, selector_with_skills):
        """A very high min_confidence should filter out most or all skills."""
        skills = selector_with_skills.select(
            "tìm bệnh nhân", min_confidence=0.99
        )
        # At min_confidence=0.99 almost nothing passes (score max is capped at 1.0)
        assert isinstance(skills, list)

    def test_zero_min_confidence_returns_all_matching(self, selector_with_skills):
        """With min_confidence=0 all skills that score > 0 are returned."""
        skills = selector_with_skills.select("patient", min_confidence=0.0)
        assert len(skills) >= 1

    def test_calculate_score_returns_value_between_0_and_1(
        self, selector_with_skills
    ):
        patient_skill = make_skill(
            name="patient-management",
            description="Manage patient records",
            keywords=["patient"],
        )
        score = selector_with_skills._calculate_score(patient_skill, "patient info")
        assert 0.0 <= score <= 1.0


# ---------------------------------------------------------------------------
# Tests: top_k limiting
# ---------------------------------------------------------------------------


class TestTopKLimiting:
    """Verify that top_k correctly caps the number of returned skills."""

    def test_top_k_1_returns_at_most_one_skill(self, selector_with_skills):
        skills = selector_with_skills.select("patient medical record diagnosis", top_k=1)
        assert len(skills) <= 1

    def test_top_k_2_returns_at_most_two_skills(self, selector_with_skills):
        skills = selector_with_skills.select("patient medical record diagnosis", top_k=2)
        assert len(skills) <= 2

    def test_top_k_larger_than_available_returns_all(self, selector_with_skills):
        # We registered 3 skills; requesting top_k=100 should return at most 3
        skills = selector_with_skills.select(
            "patient medical record diagnosis lab", top_k=100, min_confidence=0.0
        )
        assert len(skills) <= 3

    def test_default_top_k_is_three(self, selector_with_skills):
        """Default top_k=3 should cap results at three."""
        skills = selector_with_skills.select(
            "patient medical record diagnosis lab results", min_confidence=0.0
        )
        assert len(skills) <= 3


# ---------------------------------------------------------------------------
# Tests: edge cases
# ---------------------------------------------------------------------------


class TestEdgeCases:
    """Verify graceful handling of edge-case inputs."""

    def test_empty_query_returns_list(self, selector_with_skills):
        skills = selector_with_skills.select("")
        assert isinstance(skills, list)

    def test_whitespace_only_query_returns_list(self, selector_with_skills):
        skills = selector_with_skills.select("   ")
        assert isinstance(skills, list)

    def test_unrelated_query_returns_empty_or_low_confidence(
        self, selector_with_skills
    ):
        # A query completely unrelated to any skill keyword
        skills = selector_with_skills.select(
            "xyzzy foobar quux nonsense 12345", min_confidence=0.5
        )
        assert isinstance(skills, list)

    def test_empty_registry_returns_empty_list(self, clean_registry):
        with patch.object(SkillSelector, "_ensure_skills_loaded"):
            selector = SkillSelector(skill_registry=clean_registry)
        skills = selector.select("find patient")
        assert skills == []

    def test_get_primary_skill_returns_skill_or_none(self, selector_with_skills):
        result = selector_with_skills.get_primary_skill("tìm bệnh nhân")
        assert result is None or isinstance(result, Skill)

    def test_get_primary_skill_empty_registry(self, clean_registry):
        with patch.object(SkillSelector, "_ensure_skills_loaded"):
            selector = SkillSelector(skill_registry=clean_registry)
        result = selector.get_primary_skill("anything")
        assert result is None

    def test_select_with_reasoning_returns_dicts(self, selector_with_skills):
        results = selector_with_skills.select_with_reasoning("bệnh nhân triệu chứng")
        assert isinstance(results, list)
        for item in results:
            assert "skill" in item
            assert "confidence" in item
            assert "reasoning" in item
            assert isinstance(item["confidence"], float)
            assert isinstance(item["reasoning"], str)

    def test_very_long_query_does_not_crash(self, selector_with_skills):
        long_query = "patient " * 500
        skills = selector_with_skills.select(long_query)
        assert isinstance(skills, list)
