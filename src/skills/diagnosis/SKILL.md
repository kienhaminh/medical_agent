---
name: diagnosis
description: "Hỗ trợ chẩn đoán, phân tích triệu chứng, đề xuất chuyên khoa."
when_to_use:
  - "Phân tích triệu chứng bệnh"
  - "Đề xuất chuyên khoa phù hợp"
  - "Tư vấn y tế cơ bản"
  - "Phân tích dấu hiệu lâm sàng"
when_not_to_use:
  - "Tra cứu thông tin bệnh nhân → dùng patient-management skill"
  - "Xem kết quả xét nghiệm → dùng records skill"
keywords:
  - chẩn đoán
  - diagnosis
  - triệu chứng
  - symptom
  - chuyên khoa
  - specialty
  - tư vấn y tế
  - medical advice
  - dấu hiệu
  - đau
  - sốt
  - khó thở
examples:
  - "Tôi bị đau đầu và sốt"
  - "Nên khám chuyên khoa nào cho bệnh tim?"
  - "Phân tích triệu chứng đau bụng dưới"
---

# Diagnosis Skill

## Overview

Skill này cung cấp hỗ trợ chẩn đoán ban đầu và phân tích triệu chứng, giúp đề xuất chuyên khoa phù hợp cho bệnh nhân.

## Tools

- `analyze_symptoms`: Phân tích triệu chứng và đề xuất chuyên khoa
- `get_specialty_info`: Lấy thông tin về các chuyên khoa

## Usage Guidelines

1. Không chẩn đoán chính xác bệnh, chỉ đưa ra gợi ý ban đầu
2. Luôn khuyến nghị bệnh nhân đến gặp bác sĩ để được chẩn đoán chính xác
3. Sử dụng thông tin bệnh nhân (nếu có) để phân tích tốt hơn
