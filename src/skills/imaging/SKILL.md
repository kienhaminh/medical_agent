---
name: imaging
description: "Xử lý và phân tích hình ảnh y tế: X-ray, MRI, CT scan."
when_to_use:
  - "Xem ảnh chụp của bệnh nhân"
  - "Upload ảnh y tế mới"
  - "Phân tích hình ảnh"
  - "Tìm ảnh X-ray, MRI, CT scan"
when_not_to_use:
  - "Xem thông tin cơ bản bệnh nhân → dùng patient-management skill"
  - "Xem hồ sơ văn bản → dùng records skill"
keywords:
  - ảnh chụp
  - imaging
  - x-ray
  - mri
  - ct scan
  - siêu âm
  - ultrasound
  - hình ảnh y tế
  - medical image
  - preview
  - ảnh nhóm
examples:
  - "Xem ảnh X-ray của bệnh nhân 123"
  - "Hiển thị MRI gần nhất"
  - "Tìm ảnh CT scan"
---

# Imaging Skill

## Overview

Skill này cung cấp quản lý và truy xuất hình ảnh y tế (X-ray, MRI, CT scan, siêu âm) cho bệnh nhân.

## Tools

- `query_patient_imaging`: Truy vấn ảnh y tế của bệnh nhân
- `get_imaging_by_group`: Lấy ảnh theo nhóm/lần khám

## Usage Guidelines

1. Cần có patient_id trước khi truy vấn ảnh
2. Có thể lọc theo loại ảnh (x-ray, mri, ct, ultrasound)
3. Có thể lọc theo group_id để xem ảnh cùng một lần khám
