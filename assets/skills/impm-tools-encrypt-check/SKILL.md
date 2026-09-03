---
name: impm-tools-encrypt-check
description: 检查项目代码与配置中的密码算法合规性，确认是否使用国密算法（SM2/SM3/SM4），是否残留弱算法（MD5、DES、3DES、RC4、SHA-1 等），输出密码算法合规检查报告
---

# impm-tools-encrypt-check 技能

## 触发词
密码算法合规、国密算法、SM2、SM3、SM4、弱算法、MD5、DES、SHA-1、加密算法检查、密评、encrypt check、crypto compliance、tools-encrypt-check

## 何时使用
需要对当前项目进行密码算法合规检查，核查代码与配置中使用的加密/哈希/签名算法是否符合国密合规要求（使用 SM2/SM3/SM4 等国密算法），并检测是否残留 MD5、DES、3DES、RC4、SHA-1 等弱算法时使用。可独立执行，也可在阶段4代码审核后追加执行。与等保三级（impm-cpc-level3）、密钥泄露检测（impm-tools-secrets-scanning）互补。

## 执行角色
本技能由 技术负责人（subagent_type=tl）subagent 负责执行，执行时使用 Skill 工具加载本技能。

## 调度说明（PM/上级编排者启动本技能时必须遵守）
1. 启动方式：使用 task 工具启动 subagent，subagent_type 必须为 `tl`；禁止由 PM 或编排者自己代替执行本技能内容。
2. 提示词必传上下文（缺一不可）：项目根目录绝对路径（projectRoot）、项目英文缩写（{项目英文缩写}）、用户输入 $ARGUMENTS 原文（含用户提到的文件路径）、技能名（impm-tools-encrypt-check，要求 subagent 先用 Skill 工具加载本技能再执行）。
3. 完成要求：等待 subagent 返回完成结果后，核对检测报告已生成且内容完整，全部正确后才能结束。

## 关键变量定义与取值
| 变量 | 说明 | 获取方式 |
|---|---|---|
| 项目中文名称 | 项目的中文名称 | 通过 impm_project_info 从 docs/project.md 读取 |
| 项目英文缩写 | 项目的英文缩写，用于拼接报告路径 | 通过 impm_project_info 从 docs/project.md 读取 |
| 检查规则模板 | 密码算法合规检查规则清单与报告模板 | 通过 impm_template_reader 读取 TOOLS-ENCRYPT-CHECK-TEMPLATE.MD |

## 算法合规判定体系
> 本检查以《中华人民共和国密码法》、GB/T 39786-2021《信息安全技术 信息系统密码应用基本要求》、GB/T 32905-2016（SM3）、GB/T 32907-2016（SM4）、GB/T 32918-2016（SM2）等密评标准为判定依据。

| 分类 | 算法 | 判定 | 说明 |
|---|---|---|---|
| 国密公开算法 | SM2（非对称/签名/密钥交换）、SM3（哈希）、SM4（对称分组） | ✅ 合规 | 推荐使用的国密算法，符合密评要求 |
| SM1、SM9 | 国密算法 | ✅ 合规（提示） | SM1/SM9 需借助硬件密码模块或专用密码机使用 |
| 强算法（国际） | AES-256、AES-128、RSA-2048+、SHA-256、SHA-384、SHA-512、ECDSA、Ed25519、HMAC-SHA256、PBKDF2、bcrypt、scrypt、Argon2 等 | ✅ 合规（可选替代） | 技术强度足够，可作为过渡方案，但密评倾向国密 |
| 弱哈希/已弃用哈希 | MD5、SHA-1、SHA0、MD2、MD4（用于安全场景） | ⚠️ 中/高风险 | 存在碰撞攻击，禁止用于签名/口令存储等安全场景；用于校验和/兼容等非安全场景降级提示 |
| 弱对称加密 | DES、3DES（用于加密）、RC4、Blowfish、IDEA、TEA/XTEA 等 | 🔴 高风险 | 已确认不安全，禁止用于数据加密/传输保护 |
| 可回收/不安全密钥 | RSA-1024、DSA-1024、RC2、Skipjack | 🔴 高风险 | 密钥强度不足或算法弃用 |
| 随机数不安全 | Math.random()、rand()（非加密安全）用于安全场景 | ⚠️ 中风险 | 需使用 CSPRNG（crypto.getRandomValues、SecureRandom 等） |

## 各语言常见算法 API 映射表
> 用于指导跨语言正则扫描与人工复核，识别调用名与所属分类。

