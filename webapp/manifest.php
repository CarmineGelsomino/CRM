<?php
header('Content-Type: application/json; charset=utf-8');
readfile(__DIR__ . '/manifest.json');
