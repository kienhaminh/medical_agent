---
name: patient-management
description: "Quản lý thông tin bệnh nhân: tìm kiếm, xem thông tin cơ bản, liệt kê bệnh nhân."
when_to_use:
  - "Tìm bệnh nhân theo tên hoặc ID"
  - "Xem thông tin cơ bản (tên, ngày sinh, giới tính)"
  - "Liệt kê tất cả bệnh nhân"
when_not_to_use:
  - "Xem hồ sơ y tế chi tiết → dùng records skill"
  - "Xem ảnh chụp → dùng imaging skill"
keywords:
  - bệnh nhân
  - patient
  - tìm kiếm bệnh nhân
  - thông tin bệnh nhân
  - danh sách bệnh nhân
  - ngày sinh
  - giới tính
examples:
  - "Tìm bệnh nhân tên Nguyễn Văn A"
  - "Xem thông tin bệnh nhân ID 123"
  - "Liệt kê tất cả bệnh nhân"
---

# Patient Management Skill

## Overview

Skill này cung cấp các chức năng cơ bản để quản lý thông tin bệnh nhân trong hệ thống.

## Tools

- `query_patient_basic_info`: Tìm kiếm và xem thông tin cơ bản của bệnh nhân
- `list_all_patients`: Liệt kê tất cả bệnh nhân trong hệ thống

## Usage Guidelines

1. Luôn tìm bệnh nhân trước khi truy cập thông tin chi tiết
2. Sử dụng tên hoặc ID để tìm kiếm chính xác
3. Nếu có nhiều kết quả, yêu cầu ngườ dùng cung cấp thêm thông tin