| 算法 | Python | Java | Node.js/JS | Go | C#/.NET | C/C++ |
|---|---|---|---|---|---|---|
| MD5 | hashlib.md5 | MessageDigest.getInstance("MD5") | crypto.createHash('md5') / md5 | crypto/md5.Sum | MD5.Create() | MD5() / md5 |
| SHA-1 | hashlib.sha1 | MessageDigest.getInstance("SHA-1") | crypto.createHash('sha1') | crypto/sha1.Sum | SHA1.Create() | SHA1() |
| SHA-256 | hashlib.sha256 | MessageDigest.getInstance("SHA-256") | crypto.createHash('sha256') | crypto/sha256.Sum256 | SHA256.Create() | SHA256() |
| SM3 | gmssl.sm3 / pysmx | BouncyCastle SM3Digest | sm-crypto sm3 | tjfoc/gmsm/sm3 | BouncyCastle SM3 | gmssl SM3() |
| DES | pyDes / Crypto.Cipher.DES | Cipher.getInstance("DES") | crypto.createCipheriv('des-') | crypto/des / tjfoc sm1 | DESCryptoServiceProvider | DES_cbc |
| 3DES | Crypto.Cipher.DES3 | Cipher.getInstance("DESede") | crypto.createCipheriv('des-ede3') | crypto/des.NewTripleDES | TripleDES | DES_ede3 |
| RC4 | Crypto.Cipher.ARC4 | Cipher.getInstance("RC4") | crypto.createCipheriv('rc4') | RC4 | RC4CryptoServiceProvider | RC4 |
| AES | Crypto.Cipher.AES | Cipher.getInstance("AES") | crypto.createCipheriv('aes-') | crypto/aes | Aes.Create() | AES_xxx |
| SM4 | gmssl.sm4 / pysmx | BouncyCastle SM4Engine | sm-crypto sm4 / @antv | tjfoc/gmsm/sm4 | BouncyCastle SM4 | SM4() |
| RSA | rsa / cryptography | Cipher.getInstance("RSA") | crypto.publicEncrypt | crypto/rsa | RSACryptoServiceProvider | RSA |
| SM2 | gmssl.sm2 | BouncyCastle SM2 | sm-crypto sm2 | tjfoc/gmsm/sm2 | BouncyCastle SM2 | gmssl SM2() |
| HMAC | hmac / hashlib | Mac.getInstance("HmacSHA256") | crypto.createHmac('sha256') | crypto/hmac | HMACSHA256 | HMAC() |
| 随机数 | random / secrets | new Random() | Math.random() | math/rand | new Random() | rand() |

## 执行要求
1. 严格按照执行步骤中的内容和顺序依次执行：不跳过、不乱序、不并行、不合并任何步骤。
2. 本技能为只读探查：只读取代码、配置与依赖清单，不得修改任何代码、配置与其他文档。
3. 判定的风险等级只能取四种取值：高、中、低、提示；每条发现必须有实际匹配证据（算法调用代码片段），禁止臆测或编造。
4. 检查对象以代码中的算法调用与实际使用场景为准，需结合上下文判断算法是否用于「安全场景」（如口令存储、数据加密、签名、随机数密钥生成）。不能仅凭 API 名字做机械判定：
   - MD5/SHA-1 用于**非安全场景**（文件校验和、幂等/去重哈希、缓存键、分片标识）时，降级为「提示」或「低」并注明场景。
   - MD5/SHA-1 用于**安全场景**（口令存储、消息签名、证书指纹校验）时，标记为「高」或「中」。
5. 弱算法发现必须写明具体文件路径、行号、算法调用代码片段与使用场景分析。
6. 所有文档路径必须用 {项目英文缩写} 拼接，不得臆造文件名。
7. 使用 impm_* 工具获取信息，不得编造工具返回结果。
8. 全程使用简体中文。

## 执行步骤
### 步骤 1：获取项目信息与确定检查范围
1. 调用 impm_project_info 读取 docs/project.md，获得项目中文名称与项目英文缩写；若 docs/project.md 不存在（项目未初始化），终止本技能并提示先执行 /impm-init 完成初始化。
2. 结合 docs/project.md 的项目地图、代码语言与结构，确定本次检查范围：源码目录、加密/安全相关工具类、配置文件中算法参数（如密码学算法的 cipher 名、digest 名）。
3. 确定排除目录列表（必须排除）：node_modules、.git、dist、build、vendor、__pycache__、.next、.nuxt、target、bin、obj 等构建/依赖产物目录。
4. 确定项目主语言与相关生态，作为后续扫描重点与「算法 API 映射表」选择依据。

### 步骤 2：读取检查规则模板
1. 调用 impm_template_reader（templateName=TOOLS-ENCRYPT-CHECK-TEMPLATE.MD）读取模板全文，获得报告格式与检查规则清单。

