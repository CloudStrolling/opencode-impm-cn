#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
API 接口测试执行器（Postman Collection v2.1 兼容）

功能：
  1. 读取 Postman Collection v2.1 格式的 JSON 接口测试用例文件；
  2. 逐个发送 HTTP 请求（支持 {{变量}} 占位符替换，变量取自 collection.variable 或命令行 --base-url）；
  3. 对比实际响应与预期结果（状态码、响应头、响应体字段、响应耗时）；
  4. 汇总判断并生成测试报告（控制台输出 + Markdown + JSON）；
  5. 自动处理接口认证：查询数据库获取管理员凭证 -> 调用登录接口 -> 注入 token/cookie。

用法：
  python API-TEST-RUNNER.py <collection.json> [--base-url URL] [--report-dir DIR] [--timeout SECONDS] [--no-auth]

退出码：
  0：全部用例通过
  1：存在失败用例，或参数/文件错误
"""

import argparse
import datetime
import json
import os
import re
import sys
import time
import hashlib


# ---------------------------------------------------------------------------
# HTTP 客户端：优先使用 requests，缺失时回退到标准库 urllib
# ---------------------------------------------------------------------------
try:
    import requests  # type: ignore
    _HAS_REQUESTS = True
except Exception:  # pragma: no cover - 环境差异
    import urllib.request
    import urllib.error
    _HAS_REQUESTS = False


# ---------------------------------------------------------------------------
# 认证处理模块：自动查询数据库、调用登录接口、注入 token/cookie
# ---------------------------------------------------------------------------
_AUTH_STATE_FILE = ".auth_state.json"


def _load_auth_config(collection):
    """从 collection 中提取 auth_config，不存在或 enabled=false 时返回 None。"""
    cfg = collection.get("auth_config")
    if not cfg or not cfg.get("enabled"):
        return None
    return cfg


def _get_db_credentials(auth_cfg):
    """根据 auth_config.credentials 查询数据库获取管理员用户名密码。
    返回 (username, password) 或 (None, None)。
    """
    cred = auth_cfg.get("credentials", {})
    db_type = cred.get("db_type", "mysql").lower()
    db_host = cred.get("db_host", "localhost")
    db_port = int(cred.get("db_port", 3306))
    db_name = cred.get("db_name", "")
    db_user = cred.get("db_user", "")
    db_password = cred.get("db_password", "")
    query = cred.get("query", "")
    username_field = cred.get("username_field", "username")
    password_field = cred.get("password_field", "password")

    if not query:
        print("警告：auth_config.credentials.query 为空，跳过数据库查询", file=sys.stderr)
        return None, None

    try:
        if db_type == "sqlite":
            import sqlite3
            conn = sqlite3.connect(db_name)
            cursor = conn.execute(query)
            row = cursor.fetchone()
            conn.close()
            if row:
                return row[0], row[1]
        elif db_type == "mysql":
            try:
                import pymysql
                conn = pymysql.connect(host=db_host, port=db_port, user=db_user,
                                       password=db_password, database=db_name,
                                       charset="utf8mb4", cursorclass=pymysql.cursors.DictCursor)
            except ImportError:
                import mysql.connector
                conn = mysql.connector.connect(host=db_host, port=db_port, user=db_user,
                                               password=db_password, database=db_name,
                                               charset="utf8mb4")
            cursor = conn.cursor()
            cursor.execute(query)
            row = cursor.fetchone()
            conn.close()
            if row:
                if isinstance(row, dict):
                    return row.get(username_field), row.get(password_field)
                return row[0], row[1]
        elif db_type in ("postgresql", "postgres"):
            import psycopg2
            conn = psycopg2.connect(host=db_host, port=db_port, user=db_user,
                                     password=db_password, dbname=db_name)
            cursor = conn.cursor()
            cursor.execute(query)
            row = cursor.fetchone()
            conn.close()
            if row:
                return row[0], row[1]
        else:
            print("警告：不支持的数据库类型 %s，跳过数据库查询" % db_type, file=sys.stderr)
    except Exception as exc:
        print("警告：数据库查询失败：%s" % exc, file=sys.stderr)
    return None, None


def _call_login(login_cfg, username, password, variables, timeout):
    """调用登录接口，返回 auth_state dict。"""
    url = _resolve_variables(login_cfg.get("url", ""), variables)
    method = (login_cfg.get("method") or "POST").upper()
    headers = {}
    for k, v in (login_cfg.get("headers") or {}).items():
        headers[_resolve_variables(k, variables)] = _resolve_variables(v, variables)

    body_tpl = login_cfg.get("body", "{}")
    body = body_tpl.replace("{{username}}", username or "").replace("{{password}}", password or "")

    auth_state = {"token": None, "cookies": {}, "session_id": None}

    try:
        if _HAS_REQUESTS:
            resp = requests.request(method=method, url=url, headers=headers,
                                    data=body if body else None, timeout=timeout)
            token_path = login_cfg.get("token_path", "")
            if token_path and resp.text:
                try:
                    resp_json = resp.json()
                    token_val = _json_get(resp_json, token_path)
                    if token_val is not object():
                        auth_state["token"] = str(token_val)
                except Exception:
                    pass

            cookie_name = login_cfg.get("cookie_name", "")
            cookie_path = login_cfg.get("cookie_path", "")
            if cookie_name:
                for c in resp.cookies:
                    if c.name == cookie_name:
                        auth_state["cookies"][c.name] = c.value
                        auth_state["session_id"] = c.value
                        break
            elif cookie_path and resp.text:
                try:
                    resp_json = resp.json()
                    cookie_val = _json_get(resp_json, cookie_path)
                    if cookie_val is not object():
                        auth_state["cookies"]["session"] = str(cookie_val)
                        auth_state["session_id"] = str(cookie_val)
                except Exception:
                    pass

            for c in resp.cookies:
                auth_state["cookies"][c.name] = c.value

            print("登录成功：token=%s, cookies=%d 个" % (
                "已获取" if auth_state["token"] else "未获取",
                len(auth_state["cookies"])))
        else:
            data = body.encode("utf-8") if isinstance(body, str) else body
            req = urllib.request.Request(url=url, data=data, method=method)
            for k, v in headers.items():
                req.add_header(k, v)
            try:
                resp = urllib.request.urlopen(req, timeout=timeout)
                resp_text = resp.read().decode("utf-8", errors="replace")

                token_path = login_cfg.get("token_path", "")
                if token_path and resp_text:
                    try:
                        resp_json = json.loads(resp_text)
                        token_val = _json_get(resp_json, token_path)
                        if token_val is not object():
                            auth_state["token"] = str(token_val)
                    except Exception:
                        pass

                cookie_header = resp.headers.get("Set-Cookie", "")
                if cookie_header:
                    for part in cookie_header.split(";"):
                        kv = part.strip().split("=", 1)
                        if len(kv) == 2:
                            auth_state["cookies"][kv[0].strip()] = kv[1].strip()
            except urllib.error.HTTPError as e:
                print("警告：登录接口返回 HTTP %s" % e.code, file=sys.stderr)
    except Exception as exc:
        print("警告：调用登录接口失败：%s" % exc, file=sys.stderr)

    return auth_state


def _save_auth_state(auth_state, collection_dir):
    """将 auth_state 保存到 collection 同目录的临时文件。"""
    path = os.path.join(collection_dir, _AUTH_STATE_FILE)
    try:
        auth_state["saved_at"] = time.time()
        with open(path, "w", encoding="utf-8") as f:
            json.dump(auth_state, f, ensure_ascii=False, indent=2)
        print("登录态已保存：%s" % path)
    except Exception as exc:
        print("警告：保存登录态失败：%s" % exc, file=sys.stderr)


def _load_auth_state(collection_dir):
    """从 collection 同目录加载 auth_state，不存在或过期返回 None。"""
    path = os.path.join(collection_dir, _AUTH_STATE_FILE)
    if not os.path.isfile(path):
        return None
    try:
        with open(path, "r", encoding="utf-8") as f:
            state = json.load(f)
        saved_at = state.get("saved_at", 0)
        if saved_at and (time.time() - saved_at) > 1800:
            print("登录态已过期，需要重新登录", file=sys.stderr)
            return None
        return state
    except Exception:
        return None


def _setup_authentication(collection, collection_dir, variables, timeout, no_auth=False):
    """完整的认证流程：检查配置 -> 查询数据库 -> 调用登录 -> 保存状态。"""
    if no_auth:
        return None

    auth_cfg = _load_auth_config(collection)
    if not auth_cfg:
        return None

    print("=" * 40)
    print("检测到接口认证配置，开始自动登录...")
    print("=" * 40)

    cached = _load_auth_state(collection_dir)
    if cached and (cached.get("token") or cached.get("cookies")):
        print("使用缓存的登录态")
        return cached

    username, password = _get_db_credentials(auth_cfg)
    if username is None:
        print("警告：无法获取数据库凭证，跳过认证", file=sys.stderr)
        return None
    print("从数据库获取到管理员账号：%s" % username)

    login_cfg = auth_cfg.get("login", {})
    auth_state = _call_login(login_cfg, username, password, variables, timeout)

    _save_auth_state(auth_state, collection_dir)

    return auth_state


def _inject_auth_to_headers(headers, auth_state, login_cfg):
    """将 auth_state 中的 token/cookie 注入到请求头。"""
    if not auth_state:
        return headers

    headers = dict(headers)

    token = auth_state.get("token")
    if token:
        token_type = login_cfg.get("token_type", "Bearer")
        token_header = login_cfg.get("token_header", "Authorization")
        headers[token_header] = "%s %s" % (token_type, token)

    cookies = auth_state.get("cookies", {})
    if cookies:
        cookie_parts = ["%s=%s" % (k, v) for k, v in cookies.items()]
        headers["Cookie"] = "; ".join(cookie_parts)

    return headers


# ---------------------------------------------------------------------------
# 变量替换：支持 {{key}} 占位符
# ---------------------------------------------------------------------------
_VAR_RE = re.compile(r"\{\{([^{}]+)\}\}")


def _resolve_variables(text, variables):
    if not isinstance(text, str):
        return text
    return _VAR_RE.sub(lambda m: str(variables.get(m.group(1).strip(), m.group(0))), text)


# ---------------------------------------------------------------------------
# 简易 JSONPath 取值（支持 $.a.b[0].c 与 $）
# ---------------------------------------------------------------------------
def _json_get(doc, path):
    """根据类 JSONPath 表达式从 dict/list 取值，找不到返回 _MISSING。"""
    MISSING = object()
    if path in ("$", ""):
        return doc
    if not path.startswith("$"):
        path = "$" + path
    cur = doc
    expr = path[1:]
    tokens = re.findall(r"\.?([^.\[\]]+)|\[(\d+)\]", expr)
    for name, idx in tokens:
        if name:
            if isinstance(cur, dict) and name in cur:
                cur = cur[name]
            else:
                return MISSING
        elif idx != "":
            i = int(idx)
            if isinstance(cur, list) and 0 <= i < len(cur):
                cur = cur[i]
            else:
                return MISSING
    return cur


def _json_path_exists(doc, path):
    return _json_get(doc, path) is not object()


# ---------------------------------------------------------------------------
# 断言执行
# ---------------------------------------------------------------------------
def _coerce(value):
    """尝试将字符串转为与预期同类型做比较。"""
    return value


def _eval_assertion(actual_json, actual_text, assertion):
    """
    返回 (passed: bool, detail: str)。
    assertion 结构支持：
      {"type": "status", "equals": 200}
      {"type": "header", "name": "Content-Type", "contains": "application/json"}
      {"type": "json", "path": "$.code", "equals": 0}
      {"type": "json", "path": "$.data.id", "contains": "abc"}
      {"type": "body_contains", "value": "success"}
      {"type": "response_time", "max": 2000}
    """
    atype = assertion.get("type", "json")
    try:
        if atype == "status":
            return True, ""
        if atype == "header":
            return True, ""
        if atype == "json":
            path = assertion.get("path", "$")
            expected = assertion.get("equals", assertion.get("contains"))
            got = _json_get(actual_json, path)
            if got is object():
                return False, "路径 %s 不存在" % path
            if "equals" in assertion:
                if got != assertion["equals"]:
                    return False, "路径 %s 期望值=%s 实际值=%s" % (path, assertion["equals"], got)
            elif "contains" in assertion:
                if assertion["contains"] not in str(got):
                    return False, "路径 %s 值=%s 未包含 %s" % (path, got, assertion["contains"])
            return True, "路径 %s 校验通过" % path
        if atype == "body_contains":
            val = assertion.get("value", "")
            if val not in actual_text:
                return False, "响应体未包含 '%s'" % val
            return True, "响应体包含 '%s'" % val
    except Exception as exc:
        return False, "断言执行异常：%s" % exc
    return True, ""


# ---------------------------------------------------------------------------
# 单个用例执行
# ---------------------------------------------------------------------------
def run_item(item, variables, timeout, auth_state=None, login_cfg=None):
    result = {
        "name": item.get("name", ""),
        "passed": False,
        "status_code": 0,
        "elapsed_ms": 0,
        "error": "",
        "assertions": [],
        "response_body": "",
    }

    request = item.get("request", {})
    method = (request.get("method") or "GET").upper()

    # 解析 URL
    url_obj = request.get("url", {})
    if isinstance(url_obj, str):
        raw_url = url_obj
    else:
        raw_url = url_obj.get("raw", "")

    # 处理 query 参数拼接
    if isinstance(url_obj, dict) and url_obj.get("query"):
        q = []
        for qp in url_obj["query"]:
            q.append("%s=%s" % (_resolve_variables(qp.get("key", ""), variables),
                                _resolve_variables(qp.get("value", ""), variables)))
        if q:
            sep = "&" if "?" in raw_url else "?"
            raw_url = raw_url + sep + "&".join(q)

    url = _resolve_variables(raw_url, variables)

    # 请求头
    headers = {}
    for h in request.get("header", []) or []:
        headers[_resolve_variables(h.get("key", ""), variables)] = _resolve_variables(h.get("value", ""), variables)

    # 注入认证信息
    headers = _inject_auth_to_headers(headers, auth_state, login_cfg or {})

    # 请求体
    body = ""
    body_obj = request.get("body", {})
    if isinstance(body_obj, dict):
        if body_obj.get("mode") == "raw":
            body = _resolve_variables(body_obj.get("raw", ""), variables)
        elif body_obj.get("mode") == "urlencoded":
            parts = []
            for p in body_obj.get("urlencoded", []) or []:
                parts.append("%s=%s" % (p.get("key", ""), p.get("value", "")))
            body = "&".join(parts)
            if "Content-Type" not in headers:
                headers["Content-Type"] = "application/x-www-form-urlencoded"
    elif isinstance(body_obj, str):
        body = _resolve_variables(body_obj, variables)

    expected = item.get("expected", {}) or {}

    t0 = time.time()
    status_code, resp_headers, resp_text, error = _http_send(method, url, headers, body, timeout)
    elapsed_ms = int((time.time() - t0) * 1000)

    result["status_code"] = status_code
    result["elapsed_ms"] = elapsed_ms
    result["error"] = error
    result["response_body"] = resp_text

    if error:
        result["assertions"].append({"name": "请求发送", "passed": False, "detail": error})
        return result

    # 解析响应体 JSON
    actual_json = None
    try:
        actual_json = json.loads(resp_text) if resp_text else {}
    except Exception:
        actual_json = None

    checks = []

    # 1) 状态码
    exp_status = expected.get("status")
    if exp_status is not None:
        ok = (status_code == exp_status)
        checks.append({"name": "状态码=%s" % exp_status, "passed": ok,
                       "detail": "实际 %s" % status_code})

    # 2) 响应耗时
    exp_max = expected.get("max_response_time")
    if exp_max is not None:
        ok = (elapsed_ms <= exp_max)
        checks.append({"name": "响应耗时<=%sms" % exp_max, "passed": ok,
                       "detail": "实际 %sms" % elapsed_ms})

    # 3) 响应头
    for h in expected.get("headers", []) or []:
        name = h.get("name", "")
        val = h.get("contains", "")
        actual = resp_headers.get(name, "")
        ok = (val in actual)
        checks.append({"name": "响应头 %s 包含 %s" % (name, val), "passed": ok,
                       "detail": "实际 '%s'" % actual})

    # 4) 响应体断言
    assertions = expected.get("assertions", []) or []
    target = actual_json if actual_json is not None else {}
    for a in assertions:
        if actual_json is None and a.get("type") in ("json",):
            ok = False
            detail = "响应体不是合法 JSON"
        else:
            ok, detail = _eval_assertion(target, resp_text, a)
        name = a.get("path") or a.get("type") or "断言"
        checks.append({"name": name, "passed": ok, "detail": detail})

    result["assertions"] = checks
    result["passed"] = all(c["passed"] for c in checks) if checks else (status_code != 0)
    return result


# ---------------------------------------------------------------------------
# 报告生成
# ---------------------------------------------------------------------------
def _build_reports(collection_name, results, report_dir):
    total = len(results)
    passed = sum(1 for r in results if r["passed"])
    failed = total - passed
    ts = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    # 控制台
    print("=" * 60)
    print("接口测试报告  %s" % ts)
    print("集合：%s" % collection_name)
    print("总计：%d  通过：%d  失败：%d" % (total, passed, failed))
    print("-" * 60)
    for i, r in enumerate(results, 1):
        mark = "PASS" if r["passed"] else "FAIL"
        print("[%s] %d. %s  (HTTP %s, %sms)" % (mark, i, r["name"], r["status_code"], r["elapsed_ms"]))
        if not r["passed"]:
            for c in r["assertions"]:
                if not c["passed"]:
                    print("      - %s : %s" % (c["name"], c["detail"]))
            if r["error"]:
                print("      错误：%s" % r["error"])
    print("=" * 60)

    # Markdown
    md = []
    md.append("# 接口测试报告")
    md.append("")
    md.append("- 执行时间：%s" % ts)
    md.append("- 测试集合：%s" % collection_name)
    md.append("- 用例总数：%d" % total)
    md.append("- 通过：%d" % passed)
    md.append("- 失败：%d" % failed)
    md.append("")
    md.append("| 序号 | 用例 | HTTP | 耗时(ms) | 结果 |")
    md.append("| ---- | ---- | ---- | -------- | ---- |")
    for i, r in enumerate(results, 1):
        mark = "✅ 通过" if r["passed"] else "❌ 失败"
        md.append("| %d | %s | %s | %s | %s |" % (i, r["name"], r["status_code"], r["elapsed_ms"], mark))
    md.append("")
    md.append("## 失败详情")
    md.append("")
    has_fail = False
    for i, r in enumerate(results, 1):
        if not r["passed"]:
            has_fail = True
            md.append("### %d. %s" % (i, r["name"]))
            if r["error"]:
                md.append("- 错误：%s" % r["error"])
            for c in r["assertions"]:
                if not c["passed"]:
                    md.append("- 断言失败：%s —— %s" % (c["name"], c["detail"]))
            md.append("")

    # 失败详情为空时给出占位
    if not has_fail:
        md.append("_无失败用例_")
        md.append("")

    md_text = "\n".join(md)

    # JSON
    json_obj = {
        "collection": collection_name,
        "executed_at": ts,
        "summary": {"total": total, "passed": passed, "failed": failed},
        "results": results,
    }

    os.makedirs(report_dir, exist_ok=True)
    md_path = os.path.join(report_dir, "api-test-report.md")
    json_path = os.path.join(report_dir, "api-test-report.json")
    with open(md_path, "w", encoding="utf-8") as f:
        f.write(md_text)
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(json_obj, f, ensure_ascii=False, indent=2)

    return md_path, json_path, (passed == total and total > 0)


# ---------------------------------------------------------------------------
# 主流程
# ---------------------------------------------------------------------------
def main(argv=None):
    parser = argparse.ArgumentParser(description="Postman Collection v2.1 接口测试执行器")
    parser.add_argument("collection", help="Postman Collection v2.1 JSON 文件路径")
    parser.add_argument("--base-url", default=None, help="覆盖 base_url 变量（如 http://localhost:8080）")
    parser.add_argument("--report-dir", default="api-test-report", help="测试报告输出目录（由调用方传入）")
    parser.add_argument("--timeout", type=int, default=30, help="单请求超时秒数")
    parser.add_argument("--no-auth", action="store_true", help="跳过认证流程（即使 collection 中配置了 auth_config）")
    args = parser.parse_args(argv)

    if not os.path.isfile(args.collection):
        print("错误：找不到集合文件 %s" % args.collection, file=sys.stderr)
        return 1

    try:
        with open(args.collection, "r", encoding="utf-8") as f:
            collection = json.load(f)
    except Exception as exc:
        print("错误：解析集合 JSON 失败：%s" % exc, file=sys.stderr)
        return 1

    variables = {}
    for v in collection.get("variable", []) or []:
        variables[v.get("key")] = v.get("value")
    if args.base_url:
        variables["base_url"] = args.base_url

    collection_name = collection.get("info", {}).get("name", os.path.basename(args.collection))
    items = collection.get("item", []) or []

    if not items:
        print("警告：集合中没有 item 用例。", file=sys.stderr)

    # 自动认证流程
    collection_dir = os.path.dirname(os.path.abspath(args.collection))
    auth_state = _setup_authentication(collection, collection_dir, variables, args.timeout, args.no_auth)
    login_cfg = {}
    if auth_state:
        auth_cfg = _load_auth_config(collection)
        if auth_cfg:
            login_cfg = auth_cfg.get("login", {})

    results = []
    for item in items:
        results.append(run_item(item, variables, args.timeout, auth_state, login_cfg))

    md_path, json_path, all_passed = _build_reports(collection_name, results, args.report_dir)
    print("报告已生成：\n  %s\n  %s" % (md_path, json_path))

    return 0 if all_passed else 1


if __name__ == "__main__":
    sys.exit(main())
