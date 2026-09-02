# 敏感信息/密钥泄露检测报告
**项目名称**：**扫描日期**：**扫描人**：TL **工具依据**：impm-tools-secrets-scanning 自动化扫描

## 使用说明
1. 本报告由 impm-tools-secrets-scanning 技能自动生成，覆盖代码源码、配置文件、环境文件、部署脚本等项目文件。
2. 每条发现的风险等级取值：
   - **高**：硬编码密码/私钥/AK/SK 等可直接导致未授权访问的明文凭证；
   - **中**：内网 IP、数据库连接串含凭证、.env 文件被跟踪等间接风险；
   - **低**：高熵字符串、注释中的示例凭证、低风险配置等。
3. 每条发现必须给出文件路径（含行号）、匹配内容摘要（脱敏处理）与修复建议。

## 1. 扫描结论汇总
| 风险类别 | 发现数 | 高 | 中 | 低 |
| --- | --- | --- | --- | --- |
| API 密钥 / AK / SK |  |  |  |  |
| 密码 / 口令 |  |  |  |  |
| Token / JWT |  |  |  |  |
| 私钥 |  |  |  |  |
| 数据库连接串 |  |  |  |  |
| 内网 IP 地址 |  |  |  |  |
| .env / 配置文件泄露 |  |  |  |  |
| 其他敏感信息 |  |  |  |  |
| **合计** |  |  |  |  |

总体结论：（无风险 / 存在高风险项需立即整改 / 存在中低风险项建议改进）

## 2. 扫描范围
| 项目 | 内容 |
| --- | --- |
| 源码目录 |  |
| 配置文件 |  |
| 环境文件 |  |
| 部署脚本 |  |
| 依赖清单 |  |
| 排除目录 | node_modules、.git、dist、build、vendor 等 |

