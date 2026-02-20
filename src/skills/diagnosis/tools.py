"""Tools for diagnosis skill."""

import logging
from typing import Optional, List

logger = logging.getLogger(__name__)


# Common symptoms to specialty mapping
SYMPTOM_SPECIALTY_MAP = {
    "tim": "Tim mạch (Cardiology)",
    "cardiac": "Tim mạch (Cardiology)",
    "heart": "Tim mạch (Cardiology)",
    "đau ngực": "Tim mạch (Cardiology)",
    "khó thở": "Tim mạch/Hô hấp",
    "shortness of breath": "Cardiology/Pulmonology",
    "đầu": "Thần kinh (Neurology)",
    "head": "Neurology",
    "migraine": "Neurology",
    "đau đầu": "Thần kinh (Neurology)",
    "chóng mặt": "Thần kinh/Tai mũi họng",
    "dizziness": "Neurology/ENT",
    "bụng": "Tiêu hóa (Gastroenterology)",
    "stomach": "Gastroenterology",
    "đau bụng": "Tiêu hóa (Gastroenterology)",
    "tiêu chảy": "Tiêu hóa (Gastroenterology)",
    "diarrhea": "Gastroenterology",
    "da": "Da liễu (Dermatology)",
    "skin": "Dermatology",
    "phát ban": "Da liễu (Dermatology)",
    "rash": "Dermatology",
    "xương": "Chấn thương chỉnh hình (Orthopedics)",
    "bone": "Orthopedics",
    "khớp": "Chấn thương chỉnh hình (Orthopedics)",
    "joint": "Orthopedics",
    "mắt": "Mắt (Ophthalmology)",
    "eye": "Ophthalmology",
    "tai": "Tai mũi họng (ENT)",
    "ear": "ENT",
    "mũi": "Tai mũi họng (ENT)",
    "nose": "ENT",
    "họng": "Tai mũi họng (ENT)",
    "throat": "ENT",
    "răng": "Răng hàm mặt (Dentistry)",
    "tooth": "Dentistry",
    "nhiễm trùng": "Nhiễm trùng (Infectious Disease)",
    "sốt": "Nhiễm trùng/Nội tổng quát",
    "fever": "Infectious Disease/General Medicine",
    "tiểu đường": "Nội tiết (Endocrinology)",
    "diabetes": "Endocrinology",
    "tuyến giáp": "Nội tiết (Endocrinology)",
    "thyroid": "Endocrinology",
    "thận": "Thận (Nephrology)",
    "kidney": "Nephrology",
}


def analyze_symptoms(
    symptoms: str,
    patient_id: Optional[int] = None,
    duration: Optional[str] = None,
) -> str:
    """Analyze symptoms and suggest appropriate specialty.

    Use this tool when you need to analyze patient symptoms and suggest
    which medical specialty they should consult. This provides guidance
    only - not a definitive diagnosis.

    Args:
        symptoms: Description of symptoms (e.g., "đau đầu, sốt, mệt mỏi").
        patient_id: Optional patient ID for context.
        duration: How long symptoms have been present (e.g., "3 days", "1 week").

    Returns:
        Analysis of symptoms and recommended specialty.
    """
    logger.info("Analyzing symptoms: '%s' for patient_id=%s", symptoms, patient_id)
    
    symptoms_lower = symptoms.lower()
    matched_specialties = []
    
    # Match symptoms to specialties
    for keyword, specialty in SYMPTOM_SPECIALTY_MAP.items():
        if keyword in symptoms_lower:
            if specialty not in matched_specialties:
                matched_specialties.append(specialty)
    
    # Build response
    response = ["Phân tích triệu chứng:"]
    response.append(f"- Triệu chứng: {symptoms}")
    if duration:
        response.append(f"- Thời gian: {duration}")
    response.append("")
    
    if matched_specialties:
        response.append("Chuyên khoa đề xuất:")
        for i, specialty in enumerate(matched_specialties[:3], 1):
            response.append(f"  {i}. {specialty}")
    else:
        response.append("Không thể xác định chuyên khoa cụ thể từ triệu chứng.")
        response.append("Đề xuất: Khám Nội tổng quát (General Internal Medicine)")
    
    response.append("")
    response.append("Lưu ý: Đây chỉ là gợi ý ban đầu. Vui lòng đến gặp bác sĩ để được chẩn đoán chính xác.")
    
    return "\n".join(response)


def get_specialty_info(specialty_name: Optional[str] = None) -> str:
    """Get information about medical specialties.

    Use this tool when you need information about specific medical specialties
    or want to list all available specialties.

    Args:
        specialty_name: Name of specialty to lookup (optional, returns all if not provided).

    Returns:
        Information about the specialty or list of specialties.
    """
    specialties = {
        "tim mạch": {
            "name": "Tim mạch (Cardiology)",
            "description": "Chuyên khoa về bệnh tim mạch và tuần hoàn",
            "common_conditions": ["Tăng huyết áp", "Bệnh mạch vành", "Suy tim", "Rối loạn nhịp tim"]
        },
        "thần kinh": {
            "name": "Thần kinh (Neurology)",
            "description": "Chuyên khoa về bệnh hệ thần kinh",
            "common_conditions": ["Đau đầu/migraine", "Động kinh", "Tai biến mạch máu não", "Parkinson"]
        },
        "tiêu hóa": {
            "name": "Tiêu hóa (Gastroenterology)",
            "description": "Chuyên khoa về bệnh đường tiêu hóa",
            "common_conditions": ["Loét dạ dày", "Viêm gan", "Hội chứng ruột kích thích", "Trào ngược dạ dày"]
        },
        "da liễu": {
            "name": "Da liễu (Dermatology)",
            "description": "Chuyên khoa về bệnh da",
            "common_conditions": ["Viêm da", "Mụn trứng cá", "Vảy nến", "Nấm da"]
        },
        "tai mũi họng": {
            "name": "Tai mũi họng (ENT)",
            "description": "Chuyên khoa về tai, mũi, họng",
            "common_conditions": ["Viêm xoang", "Viêm họng", "Viêm tai giữa", "Dị ứng"]
        },
        "mắt": {
            "name": "Mắt (Ophthalmology)",
            "description": "Chuyên khoa về bệnh mắt",
            "common_conditions": ["Cận thị", "Đục thủy tinh thể", "Tăng nhãn áp", "Khô mắt"]
        },
        "cơ xương khớp": {
            "name": "Chấn thương chỉnh hình (Orthopedics)",
            "description": "Chuyên khoa về xương, khớp, cơ",
            "common_conditions": ["Thoái hóa khớp", "Gãy xương", "Thoát vị đĩa đệm", "Viêm khớp"]
        },
        "nội tiết": {
            "name": "Nội tiết (Endocrinology)",
            "description": "Chuyên khoa về hormone và chuyển hóa",
            "common_conditions": ["Tiểu đường", "Bệnh tuyến giáp", "Rối loạn nội tiết", "Loãng xương"]
        },
    }
    
    if specialty_name:
        key = specialty_name.lower()
        if key in specialties:
            s = specialties[key]
            return f"""{s['name']}
Mô tả: {s['description']}

Các bệnh thường gặp:
- {"\n- ".join(s['common_conditions'])}"""
        else:
            return f"Không tìm thấy thông tin về chuyên khoa '{specialty_name}'"
    
    # Return list of all specialties
    response = ["Danh sách chuyên khoa:"]
    for key, info in specialties.items():
        response.append(f"- {info['name']}")
    return "\n".join(response)
