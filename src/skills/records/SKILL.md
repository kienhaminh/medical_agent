---
name: records
description: "Quản lý hồ sơ y tế: xem, tìm kiếm, thêm hồ sơ."
when_to_use:
  - "Xem lịch sử khám bệnh"
  - "Tìm hồ sơ theo nội dung"
  - "Thêm hồ sơ mới"
  - "Xem kết quả xét nghiệm"
when_not_to_use:
  - "Xem ảnh chụp → dùng imaging skill"
  - "Tìm thông tin cơ bản bệnh nhân → dùng patient-management skill"
keywords:
  - hồ sơ y tế
  - medical record
  - lịch sử khám
  - medical history
  - kết quả xét nghiệm
  - lab results
  - chẩn đoán
  - diagnosis record
  - đơn thuốc
  - prescription
examples:
  - "Xem hồ sơ y tế của bệnh nhân 123"
  - "Tìm hồ sơ về tiểu đường"
  - "Thêm hồ sơ khám mới"
---

# Records Skill

## Overview

Skill này cung cấp quản lý hồ sơ y tế bao gồm lịch sử khám bệnh, kết quả xét nghiệm, chẩn đoán và đơn thuốc.

## Tools

- `query_patient_medical_records`: Truy vấn hồ sơ y tế của bệnh nhân
- `add_medical_record`: Thêm hồ sơ y tế mới
- `search_records_by_content`: Tìm kiếm hồ sơ theo nội dung

## Usage Guidelines

1. Cần có patient_id trước khi truy vấn hồ sơ
2. Hỗ trợ tìm kiếm ngữ nghĩa (semantic search) nếu có query
3. Có thể giới hạn số lượng kết quả trả về
