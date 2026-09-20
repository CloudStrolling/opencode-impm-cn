# 测试用例文档（TestCase）
**项目名称**：
**版本号**：
**日期**：
**测试负责人**：TE

## 一、测试范围概述
| 所属模块 | 关联任务 | 用例数 | 优先级分布 |
| --- | --- | --- | --- |

## 二、认证配置（接口测试适用）
> 当接口测试用例需要登录态时，在 Postman Collection JSON 的 `auth_config` 中配置认证信息，API-TEST-RUNNER.py 会在执行前自动完成登录并注入 token/cookie。

### 单步登录配置（login）
| 配置项 | 说明 | 示例值 |
| --- | --- | --- |
| auth_config.enabled | 是否启用自动认证 | true / false |
| login.url | 登录接口地址 | {{base_url}}/api/auth/login |
| login.method | 登录请求方法 | POST |
| login.headers | 登录请求头 | {"Content-Type": "application/json"} |
| login.body | 登录请求体模板（支持 {{username}} {{password}} 占位符） | {"username":"{{username}}","password":"{{password}}"} |
| login.token_path | 从登录响应中提取 token 的 JSON 路径 | $.data.token |
| login.token_type | token 类型（Bearer / Token / 自定义） | Bearer |
| login.token_header | token 写入的请求头名称 | Authorization |
| login.cookie_name | 从 Set-Cookie 中提取的 cookie 名称（可选） | JSESSIONID |
| login.cookie_path | 从登录响应体提取 cookie 值的 JSON 路径（可选） | $.data.sessionId |

### 多步登录配置（steps）
> 当登录流程需要多步时（如先获取 loginTicket，再用 loginTicket 换取 token），使用 `steps` 数组配置多步登录。每步可提取响应中的变量，供后续步骤使用。

| 配置项 | 说明 | 示例值 |
| --- | --- | --- |
| steps | 多步登录配置数组 | 见下方示例 |
| steps[].name | 步骤名称（用于日志输出） | "第一步：获取 loginTicket" |
| steps[].url | 请求接口地址（支持 {{variable}} 占位符） | {{base_url}}/api/auth/getLoginTicket |
| steps[].method | 请求方法 | POST |
| steps[].headers | 请求头 | {"Content-Type": "application/json"} |
| steps[].body | 请求体模板（支持 {{variable}} 占位符） | {"username":"{{username}}"} |
| steps[].token_path | 从响应中提取 token 的 JSON 路径（可选） | $.data.token |
| steps[].cookie_name | 从 Set-Cookie 中提取的 cookie 名称（可选） | JSESSIONID |
| steps[].cookie_path | 从响应体提取 cookie 值的 JSON 路径（可选） | $.data.sessionId |
| steps[].extract_vars | 从响应中提取的变量（key=变量名，value=JSON路径） | {"loginTicket": "$.data.loginTicket"} |

**多步登录示例**：
```json
{
  "auth_config": {
    "enabled": true,
    "steps": [
      {
        "name": "第一步：获取 loginTicket",
        "url": "{{base_url}}/api/auth/getLoginTicket",
        "method": "POST",
        "headers": {"Content-Type": "application/json"},
        "body": "{\"username\": \"{{username}}\", \"password\": \"{{password}}\"}",
        "extract_vars": {
          "loginTicket": "$.data.loginTicket"
        }
      },
      {
        "name": "第二步：用 loginTicket 换取 token",
        "url": "{{base_url}}/api/auth/login",
        "method": "POST",
        "headers": {"Content-Type": "application/json"},
        "body": "{\"loginTicket\": \"{{loginTicket}}\"}",
        "token_path": "$.data.token",
        "token_type": "Bearer",
        "token_header": "Authorization"
      }
    ],
    "credentials": { ... }
  }
}
```

### 数据库凭证配置（credentials）
| 配置项 | 说明 | 示例值 |
| --- | --- | --- |
| credentials.db_type | 数据库类型 | mysql / sqlite / postgresql |
| credentials.db_host | 数据库地址 | localhost |
| credentials.db_port | 数据库端口 | 3306 |
| credentials.db_name | 数据库名称 | myapp |
| credentials.db_user | 数据库连接用户名 | root |
| credentials.db_password | 数据库连接密码 | secret |
| credentials.query | 查询管理员凭证的 SQL | SELECT username, password FROM sys_user WHERE role='admin' LIMIT 1 |
| credentials.username_field | 查询结果中用户名字段名 | username |
| credentials.password_field | 查询结果中密码字段名 | password |

## 三、测试用例详情
### 模块：{模块名称} - {功能点}
#### TC-{用例ID}：{用例名称}（{P0/P1/P2/P3}）
- **用例ID**：
- **用例名称**：
- **所属模块**：
- **优先级**：P0 / P1 / P2 / P3
- **前置条件**：
- **测试类型**：单元测试 / 接口测试 / 功能测试 / UI测试
- **关联需求ID**：FR-xxx / US-xxx（需求/用户故事编号项目全局唯一，形如 FR-v0.0.1-001、US-v0.0.2-003）
- **需要登录态**：是 / 否（接口测试用例填写，若为"是"需在 auth_config 中配置登录接口）
- **测试数据**：
- **测试步骤**：
  1. 
  2. 
- **预期结果**：
  1. 
  2. 
- **自动化测试函数/脚本位置**：（由 impm-task-coding-writetest 步骤标注）
- **测试过程与结论**：（由 impm-task-coding-runtest 步骤记录，通过/失败/失败详情）

## 四、执行汇总
| 结果 | 数量 |
| --- | --- |
| 通过 |  |
| 失败 |  |
| 阻塞 |  |
| 跳过 |  |

## 五、风险评估
| 风险点 | 影响 | 应对措施 |
| --- | --- | --- |

## 六、签名确认
- 测试工程师（TE）：
- 项目经理（PM）：

<!-- SPDX-License-Identifier: Apache-2.0 / Copyright 2026 jenemy8023 <jenemy8023@163.com> -->