### 步骤 3：按算法类别逐项扫描
1. 按「算法合规判定体系」中的类别，使用 Grep 工具在检查范围内按正则逐一扫描各类算法调用：
   - **国密算法（正查）**：SM2 / SM3 / SM4（含算法常量如 "SM2"、"SM3"、"SM4"、'sm4'、SM4Engine、sm-crypto、pysmx、gmssl、tjfoc/gmsm 等），确认是否存在以及使用场景。
   - **弱哈希（负查）**：MD5、SHA-1（sha1）、MD2、MD4、SHA0 等，并区分安全/非安全场景。
   - **弱对称加密（负查）**：DES、3DES（desede/triple DES）、RC4、RC2、Blowfish、IDEA、TEA/XTEA 等。
   - **过短密钥（负查）**：RSA-1024、DSA-1024 等密钥强度不足用法。
   - **不安全随机数（负查）**：安全场景下使用 Math.random()、random、rand() 等非 CSPRNG 生成密钥/IV/盐值/token。
   - **强算法（过渡核查）**：AES、RSA-2048+、SHA-256 等，作为合规基线信息记录。
2. 每条匹配记录：文件路径、行号、算法调用代码片段、算法所属类别、使用场景。
3. 误报排除：
   - 跳过 node_modules 等依赖目录。
   - 跳过注释、字符串常量、文档示例中非实际调用的算法名。
   - 跳过测试目录中用于构造测试数据的算法调用（但若测试数据即代表生产行为，需保留并说明）。

### 步骤 4：使用场景与风险等级判定
1. 对每条匹配，结合上下文判定使用场景：
   - **安全场景**：口令/密码存储、消息签名、数据加密/解密、密钥协商、随机数生成密钥/IV/盐/token、证书指纹校验。
   - **非安全场景**：文件校验和、幂等/去重、缓存键、对象分片标识、兼容性演示。
2. 按「算法合规判定体系」与场景综合判定风险等级：
   - **高**：弱算法用于安全场景（MD5/SHA-1 口令存储、DES/3DES/RC4 数据加密、RSA-1024 签名/加密、Math.random 生成密钥）或使用已淘汰不安全算法。
   - **中**：弱算法用于半安全/过渡场景（如 SHA-1 证书指纹、弱随机数用于非密钥用途）。
   - **低**：弱算法用于明确的非安全场景（如 MD5 文件校验和、去重哈希），且无安全影响。
   - **提示**：强算法（AES/RSA-2048/SHA-256）作为过渡方案存在但可替换为国密；SM1/SM9 需硬件支持；未发现任何国密算法使用。
3. 每条发现必须给出场景分析与判定理由，禁止机械按算法名定级。

### 步骤 5：国密覆盖度评估
1. 统计国密算法（SM2/SM3/SM4）在代码中的实际使用位置与场景。
2. 结合项目功能（登录认证、数据存储加密、通信传输、数字签名等），给出国密覆盖度评估（完全覆盖 / 部分覆盖 / 未覆盖）。
3. 对未使用国密算法但使用了国际强算法的场景，标注为「过渡方案可替代」并给出替换建议（如 AES→SM4、SHA-256→SM3、RSA/ECDSA→SM2）。

### 步骤 6：生成检测报告
1. 严格按 TOOLS-ENCRYPT-CHECK-TEMPLATE.MD 的格式组织检测报告：
   - 表头信息（项目名称、检查日期、检查人=TL、工具依据）。
   - 检查结论汇总表（按算法类别统计发现数与各等级数量，含国密算法使用情况）。
   - 检查范围说明。
   - 算法使用清单（正查：已使用的算法及其场景与等级）。
   - 弱算法与合规问题明细表（每条发现含编号、规则编号、算法、风险等级、文件路径、行号、代码片段、场景分析与修复建议）。
   - 国密覆盖度评估。
   - 修复建议优先级（高/中/低分层给出）。
2. 使用 Write 工具，参照 license-check 报告路径规则确定写入位置：使用 impm_version action=current 检查是否存在版本目录；若存在（如 docs/{项目英文缩写}-v{版本号}/）则写入该版本目录，否则写入 docs 根目录。报告文件名固定为 `{项目英文缩写}-encrypt-check.md`。
3. 核对文件存在且内容完整：汇总统计与明细数量一致，每条发现均包含必要的路径、行号、代码片段、场景分析与修复建议。

### 步骤 7：总结与汇报
1. 统计各类算法（国密/国际强算法/弱算法）的发现数量与风险等级分布。
2. 若存在高风险发现，在报告末尾高亮提醒并列出 top 3 最严重发现摘要；若完全未使用国密算法而项目需密评，明确提示国密改造必要性。

## 交付物
- docs/{项目英文缩写}-encrypt-check.md（密码算法合规检查报告）

## 完成后提示
- 本技能全部操作完成后必须立即结束并返回调度方（报告路径、算法使用统计摘要与高风险项摘要）；严禁自行继续执行其他技能。
- 若为独立命令运行，向用户汇报报告位置、算法使用统计（国密/强算法/弱算法数量）、风险等级分布、弱算法残留明细与修复建议、国密覆盖度评估与整改建议。

<!-- SPDX-License-Identifier: Apache-2.0 / Copyright 2026 jenemy8023 <jenemy8023@163.com> -->
