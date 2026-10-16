---
title: "Redis 未授权访问风险全解：从数据泄露到主机沦陷的防御清单"
date: 2026-10-05T10:00:00+08:00
description: "分析 Redis 未授权访问的风险链路（数据泄露、写文件、主从复制滥用），给出绑定、认证、权限、隔离四层加固方案。"
tags: ["Redis", "未授权访问", "中间件加固", "数据库安全"]
categories: ["中间件安全"]
---

## 前言

Redis 设计初衷是"运行在可信内网环境的高性能缓存"，默认配置**无认证、绑定所有网卡**。Shodan 上常年能搜到数万个直接暴露在公网的 Redis 实例。未授权访问不只是"数据被看光"那么简单——在特定条件下，它能演变为**完整的主机控制权丢失**。本文梳理风险链路与防御方案。

<!--more-->

## 风险链路分析

### 第一层：数据泄露与篡改

未授权连接后可执行 `KEYS *`、`GET`、`FLUSHALL`——缓存中的 Session、验证码、业务数据全部暴露，且可被任意篡改或清空。

### 第二层：任意文件写

通过 `CONFIG SET dir/dbfilename` 修改持久化路径，再用 `SET` 写入构造内容并触发 `SAVE`，可将数据写入服务器的 SSH `authorized_keys`、crontab、Web 目录等位置。这是利用 Redis 写文件获取主机的经典路径。

### 第三层：主从复制滥用（4.x/5.x）

攻击者将受害 Redis 设为恶意实例的从节点，通过全量同步投递恶意模块（`.so` 文件），再 `MODULE LOAD` 加载执行——这是 Redis 4.x/5.x 版本影响最大的利用方式，官方随后引入保护限制。

> 以上仅说明攻击原理以助防御，实际操作步骤与工具本文不展开。请勿对任何未授权系统进行测试。

## 四层加固方案

### 1. 网络隔离（最重要）

```text
# redis.conf
bind 127.0.0.1 10.0.0.11   # 只绑定必需的内网地址，绝不绑公网
protected-mode yes          # 保护模式保持开启
port 6379                   # 如非必要不对外开放，前面加防火墙白名单
```

云环境务必配置安全组，仅允许应用服务器 IP 访问 6379。

### 2. 认证与授权

```text
# Redis 6.0+ 推荐使用 ACL
user default off
user app on >强口令 ~app:* +@read +@write +@keyspace -@dangerous
user admin on >强口令 allkeys +@all

# 老版本至少设置
requirepass 强口令（32位以上随机串）
```

### 3. 危险命令收敛与降权

```text
# 重命名或禁用高危命令
rename-command FLUSHALL ""
rename-command FLUSHDB ""
rename-command CONFIG ""
rename-command MODULE ""
rename-command DEBUG ""
```

- 使用**普通用户**运行 Redis（严禁 root），限制其文件系统写权限
- 持久化目录权限设为 Redis 用户专属

### 4. 监控与审计

- 启用 Redis 日志并外发，监控 `SLAVEOF`、`CONFIG SET`、`MODULE LOAD` 等异常命令
- 定期巡检：实例是否绑定了 0.0.0.0、是否存在弱口令、版本是否有已知 CVE
- 使用 Redis Exporter + Prometheus 监控连接数突增等异常行为

## 应急检查清单（怀疑已被入侵时）

1. `INFO persistence`、`CONFIG GET dir` 检查持久化路径是否被篡改
2. 检查 `~/.ssh/authorized_keys`、crontab、Web 目录是否有陌生内容
3. `MODULE LIST` 查看是否被加载了陌生模块
4. 检查 dump.rdb 中是否被写入了可疑的 key 内容
5. 确认无入侵痕迹后，按上述四层方案整改并轮换凭据

## 小结

Redis 安全问题的 90% 可以用一句话避免：**别让它裸奔在公网，给它配个强口令**。剩下的 10% 靠 ACL、降权运行和命令收敛补齐。

---

> **免责声明**：本文仅从防御角度分析风险原理，不包含利用工具与攻击步骤。未经授权访问他人系统属违法行为，请遵守《中华人民共和国网络安全法》。