## 3. 扫描规则清单
| 规则编号 | 规则类别 | 正则/匹配模式 | 风险等级 | 说明 |
| --- | --- | --- | --- | --- |
| SEC-SCAN-01 | API 密钥 / AK / SK | AWS Access Key (`AKIA[0-9A-Z]{16}`) | 高 | AWS IAM 访问密钥 |
| SEC-SCAN-02 | API 密钥 / AK / SK | AWS Secret Key (`(?i)aws_secret_access_key\s*[=:]\s*['"]?[A-Za-z0-9/+=]{40}`) | 高 | AWS 密钥 |
| SEC-SCAN-03 | API 密钥 / AK / SK | GitHub Token (`ghp_[A-Za-z0-9]{36}`) | 高 | GitHub Personal Access Token |
| SEC-SCAN-04 | API 密钥 / AK / SK | GitHub OAuth (`gho_[A-Za-z0-9]{36}`) | 高 | GitHub OAuth Token |
| SEC-SCAN-05 | API 密钥 / AK / SK | GitHub App Token (`(?:ghu\|ghs)_[A-Za-z0-9]{36}`) | 高 | GitHub App Token |
| SEC-SCAN-06 | API 密钥 / AK / SK | GitLab Token (`glpat-[A-Za-z0-9\-_]{20,}`) | 高 | GitLab Personal Access Token |
| SEC-SCAN-07 | API 密钥 / AK / SK | 阿里云 AccessKey (`LTAI[A-Za-z0-9]{12,20}`) | 高 | 阿里云 AccessKey ID |
| SEC-SCAN-08 | API 密钥 / AK / SK | 腾讯云 SecretId (`AKID[A-Za-z0-9]{13,20}`) | 高 | 腾讯云 SecretId |
| SEC-SCAN-09 | API 密钥 / AK / SK | Azure Storage Account Key (`(?i)AccountKey\s*=\s*[A-Za-z0-9+/=]{88}`) | 高 | Azure 存储账户密钥 |
| SEC-SCAN-10 | API 密钥 / AK / SK | Google API Key (`AIza[0-9A-Za-z\-_]{35}`) | 高 | Google API Key |
| SEC-SCAN-11 | API 密钥 / AK / SK | Slack Token (`xox[baprs]-[0-9]{10,}-[A-Za-z0-9\-]{24,}`) | 高 | Slack Bot/User/App Token |
| SEC-SCAN-12 | API 密钥 / AK / SK | 微信/AppSecret (`(?i)(app_?secret\|wechat.*secret)\s*[:=]\s*['"]?[a-f0-9]{32}`) | 高 | 微信 AppSecret |
| SEC-SCAN-13 | 密码 / 口令 | 通用密码赋值 (`(?i)(password\|passwd\|pwd\|secret\|credential)\s*[:=]\s*['"]([^'"]{4,})['"]`) | 高 | 硬编码密码/口令 |
| SEC-SCAN-14 | 密码 / 口令 | 连接串密码 (`(?i)(user\|username)\s*[:=]\s*['"]?[^\s'"]+['"]?\s*[;,]\s*(password\|passwd\|pwd)\s*[:=]\s*['"]?[^\s'";]+`) | 高 | 数据库/中间件连接串中的密码 |
| SEC-SCAN-15 | 密码 / 口令 | 登录凭证 (`(?i)(login_password\|auth_password\|admin_password)\s*[:=]\s*['"]?['"a-zA-Z0-9!@#$%^&*]{6,}`) | 高 | 登录密码 |
| SEC-SCAN-16 | Token / JWT | JWT Token (`eyJ[A-Za-z0-9\-_]+\.eyJ[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_.+/=]+`) | 高 | JSON Web Token |
| SEC-SCAN-17 | Token / JWT | Bearer Token (`(?i)bearer\s+[A-Za-z0-9\-._~+/]+=*`) | 高 | Authorization Bearer Token |
| SEC-SCAN-18 | Token / JWT | OAuth Access Token (`(?i)(access_token\|oauth_token)\s*[:=]\s*['"]?[A-Za-z0-9\-._]{20,}`) | 高 | OAuth 令牌 |
| SEC-SCAN-19 | Token / JWT | Stripe Key (`[rs]k_(live\|test)_[A-Za-z0-9]{24,}`) | 高 | Stripe 支付密钥 |
| SEC-SCAN-20 | 私钥 | PEM 私钥 (`-----BEGIN (RSA \|EC \|DSA \|OPENSSH )?PRIVATE KEY-----`) | 高 | PEM 格式私钥文件 |
| SEC-SCAN-21 | 私钥 | PKCS12/PFX (`-----BEGIN PKCS12-----`) | 高 | PKCS12 证书 |
| SEC-SCAN-22 | 数据库连接串 | JDBC 连接串 (`jdbc:[a-z]+://[^\s'"]+`) | 中 | 含凭证的 JDBC URL |
| SEC-SCAN-23 | 数据库连接串 | MySQL 连接串 (`(?i)mysql://[^\s'"]+`) | 中 | MySQL 连接 URL |
| SEC-SCAN-24 | 数据库连接串 | MongoDB 连接串 (`(?i)mongodb(\+srv)?://[^\s'"]+`) | 中 | MongoDB 连接 URL |
| SEC-SCAN-25 | 数据库连接串 | Redis 连接串 (`(?i)redis://[^\s'"]+`) | 中 | Redis 连接 URL |
| SEC-SCAN-26 | 内网 IP 地址 | A 类内网 (`(?<!\d)(10\.\d{1,3}\.\d{1,3}\.\d{1,3})(?!\d)`) | 中 | 10.0.0.0/8 内网地址 |
| SEC-SCAN-27 | 内网 IP 地址 | B 类内网 (`(?<!\d)(172\.(?:1[6-9]\|2\d\|3[01])\.\d{1,3}\.\d{1,3})(?!\d)`) | 中 | 172.16.0.0/12 内网地址 |
| SEC-SCAN-28 | 内网 IP 地址 | C 类内网 (`(?<!\d)(192\.168\.\d{1,3}\.\d{1,3})(?!\d)`) | 中 | 192.168.0.0/16 内网地址 |
| SEC-SCAN-29 | .env / 配置文件泄露 | .env 文件被跟踪 (文件路径匹配 `.env*`) | 中 | 环境配置文件不应入库 |
| SEC-SCAN-30 | .env / 配置文件泄露 | 配置文件含密钥 (`(?i)(secret\|token\|password\|api_?key\|private_?key)\s*[:=]\s*['"][A-Za-z0-9\-._+/=]{8,}['"]` 在 config/yaml/ini/toml 文件中) | 中 | 配置文件中硬编码凭证 |
| SEC-SCAN-31 | 其他敏感信息 | 高熵字符串 (`['"][A-Za-z0-9+/]{32,}={0,2}['"]` 长 Base64 串) | 低 | 可能为密钥的高熵字符串 |
| SEC-SCAN-32 | 其他敏感信息 | 中国身份证号 (`[1-9]\d{5}(?:19\|20)\d{2}(?:0[1-9]\|1[0-2])(?:0[1-9]\|[12]\d\|3[01])\d{3}[\dXx]`) | 中 | 个人身份信息 |
| SEC-SCAN-33 | 其他敏感信息 | 中国手机号 (`(?<!\d)1[3-9]\d{9}(?!\d)`) | 低 | 手机号（需结合上下文判断） |

## 4. 发现明细
| 编号 | 规则编号 | 风险等级 | 文件路径 | 行号 | 匹配内容摘要（脱敏） | 修复建议 |
| --- | --- | --- | --- | --- | --- | --- |
| FINDING-001 |  |  |  |  |  |  |

## 5. 修复建议优先级
### 高风险（必须立即修复）
- 将硬编码凭证迁移至环境变量或密钥管理服务（如 Vault、AWS Secrets Manager）
- 轮换已泄露的密钥/密码/Token
- 将泄露文件从 git 历史中清除（git filter-branch / BFG）

### 中风险（建议尽快修复）
- 将 .env 文件加入 .gitignore 并从跟踪中移除
- 数据库连接串中的密码改用环境变量注入
- 内网 IP 地址改用域名或服务发现机制

### 低风险（建议改进）
- 移除注释中的示例凭证或替换为占位符
- 对高熵字符串进行人工确认，非密钥则添加排除注释

<!-- SPDX-License-Identifier: Apache-2.0 / Copyright 2026 jenemy8023 <jenemy8023@163.com> -->
