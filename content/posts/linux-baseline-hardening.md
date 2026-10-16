---
title: "Linux 服务器安全基线加固实践：从最小化到可审计"
date: 2026-09-26T10:00:00+08:00
description: "一份可落地的 Linux 主机安全基线清单：账户与 SSH 加固、最小化服务、文件权限、日志审计与入侵检测。"
tags: ["Linux", "基线加固", "SSH", "审计", "等保"]
categories: ["主机安全"]
---

## 前言

主机是攻击者的最终落脚点。无论边界防护多严密，一旦应用层被打穿，主机层配置就决定了攻击者能走多远。本文按"账户 → 服务 → 文件 → 日志 → 检测"的顺序，给出一份面向生产环境的 Linux 基线加固清单，同时满足等级保护 2.0 对主机安全的基本要求。

<!--more-->

## 一、账户与认证

```bash
# 1. 排查空口令与弱口令账户
awk -F: '($2 == "") {print $1}' /etc/shadow
awk -F: '($3 == 0) {print $1}' /etc/passwd   # 应为 root 唯一 UID=0

# 2. 锁定无关系统账户
usermod -L daemon && usermod -L bin

# 3. 口令策略（/etc/login.defs）
# PASS_MAX_DAYS 90 / PASS_MIN_LEN 8 / PASS_WARN_AGE 7
```

- 禁用 root 直接 SSH 登录，使用普通账户 + sudo
- sudo 授权遵循最小权限，避免 `ALL=(ALL) ALL` 一把梭
- 全员启用基于密钥的认证，关闭口令登录

## 二、SSH 加固（/etc/ssh/sshd_config）

```text
PermitRootLogin no
PasswordAuthentication no
MaxAuthTries 3
ClientAliveInterval 300
ClientAliveCountMax 2
AllowUsers deploy ops   # 白名单化
Port 22                 # 改端口只能防扫描，不能替代密钥认证
```

修改后 `sshd -t` 校验语法再 `systemctl reload sshd`，**保留一个已登录会话防止把自己锁在门外**。

## 三、服务最小化

```bash
# 盘点监听端口与开机服务
ss -tlnp
systemctl list-unit-files --state=enabled
```

原则：**不用的服务一律停用并卸载**。特别注意以下高危服务不应直接暴露公网：Redis（6379）、Memcached（11211）、MongoDB（27017）、Docker API（2375）、Elasticsearch（9200）。

## 四、文件与权限

- 核心文件权限校验：`/etc/passwd`(644)、`/etc/shadow`(600/000)、`/etc/ssh/sshd_config`(600)
- 排查异常 SUID/SGID 文件，清理不必要的 SUID 位
- 关键目录挂载加固：`/tmp`、`/dev/shm` 增加 `noexec,nosuid,nodev`
- 对 `/etc`、`/usr/bin` 等建立文件完整性基线（AIDE/Tripwire）

## 五、日志与审计

- 开启 `auditd`，对 `/etc/passwd`、`/etc/sudoers`、提权命令配置监视规则
- 日志外发：本地日志可能被入侵者清除，重要主机应通过 rsyslog/syslog-ng 实时外发到独立日志服务器
- `journald` 设置持久化存储（`Storage=persistent`）
- 保证时钟同步（chronyd），否则跨主机日志关联会失真

## 六、入侵检测与响应

| 工具 | 用途 |
|---|---|
| auditd + 规则集 | 系统调用级审计 |
| AIDE | 文件完整性监控 |
| rkhunter / chkrootkit | Rootkit 定期扫描 |
| osquery | 主机状态实时查询 |
| Wazuh / 开源 HIDS | 集中式主机入侵检测 |

## 七、基线核查自动化

人工核查不可持续，建议：

- 使用 **OpenSCAP** 基于 CIS Benchmark 自动化扫描（`oscap xccdf eval`）
- 将基线固化为 Ansible/SaltStack  playbook，新机器交付即合规
- 基线项变更走配置管理流程，避免"加固一阵风"

## 小结

基线加固的本质是**减少攻击面 + 提高攻击者行为的可见性**。它不能替代补丁管理和入侵检测，但能让绝大多数自动化攻击脚本和低级入侵者无功而返。

---

> **免责声明**：本文内容仅用于合法的安全加固工作，请在自己的或已获得授权的系统上操作。
