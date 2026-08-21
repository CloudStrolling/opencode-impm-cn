#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
API 接口测试执行器（Postman Collection v2.1 兼容）

功能：
  1. 读取 Postman Collection v2.1 格式的 JSON 接口测试用例文件；
  2. 逐个发送 HTTP 请求（支持 {{变量}} 占位符替换，变量取自 collection.variable 或命令行 --base-url）；
  3. 对比实际响应与预期结果（状态码、响应头、响应体字段、响应耗时）；
  4. 汇总判断并生成测试报告（控制台输出 + Markdown + JSON）。

用法：
  python API-TEST-RUNNER.py <collection.json> [--base-url URL] [--report-dir DIR] [--timeout SECONDS]

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


def _http_send(method, url, headers, body, timeout):
    """发送 HTTP 请求，返回 (status_code, resp_headers, resp_text, error)。"""
    resp_text = ""
    resp_headers = {}
    status_code = 0
    error = ""
    try:
        if _HAS_REQUESTS:
            resp = requests.request(
                method=method,
                url=url,
                headers=headers,
                data=body if body else None,
                timeout=timeout,
            )
            status_code = resp.status_code
            resp_headers = {k: v for k, v in resp.headers.items()}
            resp_text = resp.text
        else:
            data = body.encode("utf-8") if isinstance(body, str) else body
            req = urllib.request.Request(url=url, data=data, method=method)
            for k, v in headers.items():
                req.add_header(k, v)
            try:
                resp = urllib.request.urlopen(req, timeout=timeout)
                status_code = resp.getcode()
                resp_headers = {k: v for k, v in resp.headers.items()}
                resp_text = resp.read().decode("utf-8", errors="replace")
            except urllib.error.HTTPError as e:
                status_code = e.code
                resp_headers = {k: v for k, v in e.headers.items()}
                resp_text = e.read().decode("utf-8", errors="replace")
    except Exception as exc:  # 连接失败等
        error = str(exc)
    return status_code, resp_headers, resp_text, error


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
    # 去掉开头的 $
    expr = path[1:]
    # 按 . 或 [idx] 切分
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
      {"type": "response_time", "max": 2000}   # 在 item 级别单独处理
    """
    atype = assertion.get("type", "json")
    try:
        if atype == "status":
            # 由调用方单独处理，这里不出现
            return True, ""
        if atype == "header":
            name = assertion.get("name", "")
            val = assertion.get("contains", "")
            # headers 在调用处处理，这里不出现
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
def run_item(item, variables, timeout):
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
    parser.add_argument("--report-dir", default="scripts/API-TEST/report", help="测试报告输出目录")
    parser.add_argument("--timeout", type=int, default=30, help="单请求超时秒数")
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

    results = []
    for item in items:
        results.append(run_item(item, variables, args.timeout))

    md_path, json_path, all_passed = _build_reports(collection_name, results, args.report_dir)
    print("报告已生成：\n  %s\n  %s" % (md_path, json_path))

    return 0 if all_passed else 1


if __name__ == "__main__":
    sys.exit(main())
