---
title: "Nginx 与 Tomcat 生产环境安全加固基线"
date: 2026-10-09T10:00:00+08:00
description: "面向生产环境的 Nginx 与 Tomcat 安全加固清单：版本隐藏、管理面收敛、TLS 配置、请求限制与日志规范。"
tags: ["Nginx", "Tomcat", "中间件加固", "基线", "TLS"]
categories: ["中间件安全"]
---

## 前言

Nginx 和 Tomcat 是国内 Java Web 架构的黄金搭档，也是暴露面最大的两个中间件。默认配置面向"能快速跑起来"，而非"安全"。本文给出一份可直接落地的生产加固基线。

<!--more-->

## 一、Nginx 加固

### 版本与信息收敛

```nginx
server_tokens off;            # 响应头不暴露版本号
# 编译或代理层统一错误页，避免默认错误页泄漏指纹
```

### 请求限制

```nginx
# 限制单 IP 速率，缓解 CC 类攻击
limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
server {
    location /api/ {
        limit_req zone=api burst=20 nodelay;
        limit_conn addr 50;
        client_max_body_size 10m;      # 按需收紧上传体积
        client_body_timeout 10s;
        client_header_timeout 10s;
    }
}
```

### 方法与路径收敛

```nginx
# 只允许业务必需的方法
if ($request_method !~ ^(GET|POST|HEAD)$ ) { return 405; }

# 禁止访问敏感路径
location ~* /\.(git|svn|env) { deny all; return 404; }
location ~* (\.bak|\.swp|\.sql)$ { deny all; return 404; }
```

### 安全响应头

```nginx
add_header X-Frame-Options SAMEORIGIN;
add_header X-Content-Type-Options nosniff;
add_header Referrer-Policy strict-origin-when-cross-origin;
add_header Content-Security-Policy "default-src 'self'" always;  # 按业务调整
```

### TLS 基线

- 仅启用 TLS 1.2 / 1.3，禁用 SSLv3、TLS 1.0/1.1
- 使用 ECDHE 套件保证前向保密，禁用弱加密套件（DES/RC4/3DES/NULL）
- 配置 HSTS：`add_header Strict-Transport-Security "max-age=31536000" always;`
- 用 SSL Labs 或 myssl.com 定期体检，目标 A 级以上

## 二、Tomcat 加固

### 管理面收敛（重中之重）

- **删除或限制 manager/host-manager 应用**：生产环境多数不需要；保留时必须限定访问来源 IP（`RemoteAddrValve`）并使用强口令
- 修改 `shutdown` 端口口令，或设为 `-1` 禁用
- AJP 连接器（8009 端口）：**不使用就注释掉**。Ghostcat 漏洞（CVE-2020-1938）就是利用暴露的 AJP 端口读取 Web 目录文件

### 应用部署规范

- 关闭自动部署与热部署（生产环境）：`autoDeploy="false"`、`deployOnStartup` 谨慎使用
- 禁用目录列表：`conf/web.xml` 中 `listings` 设为 `false`
- 定制错误页，关闭堆栈信息回显（`ErrorReportValve` 中 `showServerInfo="false"`、`showReport="false"`）
- 移除默认应用：ROOT 示例、docs、examples

### 运行权限

- 使用专用普通用户运行 Tomcat，禁止 root
- 开启 SecurityManager（有历史包袱但仍有价值）或用 systemd 沙箱化：`ProtectSystem=strict`、`NoNewPrivileges=true`

## 三、通用项

| 项目 | 要求 |
|---|---|
| 补丁管理 | 订阅组件安全公告，Nginx/Tomcat 的 CVE 需在评估后限期升级 |
| 日志 | access.log 记录 X-Forwarded-For；日志外发集中留存 ≥6 个月（等保要求） |
| 进程可见性 | 监控异常外连、异常子进程（如 bash/sh 由 Java 进程拉起应触发告警） |
| 备份 | 配置文件纳入版本管理，变更可追溯 |

## 小结

中间件加固的共性逻辑：**收敛暴露面（端口/路径/方法/信息）+ 最小权限 + 可审计**。做完这张清单，再配合 WAF 与主机层基线，Web 架构的安全水位就及格了。

---

> **免责声明**：本文内容仅用于合法的安全加固工作，请在自己的或已获授权的系统上操作。
