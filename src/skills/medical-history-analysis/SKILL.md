---
name: medical-history-analysis
description: "Phân tích toàn diện lịch sử bệnh án bệnh nhân theo tiêu chuẩn lâm sàng. Tổng hợp hồ sơ y tế, sinh hiệu, thuốc, dị ứng và chẩn đoán hình ảnh thành báo cáo lâm sàng có cấu trúc với dấu hiệu cảnh báo và khuyến nghị."
when_to_use:
  - "Phân tích lịch sử bệnh án bệnh nhân"
  - "Tổng hợp hồ sơ lâm sàng đầy đủ"
  - "Xem xét toàn bộ tiền sử y tế"
  - "Đánh giá nguy cơ và khuyến nghị lâm sàng"
  - "Tìm dấu hiệu cảnh báo trong hồ sơ bệnh nhân"
  - "Analyse patient medical history"
  - "Full clinical picture review"
  - "Medical history summary"
when_not_to_use:
  - "Chẩn đoán phân biệt dựa trên triệu chứng hiện tại → dùng generate_differential_diagnosis"
  - "Xem ảnh y tế → dùng imaging skill"
  - "Thông tin cơ bản bệnh nhân → dùng patient-management skill"
  - "Tóm tắt tổng quan (đã có sẵn) → đọc patient.health_summary"
keywords:
  - phân tích bệnh án
  - medical history
  - lịch sử bệnh
  - tiền sử y tế
  - tổng hợp hồ sơ
  - red flag
  - dấu hiệu cảnh báo
  - khuyến nghị lâm sàng
  - clinical review
  - history analysis
  - analyze history
examples:
  - "Phân tích lịch sử bệnh án bệnh nhân này"
  - "Tổng hợp toàn bộ hồ sơ lâm sàng"
  - "Xem xét tiền sử y tế và đưa ra khuyến nghị"
  - "Analyse this patient's medical history"
  - "Give me a full clinical review of the patient"
  - "Review the patient's history and flag any red flags"
---

# Medical History Analysis Skill

## Overview

Skill này thực hiện phân tích lâm sàng toàn diện về lịch sử y tế của bệnh nhân theo yêu cầu trong cuộc hội thoại. Khác với `health_summary` (bản tóm tắt được lưu trong DB), kết quả của skill này được tạo trực tiếp khi cần và trả về inline trong cuộc trò chuyện.

## Tool

- `analyze_medical_history(patient_id, focus_area=None)`: Phân tích toàn bộ lịch sử bệnh án

## Output Sections

1. **Chief Concerns** — Vấn đề tái diễn và vấn đề đang hoạt động
2. **Chronic Conditions** — Bệnh mãn tính với tiến triển
3. **Surgical & Procedure History** — Can thiệp lớn
4. **Medication Review** — Thuốc hiện tại và nguy cơ tương tác
5. **Allergy Profile** — Dị ứng đã biết
6. **Key Lab & Imaging Findings** — Kết quả quan trọng
7. **🔴 Red Flags** — Dấu hiệu cần chú ý ngay
8. **Clinical Recommendations** — Bước tiếp theo được đề xuất

## Usage Guidelines

1. Luôn gọi tool này thay vì tự tổng hợp từ các hồ sơ riêng lẻ
2. Cần `patient_id` từ context — nếu không có, hỏi người dùng
3. Dùng `focus_area` khi người dùng chỉ định lĩnh vực cụ thể
4. Trình bày kết quả đầy đủ — không rút gọn các phần
