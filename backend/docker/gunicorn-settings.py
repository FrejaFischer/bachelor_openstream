# SPDX-FileCopyrightText: 2025 Magenta ApS <https://magenta.dk>
# SPDX-License-Identifier: AGPL-3.0-only
# Copyright (C) 2021 Magenta ApS, http://magenta.dk.
# Contact: info@magenta.dk.


# Settings for gunicorn in docker.
import multiprocessing
import os

loglevel = "debug"
bind = os.environ.get("GUNICORN_BIND", "0.0.0.0:8000")
workers = multiprocessing.cpu_count() * 2 + 1
accesslog = "-"
errorlog = "-"
worker_tmp_dir = "/dev/shm"
max_requests = 1000
max_requests_jitter = 50
# The IP of the traefik container - if not specified gunicorn
# only trusts x forwarded for coming from 127.0.0.1
forwarded_allow_ips = os.environ.get("FORWARDED_ALLOW_IPS", "127.0.0.1,172.18.0.2")
# Default access log format except showing X forwarded for IP instead of host IP, as the host IP is just traefik's
access_log_format = (
    '%({x-forwarded-for}i)s %(l)s %(u)s %(t)s "%(r)s" %(s)s %(b)s "%(f)s" "%(a)s"'
)
